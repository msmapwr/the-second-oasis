/**
 * src/Render/MenuViewportRenderer.ts
 * 操作类型：新建
 *
 * 主菜单中央「舷窗视口」渲染器：自管 canvas + rAF，
 * 绘制旋转月球（绿洲辉光 / 环形山 / 经纬线自转）、轨道环、旋转扫描扫掠、准星支架。
 * 这是飞船控制台主菜单的视觉核心，营造「舰桥望向月球殖民地」的氛围。
 * 关联：C3 美化任务、C4 主菜单重写
 *
 * 设计要点：
 * 1. 自管 canvas（不挂载到 LayeredCanvas，独立 rAF ~60fps）
 * 2. 月球用径向渐变 + 自转经纬线，绿洲辉光描边 + 外发光
 * 3. 扫描扫掠：旋转楔形 + 雷达线，强化控制台「正在扫描」语义
 * 4. 准星：四角支架 + 中心十字，像素描边风
 * 5. ResizeObserver 自适应尺寸；Dispose 清理 rAF + 观察器
 */
import { CanvasPalette, type CanvasPalette as CanvasPaletteType } from '@/UI/CanvasTheme';

/**
 * 月球表面环形山（相对中心的坐标，绘制时按半径缩放）
 */
interface Crater {
  readonly Nx: number;
  readonly Ny: number;
  readonly Nr: number;
}

/**
 * 菜单视口渲染器
 */
export class MenuViewportRenderer {
  /** 对外暴露的 canvas 元素，由 MainMenu 挂载 */
  readonly Canvas: HTMLCanvasElement;

  private readonly _Ctx: CanvasRenderingContext2D;
  private _W = 1;
  private _H = 1;
  private _Dpr = 1;
  private _Raf = 0;
  private _Running = false;
  private _T0 = performance.now();
  private _Observer: ResizeObserver | null = null;
  private readonly _Craters: Crater[];

  constructor() {
    this.Canvas = document.createElement('canvas');
    this.Canvas.className = 'menu-viewport-canvas';
    const Ctx = this.Canvas.getContext('2d');
    if (!Ctx) {
      throw new Error('无法获取菜单视口 2D 上下文');
    }
    this._Ctx = Ctx;
    // 固定环形山布局（相对坐标），自转时随经纬线一起转
    this._Craters = [
      { Nx: -0.35, Ny: -0.2, Nr: 0.14 },
      { Nx: 0.28, Ny: -0.42, Nr: 0.1 },
      { Nx: 0.45, Ny: 0.18, Nr: 0.12 },
      { Nx: -0.15, Ny: 0.4, Nr: 0.09 },
      { Nx: 0.05, Ny: 0.05, Nr: 0.07 },
    ];
  }

  /**
   * 挂载到父元素并启动自适应
   */
  Mount(Parent: HTMLElement): void {
    Parent.appendChild(this.Canvas);
    this._Resize();
    // 自适应容器尺寸
    this._Observer = new ResizeObserver(() => this._Resize());
    this._Observer.observe(this.Canvas);
  }

  /**
   * 重算画布物理尺寸（DPR 感知）
   */
  private _Resize(): void {
    const Rect = this.Canvas.getBoundingClientRect();
    this._W = Math.max(1, Rect.width);
    this._H = Math.max(1, Rect.height);
    this._Dpr = window.devicePixelRatio || 1;
    this.Canvas.width = Math.floor(this._W * this._Dpr);
    this.Canvas.height = Math.floor(this._H * this._Dpr);
    this._Ctx.setTransform(this._Dpr, 0, 0, this._Dpr, 0, 0);
  }

  /**
   * 启动渲染循环
   */
  Start(): void {
    if (this._Running) return;
    this._Running = true;
    this._Raf = requestAnimationFrame(this._Loop);
  }

  /**
   * 停止渲染循环
   */
  Stop(): void {
    this._Running = false;
    if (this._Raf !== 0) {
      cancelAnimationFrame(this._Raf);
      this._Raf = 0;
    }
  }

  /**
   * 销毁：停止循环 + 断开观察器
   */
  Dispose(): void {
    this.Stop();
    this._Observer?.disconnect();
    this._Observer = null;
    this.Canvas.remove();
  }

  private _Loop = (Ts: number): void => {
    if (!this._Running) return;
    this._Raf = requestAnimationFrame(this._Loop);
    this._Draw(Ts - this._T0);
  };

