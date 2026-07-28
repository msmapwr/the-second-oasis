/**
 * src/Render/MenuViewportRenderer.ts
 * 操作类型：重写（新拟态控制台月球大图）
 *
 * 主菜单中央控制台月球视口：新拟态风格。
 * 密集装饰线条 + 四周 HUD 数据面板 + 旋转角标。
 */
import { CanvasPalette, type CanvasPalette as CanvasPaletteType } from '@/UI/CanvasTheme';

export class MenuViewportRenderer {
  readonly Canvas: HTMLCanvasElement;
  private readonly _Ctx: CanvasRenderingContext2D;
  private _W = 1;
  private _H = 1;
  private _Dpr = 1;
  private _Raf = 0;
  private _Running = false;
  private _T0 = performance.now();
  private _Observer: ResizeObserver | null = null;

  constructor() {
    this.Canvas = document.createElement('canvas');
    this.Canvas.className = 'menu-viewport-canvas';
    const Ctx = this.Canvas.getContext('2d');
    if (!Ctx) throw new Error('无法获取菜单视口 2D 上下文');
    this._Ctx = Ctx;
  }

  Mount(Parent: HTMLElement): void {
    Parent.appendChild(this.Canvas);
    this._Resize();
    this._Observer = new ResizeObserver(() => this._Resize());
    this._Observer.observe(this.Canvas);
  }

  private _Resize(): void {
    const Rect = this.Canvas.getBoundingClientRect();
    this._W = Math.max(1, Rect.width);
    this._H = Math.max(1, Rect.height);
    this._Dpr = window.devicePixelRatio || 1;
    this.Canvas.width = Math.floor(this._W * this._Dpr);
    this.Canvas.height = Math.floor(this._H * this._Dpr);
    this._Ctx.setTransform(this._Dpr, 0, 0, this._Dpr, 0, 0);
  }

  Start(): void {
    if (this._Running) return;
    this._Running = true;
    this._Raf = requestAnimationFrame(this._Loop);
  }

  Stop(): void {
    this._Running = false;
    if (this._Raf !== 0) { cancelAnimationFrame(this._Raf); this._Raf = 0; }
  }

  Dispose(): void {
    this.Stop();
    this._Observer?.disconnect();
    this._Observer = null;
    if (this.Canvas.parentNode) this.Canvas.remove();
  }

  private _Loop = (Ts: number): void => {
    if (!this._Running) return;
    this._Raf = requestAnimationFrame(this._Loop);
    this._Draw(Ts - this._T0);
  };

  private _Draw(Elapsed: number): void {
    const Ctx = this._Ctx, W = this._W, H = this._H, T = Elapsed / 1000;
    const P = CanvasPalette();
    Ctx.clearRect(0, 0, W, H);
    const Cx = W / 2, Cy = H / 2, R = Math.min(W, H) * 0.28;
    this._DrawOrbit(Cx, Cy, R, T, P);
    this._DrawScan(Cx, Cy, R * 1.42, T, P);
    this._DrawMoon(Cx, Cy, R, T, P);
    this._DrawMoonDecorations(Cx, Cy, R, T, P);
    this._DrawDataHud(W, H, Cx, Cy, R, T, P);
    this._DrawReticle(W, H, Cx, Cy, R, T, P);
  }

  private _DrawOrbit(Cx: number, Cy: number, R: number, T: number, P: CanvasPaletteType): void {
    const Ctx = this._Ctx;
    const Breath = 0.5 + 0.5 * Math.sin(T * 0.8);
    Ctx.save();
    Ctx.strokeStyle = `rgba(${P.MoonTeal}, ${0.1 + 0.04 * Breath})`; Ctx.lineWidth = 1;
    Ctx.beginPath(); Ctx.ellipse(Cx, Cy, R * 1.48, R * 0.45, 0, 0, Math.PI * 2); Ctx.stroke();
    Ctx.strokeStyle = `rgba(${P.MoonPurple}, ${0.07 + 0.03 * Breath})`;
    Ctx.beginPath(); Ctx.ellipse(Cx, Cy, R * 1.78, R * 0.58, 0, 0, Math.PI * 2); Ctx.stroke();
    Ctx.restore();
  }

