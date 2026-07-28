/**
 * src/Render/StarfieldRenderer.ts
 * 操作类型：新建
 *
 * 星空背景渲染器：把 LayeredCanvas 的背景层从纯色填充升级为
 * 「舷窗外的深空」——缓闪星点 + 微弱星云。强化飞船控制台的太空氛围。
 * 关联：C2 美化任务、B 阶段架构方案 §5.6（背景星场）
 *
 * 设计要点：
 * 1. 直接绘制到传入的 RenderContext（背景层，~30fps 降帧）
 * 2. 星点用 1-2px 方块（像素风），部分染绿洲青，缓闪
 * 3. 星云用两团极低透明度的径向渐变，营造纵深
 * 4. 尺寸变化（resize）时自动重算星点分布
 * 5. 不持有 rAF，由 LayeredCanvas 主循环驱动 Render(Ts)
 */
import { RenderContext } from './RenderContext';
import { CanvasPalette } from '@/UI/CanvasTheme';

/**
 * 单颗星的数据
 */
interface Star {
  /** 归一化坐标（0-1），绘制时乘宽高，避免 resize 重排 */
  readonly Nx: number;
  readonly Ny: number;
  /** 像素尺寸 */
  readonly Size: number;
  /** 基础亮度 0-1 */
  readonly Base: number;
  /** 闪烁相位 */
  readonly Phase: number;
  /** 闪烁速度 */
  readonly Spd: number;
  /** 是否染绿洲青（少数点缀） */
  readonly Tint: boolean;
}

/**
 * 星云团（固定相对位置）
 */
interface Nebula {
  readonly Nx: number;
  readonly Ny: number;
  /** 半径占短边比例 */
  readonly Radius: number;
  readonly Color: string;
}

/**
 * 星空渲染器
 */
export class StarfieldRenderer {
  private readonly _Rc: RenderContext;
  private _Stars: Star[] = [];
  private readonly _Nebulae: Nebula[];
  private _LastW = 0;
  private _LastH = 0;

  constructor(Rc: RenderContext) {
    this._Rc = Rc;
    // 两团星云：一枚偏绿洲青（月海），一枚偏深蓝
    this._Nebulae = [
      { Nx: 0.5, Ny: 0.62, Radius: 0.55, Color: 'rgba(0, 245, 212, 0.05)' },
      { Nx: 0.78, Ny: 0.3, Radius: 0.4, Color: 'rgba(59, 130, 246, 0.045)' },
    ];
    this._InitStars();
  }

  /**
   * 依据当前画布尺寸生成星点
   */
  private _InitStars(): void {
    const { Width, Height } = this._Rc;
    this._LastW = Width;
    this._LastH = Height;
    // 星点密度：每 ~9000 平方逻辑像素一颗，上限 240
    const Count = Math.min(240, Math.max(40, Math.floor((Width * Height) / 9000)));
    const Stars: Star[] = [];
    for (let I = 0; I < Count; I++) {
      const R = Math.random();
      Stars.push({
        Nx: Math.random(),
        Ny: Math.random(),
        Size: R < 0.12 ? 2 : 1,
        Base: 0.25 + Math.random() * 0.75,
        Phase: Math.random() * Math.PI * 2,
        Spd: 0.4 + Math.random() * 1.6,
        Tint: Math.random() < 0.12,
      });
    }
    this._Stars = Stars;
  }

  /**
   * 绘制一帧（由 LayeredCanvas 主循环调用）
   * @param Ts performance.now 时间戳（ms）
   */
  Render(Ts: number): void {
    const Rc = this._Rc;
    // resize 后重算
    if (Rc.Width !== this._LastW || Rc.Height !== this._LastH) {
      this._InitStars();
    }
    const Ctx = Rc.Ctx;
    const W = Rc.Width;
    const H = Rc.Height;
    const P = CanvasPalette();

    // 深空底色（亮色主题为纯白）
    Ctx.fillStyle = P.SpaceBg;
    Ctx.fillRect(0, 0, W, H);

    // 星云（极低透明度径向渐变，颜色随主题切换）
    for (let I = 0; I < this._Nebulae.length; I++) {
      const N = this._Nebulae[I];
      const Cx = N.Nx * W;
      const Cy = N.Ny * H;
      const R = N.Radius * Math.min(W, H);
      const Grad = Ctx.createRadialGradient(Cx, Cy, 0, Cx, Cy, R);
      Grad.addColorStop(0, I === 0 ? P.NebulaA : P.NebulaB);
      Grad.addColorStop(1, 'rgba(0,0,0,0)');
      Ctx.fillStyle = Grad;
      Ctx.fillRect(0, 0, W, H);
    }

    // 星点（像素方块，缓闪）
    Ctx.imageSmoothingEnabled = false;
    const T = Ts / 1000;
    for (const S of this._Stars) {
      const A = S.Base * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(T * S.Spd + S.Phase)));
      Ctx.globalAlpha = Math.max(0, Math.min(1, A));
      Ctx.fillStyle = S.Tint ? P.MoonOutline : P.Star;
      Ctx.fillRect(S.Nx * W, S.Ny * H, S.Size, S.Size);
    }
    Ctx.globalAlpha = 1;
  }
}