  /**
   * 绘制一帧
   */
  private _Draw(Elapsed: number): void {
    const Ctx = this._Ctx;
    const W = this._W;
    const H = this._H;
    const T = Elapsed / 1000;
    const P = CanvasPalette();

    Ctx.clearRect(0, 0, W, H);

    const Cx = W / 2;
    const Cy = H / 2;
    const R = Math.min(W, H) * 0.3;

    // 1. 轨道环（两道椭圆，缓慢呼吸）
    this._DrawOrbit(Cx, Cy, R, T, P);

    // 2. 旋转扫描扫掠（雷达扇形）
    this._DrawScan(Cx, Cy, R * 1.5, T, P);

    // 3. 月球本体
    this._DrawMoon(Cx, Cy, R, T, P);

    // 4. 准星支架
    this._DrawReticle(W, H, Cx, Cy, R, T, P);
  }

  /**
   * 轨道环：两道细椭圆，带轻微透明度呼吸
   */
  private _DrawOrbit(Cx: number, Cy: number, R: number, T: number, P: CanvasPaletteType): void {
    const Ctx = this._Ctx;
    const Breath = 0.5 + 0.5 * Math.sin(T * 0.8);
    Ctx.save();
    Ctx.strokeStyle = `rgba(${P.MoonTeal}, ${0.12 + 0.06 * Breath})`;
    Ctx.lineWidth = 1;
    Ctx.beginPath();
    Ctx.ellipse(Cx, Cy, R * 1.45, R * 0.5, 0, 0, Math.PI * 2);
    Ctx.stroke();
    Ctx.strokeStyle = `rgba(${P.MoonPurple}, ${0.1 + 0.05 * Breath})`;
    Ctx.beginPath();
    Ctx.ellipse(Cx, Cy, R * 1.7, R * 0.62, 0, 0, Math.PI * 2);
    Ctx.stroke();
    Ctx.restore();
  }

  /**
   * 旋转扫描扫掠：发光雷达扇形 + 前沿亮线
   */
  private _DrawScan(Cx: number, Cy: number, Radius: number, T: number, P: CanvasPaletteType): void {
    const Ctx = this._Ctx;
    const Angle = (T * 0.6) % (Math.PI * 2);
    Ctx.save();
    Ctx.translate(Cx, Cy);
    // 扇形渐变（前沿亮 → 尾迹暗）
    const Grad = Ctx.createConicGradient
      ? Ctx.createConicGradient(Angle, 0, 0)
      : null;
    if (Grad) {
      Grad.addColorStop(0, `rgba(${P.MoonTeal}, 0.22)`);
      Grad.addColorStop(0.08, `rgba(${P.MoonTeal}, 0.04)`);
      Grad.addColorStop(0.25, `rgba(${P.MoonTeal}, 0)`);
      Grad.addColorStop(1, `rgba(${P.MoonTeal}, 0)`);
      Ctx.fillStyle = Grad;
      Ctx.beginPath();
      Ctx.moveTo(0, 0);
      Ctx.arc(0, 0, Radius, 0, Math.PI * 2);
      Ctx.closePath();
      Ctx.fill();
    }
    // 前沿亮线
    Ctx.strokeStyle = `rgba(${P.MoonTeal}, 0.5)`;
    Ctx.lineWidth = 1.5;
    Ctx.beginPath();
    Ctx.moveTo(0, 0);
    Ctx.lineTo(Math.cos(Angle) * Radius, Math.sin(Angle) * Radius);
    Ctx.stroke();
    Ctx.restore();
  }