  private _DrawScan(Cx: number, Cy: number, R: number, T: number, P: CanvasPaletteType): void {
    const Ctx = this._Ctx;
    const Angle = (T * 0.55) % (Math.PI * 2);
    Ctx.save(); Ctx.translate(Cx, Cy);
    if (Ctx.createConicGradient) {
      const Grad = Ctx.createConicGradient(Angle, 0, 0);
      Grad.addColorStop(0, `rgba(${P.MoonTeal}, 0.16)`);
      Grad.addColorStop(0.05, `rgba(${P.MoonTeal}, 0.02)`);
      Grad.addColorStop(0.18, `rgba(${P.MoonTeal}, 0)`);
      Grad.addColorStop(1, `rgba(${P.MoonTeal}, 0)`);
      Ctx.fillStyle = Grad;
      Ctx.beginPath(); Ctx.moveTo(0, 0); Ctx.arc(0, 0, R, 0, Math.PI * 2); Ctx.closePath(); Ctx.fill();
    }
    Ctx.strokeStyle = `rgba(${P.MoonTeal}, 0.3)`; Ctx.lineWidth = 1.5;
    Ctx.beginPath(); Ctx.moveTo(0, 0); Ctx.lineTo(Math.cos(Angle) * R, Math.sin(Angle) * R); Ctx.stroke();
    Ctx.restore();
  }

  private _DrawMoon(Cx: number, Cy: number, R: number, T: number, P: CanvasPaletteType): void {
    const Ctx = this._Ctx;
    Ctx.save(); Ctx.shadowColor = P.MoonGlow; Ctx.shadowBlur = 16;
    Ctx.beginPath(); Ctx.arc(Cx, Cy, R, 0, Math.PI * 2); Ctx.fillStyle = P.MoonCore; Ctx.fill();
    Ctx.restore();
    Ctx.save(); Ctx.beginPath(); Ctx.arc(Cx, Cy, R, 0, Math.PI * 2); Ctx.clip();
    const Surface = Ctx.createRadialGradient(Cx - R * 0.32, Cy - R * 0.32, R * 0.06, Cx, Cy, R * 1.1);
    Surface.addColorStop(0, P.MoonInner); Surface.addColorStop(0.5, P.MoonMid); Surface.addColorStop(1, P.MoonOuter);
    Ctx.fillStyle = Surface; Ctx.fillRect(Cx - R, Cy - R, R * 2, R * 2);
    for (let I = 1; I <= 6; I++) {
      const Sr = R * (I / 7);
      const A = I === 3 ? 0.08 : 0.03 + 0.008 * I;
      Ctx.strokeStyle = `rgba(${P.MoonTeal}, ${A})`; Ctx.lineWidth = I === 3 ? 0.9 : 0.5;
      Ctx.setLineDash(I === 3 ? [] : [2, 4]);
      Ctx.beginPath(); Ctx.ellipse(Cx - R * 0.04, Cy + R * 0.02, Sr, Sr * 0.84, -0.15, 0, Math.PI * 2); Ctx.stroke();
      Ctx.setLineDash([]);
    }
    const ScanCount = Math.floor(R * 1.6);
    for (let I = 0; I < ScanCount; I++) {
      const Y = Cy - R + (I / ScanCount) * R * 2;
      Ctx.fillStyle = `rgba(${P.MoonTeal}, ${0.02 + 0.012 * Math.sin(I * 0.4 + T * 1.8)})`;
      Ctx.fillRect(Cx - R, Y, R * 2, Math.max(1, R / ScanCount * 0.5));
    }
    const GridStep = R / 8;
    Ctx.strokeStyle = `rgba(${P.MoonTeal}, 0.04)`; Ctx.lineWidth = 0.4;
    for (let I = 0; I <= 16; I++) { const X = Cx - R + I * GridStep; Ctx.beginPath(); Ctx.moveTo(X, Cy - R); Ctx.lineTo(X, Cy + R); Ctx.stroke(); }
    for (let I = 0; I <= 16; I++) { const Y = Cy - R + I * GridStep; Ctx.beginPath(); Ctx.moveTo(Cx - R, Y); Ctx.lineTo(Cx + R, Y); Ctx.stroke(); }
    const Spin = T * 0.22;
    Ctx.strokeStyle = P.MoonGrid; Ctx.lineWidth = 0.8;
    for (let I = -3; I <= 3; I++) {
      const X = (I / 3.5) * R * Math.cos(Spin); const Ry = Math.sqrt(Math.max(0, R * R - X * X));
      if (Ry <= 0) continue;
      Ctx.beginPath(); Ctx.ellipse(Cx + X, Cy, Ry * 0.22, Ry, 0, 0, Math.PI * 2); Ctx.stroke();
    }
    for (let I = -2; I <= 2; I++) {
      const Y = (I / 3) * R; const Rx = Math.sqrt(Math.max(0, R * R - Y * Y));
      if (Rx <= 0) continue;
      Ctx.strokeStyle = I === 0 ? `rgba(${P.MoonTeal}, 0.2)` : P.MoonGrid;
      Ctx.lineWidth = I === 0 ? 0.8 : 0.6;
      Ctx.beginPath(); Ctx.ellipse(Cx, Cy + Y, Rx, Rx * 0.22, 0, 0, Math.PI * 2); Ctx.stroke();
    }
    Ctx.restore();
    Ctx.save(); Ctx.strokeStyle = P.MoonOutline; Ctx.lineWidth = 2;
    Ctx.shadowColor = P.MoonGlow; Ctx.shadowBlur = 8;
    Ctx.beginPath(); Ctx.arc(Cx, Cy, R, 0, Math.PI * 2); Ctx.stroke(); Ctx.restore();
  }

