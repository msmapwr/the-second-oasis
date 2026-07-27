/**
 * src/Render/DiceStage.ts
 * 操作类型：新建
 *
 * 像素骰子翻滚动画（绘制于 fx 特效层）
 *
 * 设计要点：
 * 1. 在 fx 层每帧绘制，未播放时仅清空（透明，不遮挡看板）
 * 2. 翻滚阶段：骰面快速随机跳变 + 轻微缩放抖动，营造物理翻滚感
 * 3. 落定阶段：缓停到最终点数 + 霓虹辉光，短暂停留后 resolve
 * 4. 像素风：方块骰体 + 方块点数，imageSmoothingEnabled=false 已保证锐利
 * 5. 多组支持：稳健 1 骰 / 激进 2 骰 / 加赛多人各一组，居中排布
 */
import { RenderContext } from './RenderContext';
import { CanvasPalette } from '@/UI/CanvasTheme';

/** 落定后停留时长（ms），让最终点数被人看清 */
const HOLD_MS = 320;

/**
 * 骰子播放选项
 */
export interface DicePlayOpts {
  /** 霓虹描边/点数颜色（默认绿洲青） */
  Color?: string;
  /** 翻滚时长（ms），默认 850 */
  Duration?: number;
}

/**
 * 骰子舞台：负责 fx 层的骰子动画
 *
 * 用法：
 *   const Dice = new DiceStage(FxCtx);
 *   // 在 LayeredCanvas 的 OnFxFrame 中调用 Dice.Render(Ts, Dt)
 *   await Dice.Play([[3, 5]], { Color: '#3B82F6' });
 */
export class DiceStage {
  private readonly _Ctx: RenderContext;
  private _Active = false;
  private _Start = 0;
  private _Duration = 850;
  private _Groups: number[][] = [];
  private _Color = '#00F5D4';
  private _Resolve: (() => void) | null = null;

  constructor(Ctx: RenderContext) {
    this._Ctx = Ctx;
  }

  /**
   * 是否正在播放（供外部判断，避免叠加）
   */
  get IsActive(): boolean {
    return this._Active;
  }

  /**
   * 播放骰子翻滚，最终落到各组给定点数。
   *
   * @param Groups 每组骰子的最终点数（如 [[3]] 稳健单骰 / [[2,5]] 激进双骰 / [[1,4],[6,2]] 加赛两组）
   * @returns 动画结束（落定停留后）resolve 的 Promise
   */
  Play(Groups: number[][], Opts: DicePlayOpts = {}): Promise<void> {
    this._Groups = Groups.length > 0 ? Groups : [[1]];
    this._Duration = Opts.Duration ?? 850;
    this._Color = Opts.Color ?? '#00F5D4';
    this._Start = performance.now();
    this._Active = true;
    return new Promise<void>((Resolve) => {
      this._Resolve = Resolve;
    });
  }

  /**
   * 每帧驱动（由 LayeredCanvas fx 层回调）
   */
  Render(Ts: number, _Dt: number): void {
    const Ctx = this._Ctx;
    Ctx.Clear();
    if (!this._Active) return;
    const Elapsed = Ts - this._Start;
    const Settling = Elapsed > this._Duration;
    const Total = this._Duration + HOLD_MS;
    this._Draw(Ts, Settling);
    if (Elapsed >= Total) {
      this._Active = false;
      const R = this._Resolve;
      this._Resolve = null;
      if (R) R();
    }
  }