  /**
   * 月球本体：径向渐变球面 + 自转经纬线 + 环形山 + 绿洲辉光描边
   */
  private _DrawMoon(Cx: number, Cy: number, R: number, T: number, P: CanvasPaletteType): void {
    const Ctx = this._Ctx;

    // 外发光
    Ctx.save();
    Ctx.shadowColor = P.MoonGlow;
    Ctx.shadowBlur = 28;
    Ctx.beginPath();
    Ctx.arc(Cx, Cy, R, 0, Math.PI * 2);
    Ctx.fillStyle = P.MoonCore;
    Ctx.fill();
    Ctx.restore();

    // 裁剪到球面绘制表面
    Ctx.save();
    Ctx.beginPath();
    Ctx.arc(Cx, Cy, R, 0, Math.PI * 2);
    Ctx.clip();

    // 球面径向渐变（亮色主题为浅色球体，中心亮、边缘略灰）
    const Surface = Ctx.createRadialGradient(
      Cx - R * 0.35, Cy - R * 0.35, R * 0.1,
      Cx, Cy, R * 1.1,
    );
    Surface.addColorStop(0, P.MoonInner);
    Surface.addColorStop(0.55, P.MoonMid);
    Surface.addColorStop(1, P.MoonOuter);
    Ctx.fillStyle = Surface;
    Ctx.fillRect(Cx - R, Cy - R, R * 2, R * 2);

    // 自转经纬线（随时间旋转）
    const Spin = T * 0.25;
    Ctx.strokeStyle = P.MoonGrid;
    Ctx.lineWidth = 1;
    // 纬线（横向椭圆）
    for (let I = -2; I <= 2; I++) {
      const Y = (I / 3) * R;
      const Rx = Math.sqrt(Math.max(0, R * R - Y * Y));
      if (Rx <= 0) continue;
      Ctx.beginPath();
      Ctx.ellipse(Cx, Cy + Y, Rx, Rx * 0.28, 0, 0, Math.PI * 2);
      Ctx.stroke();
    }
    // 经线（纵向椭圆，随时间轻微摆动模拟自转）
    for (let I = -2; I <= 2; I++) {
      const X = (I / 3) * R * Math.cos(Spin);
      const Ry = Math.sqrt(Math.max(0, R * R - X * X));
      if (Ry <= 0) continue;
      Ctx.beginPath();
      Ctx.ellipse(Cx + X, Cy, Ry * 0.28, Ry, 0, 0, Math.PI * 2);
      Ctx.stroke();
    }

    // 环形山（随自转横向滚动）
    for (const Cr of this._Craters) {
      const Ox = Math.cos(Spin) * Cr.Nx * R;
      const Oy = Cr.Ny * R;
      if (Ox * Ox + Oy * Oy > R * R) continue; // 转到背面则隐藏
      const Cxr = R * Cr.Nr;
      Ctx.fillStyle = P.CraterFill;
      Ctx.beginPath();
      Ctx.arc(Cx + Ox, Cy + Oy, Cxr, 0, Math.PI * 2);
      Ctx.fill();
      Ctx.strokeStyle = P.CraterStroke;
      Ctx.lineWidth = 1;
      Ctx.beginPath();
      Ctx.arc(Cx + Ox, Cy + Oy, Cxr, 0, Math.PI * 2);
      Ctx.stroke();
    }
    Ctx.restore();

    // 绿洲辉光描边
    Ctx.save();
    Ctx.strokeStyle = P.MoonOutline;
    Ctx.lineWidth = 2;
    Ctx.shadowColor = P.MoonGlow;
    Ctx.shadowBlur = 14;
    Ctx.beginPath();
    Ctx.arc(Cx, Cy, R, 0, Math.PI * 2);
    Ctx.stroke();
    Ctx.restore();
  }

  /**
   * 准星支架：四角 L 形支架 + 中心十字 + 旋转角标
   */
  private _DrawReticle(
    W: number, H: number,
    Cx: number, Cy: number, R: number,
    T: number,
    P: CanvasPaletteType,
  ): void {
    const Ctx = this._Ctx;
    const Bracket = Math.min(W, H) * 0.06;
    const M = Math.min(W, H) * 0.04;
    Ctx.save();
    Ctx.strokeStyle = `rgba(${P.MoonTeal}, 0.55)`;
    Ctx.lineWidth = 2;
    const Corners: [number, number, number, number][] = [
      [M, M, 1, 1],
      [W - M, M, -1, 1],
      [M, H - M, 1, -1],
      [W - M, H - M, -1, -1],
    ];
    for (const [X, Y, Sx, Sy] of Corners) {
      Ctx.beginPath();
      Ctx.moveTo(X, Y + Sy * Bracket);
      Ctx.lineTo(X, Y);
      Ctx.lineTo(X + Sx * Bracket, Y);
      Ctx.stroke();
    }

    // 中心十字（短）
    Ctx.strokeStyle = `rgba(${P.MoonTeal}, 0.35)`;
    Ctx.lineWidth = 1;
    const G = R * 0.18;
    Ctx.beginPath();
    Ctx.moveTo(Cx - G, Cy);
    Ctx.lineTo(Cx + G, Cy);
    Ctx.moveTo(Cx, Cy - G);
    Ctx.lineTo(Cx, Cy + G);
    Ctx.stroke();

    // 旋转角标（外圈虚弧）
    Ctx.strokeStyle = `rgba(${P.MoonPurple}, 0.4)`;
    Ctx.lineWidth = 1.5;
    const Rot = T * 0.5;
    for (let I = 0; I < 4; I++) {
      const A0 = Rot + (I * Math.PI) / 2;
      Ctx.beginPath();
      Ctx.arc(Cx, Cy, R * 1.25, A0, A0 + 0.4);
      Ctx.stroke();
    }
    Ctx.restore();
  }
}