  private _DrawMoonDecorations(Cx: number, Cy: number, R: number, _T: number, P: CanvasPaletteType): void {
    const Ctx = this._Ctx;
    const RingRadii = [1.08, 1.15, 1.22, 1.3, 1.4, 1.52];
    for (const Sr of RingRadii) {
      const Rr = R * Sr, Alpha = 0.05 + (Sr - 1) * 0.04;
      Ctx.strokeStyle = `rgba(${P.MoonTeal}, ${Alpha})`; Ctx.lineWidth = 0.5;
      Ctx.setLineDash([1, 6]); Ctx.beginPath(); Ctx.arc(Cx, Cy, Rr, 0, Math.PI * 2); Ctx.stroke(); Ctx.setLineDash([]);
    }
    const SpokeCount = 16;
    Ctx.save();
    for (let I = 0; I < SpokeCount; I++) {
      const A = (I / SpokeCount) * Math.PI * 2, InnerR = R * 1.04, OuterR = R * 1.25, IsMajor = I % 4 === 0;
      Ctx.strokeStyle = `rgba(${P.MoonTeal}, ${IsMajor ? 0.12 : 0.05})`; Ctx.lineWidth = IsMajor ? 1 : 0.5;
      Ctx.beginPath(); Ctx.moveTo(Cx + Math.cos(A) * InnerR, Cy + Math.sin(A) * InnerR);
      Ctx.lineTo(Cx + Math.cos(A) * OuterR, Cy + Math.sin(A) * OuterR); Ctx.stroke();
      if (IsMajor) { Ctx.beginPath(); Ctx.moveTo(Cx + Math.cos(A) * OuterR, Cy + Math.sin(A) * OuterR); Ctx.lineTo(Cx + Math.cos(A) * R * 1.32, Cy + Math.sin(A) * R * 1.32); Ctx.stroke(); }
    }
    Ctx.restore();
    const EqY = Cy, EqRx = R, EqTickCount = 12;
    Ctx.save();
    for (let I = 0; I < EqTickCount; I++) {
      const Nx = (I / EqTickCount) * 2 - 1, X = Cx + Nx * EqRx;
      const EdgeR = Math.sqrt(R * R - (X - Cx) * (X - Cx));
      if (isNaN(EdgeR)) continue;
      Ctx.strokeStyle = `rgba(${P.MoonTeal}, ${I % 3 === 0 ? 0.2 : 0.08})`; Ctx.lineWidth = I % 3 === 0 ? 0.8 : 0.5;
      Ctx.beginPath(); Ctx.moveTo(X, EqY - EdgeR); Ctx.lineTo(X, EqY - EdgeR - 4); Ctx.stroke();
      Ctx.beginPath(); Ctx.moveTo(X, EqY + EdgeR); Ctx.lineTo(X, EqY + EdgeR + 4); Ctx.stroke();
    }
    Ctx.restore();
    const LabelFont = Math.max(7, R * 0.04);
    Ctx.font = `${LabelFont}px 'JetBrains Mono', monospace`; Ctx.textAlign = 'right'; Ctx.textBaseline = 'bottom';
    const DistLabels = [50, 100, 200, 500, 1000];
    for (let I = 0; I < DistLabels.length; I++) {
      const Rr = R * (1.18 + I * 0.14);
      Ctx.fillStyle = `rgba(${P.MoonTeal}, 0.18)`; Ctx.fillText(`${DistLabels[I]}km`, Cx - Rr - 2, Cy - 2);
    }
  }