  /**
   * 绘制全部骰子组
   */
  private _Draw(Ts: number, Settling: boolean): void {
    const Ctx = this._Ctx;
    const W = Ctx.Width;
    const H = Ctx.Height;
    const C2d = Ctx.Ctx;
    const Color = this._Color;
    const P = CanvasPalette();

    // 骰子尺寸随屏幕自适应
    const DieSize = Math.min(W, H) * 0.13;
    const Gap = DieSize * 0.3;
    const GroupGap = DieSize * 1.0;

    // 计算总宽度以居中
    const GroupWidths = this._Groups.map(
      (G) => G.length * DieSize + Math.max(0, G.length - 1) * Gap,
    );
    const Width =
      GroupWidths.reduce((A, B) => A + B, 0) +
      Math.max(0, this._Groups.length - 1) * GroupGap;
    const StartX = (W - Width) / 2;
    const CyTop = (H - DieSize) / 2;

    // 背部柔光聚焦（弱化看板干扰、突出骰子）
    const Grad = C2d.createRadialGradient(
      W / 2,
      H / 2,
      0,
      W / 2,
      H / 2,
      Width * 0.7 + DieSize,
    );
    Grad.addColorStop(0, P.DiceFocus);
    Grad.addColorStop(1, P.DiceFocus);
    C2d.fillStyle = Grad;
    C2d.fillRect(0, 0, W, H);

    let X = StartX;
    for (let Gi = 0; Gi < this._Groups.length; Gi++) {
      const G = this._Groups[Gi];
      for (let Di = 0; Di < G.length; Di++) {
        const Face = Settling ? G[Di] : this._RandFace(Ts, X + Di * 7);
        this._DrawDie(C2d, X, CyTop, DieSize, Face, Color, Settling, Ts);
        X += DieSize + Gap;
      }
      X += GroupGap;
    }
  }

  /**
   * 翻滚阶段：基于时间 + 位置种子生成跳变骰面（1..6）
   */
  private _RandFace(Ts: number, Seed: number): number {
    const V = Math.floor(Ts / 45 + Seed * 0.137);
    return 1 + (((V % 6) + 6) % 6);
  }

  /**
   * 绘制单个像素骰子
   */
  private _DrawDie(
    C2d: CanvasRenderingContext2D,
    X: number,
    Y: number,
    Size: number,
    Face: number,
    Color: string,
    Settling: boolean,
    Ts: number,
  ): void {
    // 翻滚抖动（落定后归零）
    const Wob = Settling ? 0 : Math.sin(Ts * 0.02 + X * 0.05) * 0.12;
    const Sc = 1 + Wob;
    const S = Size * Sc;
    const Ox = X + (Size - S) / 2;
    const Oy = Y + (Size - S) / 2;

    // 投影（像素方块阴影）
    C2d.fillStyle = 'rgba(0,0,0,0.5)';
    C2d.fillRect(Ox + 3, Oy + 5, S, S);

    // 骰体（深空底）
    C2d.fillStyle = 'rgba(11,14,20,0.95)';
    C2d.fillRect(Ox, Oy, S, S);

    // 霓虹描边 + 辉光
    C2d.save();
    C2d.shadowColor = Color;
    C2d.shadowBlur = Settling ? 22 : 10;
    C2d.strokeStyle = Color;
    C2d.lineWidth = Math.max(2, S * 0.07);
    C2d.strokeRect(Ox + 1, Oy + 1, S - 2, S - 2);
    C2d.restore();

    // 点数（方块像素）
    C2d.fillStyle = Color;
    this._DrawPips(C2d, Ox, Oy, S, Face);
  }

  /**
   * 标准骰面点数布局（3x3 网格）
   */
  private _DrawPips(
    C2d: CanvasRenderingContext2D,
    Ox: number,
    Oy: number,
    S: number,
    Face: number,
  ): void {
    const P = S * 0.16; // 点尺寸
    const A = 0.28;
    const B = 0.72;
    const M = 0.5;
    const Layouts: Record<number, [number, number][]> = {
      1: [[M, M]],
      2: [[A, A], [B, B]],
      3: [[A, A], [M, M], [B, B]],
      4: [[A, A], [B, A], [A, B], [B, B]],
      5: [[A, A], [B, A], [M, M], [A, B], [B, B]],
      6: [[A, A], [B, A], [A, M], [B, M], [A, B], [B, B]],
    };
    const Pts = Layouts[Face] ?? [[M, M]];
    for (const [Fx, Fy] of Pts) {
      const Px = Ox + Fx * S - P / 2;
      const Py = Oy + Fy * S - P / 2;
      C2d.fillRect(Px, Py, P, P);
    }
  }
}