  private _DrawDataHud(W: number, H: number, Cx: number, Cy: number, R: number, T: number, P: CanvasPaletteType): void {
    const Ctx = this._Ctx, MinDim = Math.min(W, H);
    const M = Math.max(MinDim * 0.02, 12), FontLbl = Math.max(8, R * 0.045), FontVal = Math.max(10, R * 0.058);
    const Teal = (A: number) => `rgba(${P.MoonTeal}, ${A})`;
    const Lx = Math.max(M, Cx - R * 1.65), Rx = Math.min(W - M, Cx + R * 1.65);
    const Ty = Math.max(M, Cy - R * 0.95), By = Math.min(H - M, Cy + R * 0.95);
    type HudItem = { Lbl: string; Val: () => string };
    type HudCluster = { X: number; Y: number; Align: 'left' | 'right'; Items: HudItem[] };
    const Clusters: HudCluster[] = [
      { X: Lx, Y: Ty, Align: 'left', Items: [
        { Lbl: 'TARGET ID', Val: () => 'LUNA-01' }, { Lbl: '赤经 RA', Val: () => `${(128.8 + T * 0.3).toFixed(1)}°` },
        { Lbl: '赤纬 Dec', Val: () => `${(17.5 + Math.sin(T * 0.2) * 2).toFixed(1)}°` }, { Lbl: '视直径', Val: () => '31.6′' },
      ]},
      { X: Rx, Y: Ty, Align: 'right', Items: [
        { Lbl: 'MISSION', Val: () => 'OASIS-3' }, { Lbl: '轨道倾角', Val: () => '5.14°' },
        { Lbl: '公转周期', Val: () => '27.32d' }, { Lbl: '远地点', Val: () => '405.4k km' },
      ]},
      { X: Lx, Y: By, Align: 'left', Items: [
        { Lbl: '地月距', Val: () => `${(384.4 + Math.sin(T * 0.15) * 5).toFixed(0)}k km` },
        { Lbl: '表面温度', Val: () => `${(127 + Math.sin(T * 0.4) * 7).toFixed(0)}°C` },
        { Lbl: '表面重力', Val: () => '1.62 m/s²' }, { Lbl: '自转周期', Val: () => '27.32d' },
      ]},
      { X: Rx, Y: By, Align: 'right', Items: [
        { Lbl: 'SCAN MODE', Val: () => '拓扑扫描' }, { Lbl: '进度', Val: () => `${((T * 0.55) % 100).toFixed(1)}%` },
        { Lbl: '分辨率', Val: () => '0.5m/px' }, { Lbl: '帧率', Val: () => '60.0 Hz' },
      ]},
    ];
    Ctx.font = `${FontLbl}px 'JetBrains Mono', monospace`;
    for (const Cl of Clusters) {
      Ctx.textAlign = Cl.Align; Ctx.textBaseline = 'top';
      const RowH = FontLbl + FontVal + 8;
      for (let I = 0; I < Cl.Items.length; I++) {
        const Item = Cl.Items[I], Ay = Cl.Y + I * RowH;
        Ctx.fillStyle = Teal(0.25); Ctx.fillText(Item.Lbl, Cl.X, Ay);
        const LblW = Ctx.measureText(Item.Lbl).width;
        const LineX = Cl.Align === 'left' ? Cl.X + LblW + 6 : Cl.X - LblW - 6;
        Ctx.strokeStyle = Teal(0.08); Ctx.lineWidth = 0.5;
        Ctx.beginPath(); Ctx.moveTo(LineX, Ay + FontLbl * 0.55); Ctx.lineTo(LineX, Ay + FontLbl * 0.55 + FontVal + 2); Ctx.stroke();
        Ctx.fillStyle = Teal(0.65);
        Ctx.font = `${FontVal}px 'JetBrains Mono', monospace`; Ctx.fillText(Item.Val(), Cl.X, Ay + FontLbl + 2);
        Ctx.font = `${FontLbl}px 'JetBrains Mono', monospace`;
      }
    }
  }

  private _DrawReticle(W: number, H: number, Cx: number, Cy: number, R: number, T: number, P: CanvasPaletteType): void {
    const Ctx = this._Ctx, Bracket = Math.min(W, H) * 0.06, M = Math.min(W, H) * 0.04;
    Ctx.save(); Ctx.strokeStyle = `rgba(${P.MoonTeal}, 0.4)`; Ctx.lineWidth = 2;
    const Corners: [number, number, number, number][] = [[M, M, 1, 1], [W - M, M, -1, 1], [M, H - M, 1, -1], [W - M, H - M, -1, -1]];
    for (const [X, Y, Sx, Sy] of Corners) {
      Ctx.beginPath(); Ctx.moveTo(X, Y + Sy * Bracket); Ctx.lineTo(X, Y); Ctx.lineTo(X + Sx * Bracket, Y); Ctx.stroke();
    }
    Ctx.strokeStyle = `rgba(${P.MoonTeal}, 0.25)`; Ctx.lineWidth = 1;
    const G = R * 0.16;
    Ctx.beginPath(); Ctx.moveTo(Cx - G, Cy); Ctx.lineTo(Cx + G, Cy);
    Ctx.moveTo(Cx, Cy - G); Ctx.lineTo(Cx, Cy + G); Ctx.stroke();
    Ctx.strokeStyle = `rgba(${P.MoonPurple}, 0.3)`; Ctx.lineWidth = 1.5;
    const Rot = T * 0.5;
    for (let I = 0; I < 4; I++) {
      const A0 = Rot + (I * Math.PI) / 2;
      Ctx.beginPath(); Ctx.arc(Cx, Cy, R * 1.28, A0, A0 + 0.35); Ctx.stroke();
    }
    Ctx.restore();
  }
}
