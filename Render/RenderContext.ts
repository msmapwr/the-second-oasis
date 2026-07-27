/**
 * src/Render/RenderContext.ts
 * 操作类型：新建
 *
 * 单个 Canvas 的渲染上下文封装
 * 关联：B 阶段架构方案 §2.3
 *
 * 设计要点：
 * 1. 处理 DPR（devicePixelRatio）：物理像素 = CSS 像素 × DPR
 * 2. imageSmoothingEnabled = false：像素风关抗锯齿，保证锐利
 * 3. OnResize：容器尺寸变化时重算画布物理尺寸
 * 4. 提供 Width/Height（CSS 像素）供绘制逻辑使用
 */
import { COLORS } from '@/UI/Theme';

/**
 * 渲染上下文数据快照
 */
export interface RenderContextData {
  /** 2D 上下文 */
  readonly Ctx: CanvasRenderingContext2D;
  /** 画布 CSS 宽度（逻辑像素） */
  readonly Width: number;
  /** 画布 CSS 高度（逻辑像素） */
  readonly Height: number;
  /** 设备像素比 */
  readonly Dpr: number;
}

/**
 * 单 Canvas 渲染上下文
 *
 * 用法：
 *   const Rc = new RenderContext(CanvasEl);
 *   Rc.Ctx.fillRect(0, 0, Rc.Width, Rc.Height);
 *   // resize 时
 *   Rc.OnResize();
 */
export class RenderContext implements RenderContextData {
  private _Ctx: CanvasRenderingContext2D;
  private _Width: number;
  private _Height: number;
  private _Dpr: number;

  constructor(Canvas: HTMLCanvasElement) {
    this._Dpr = window.devicePixelRatio || 1;
    this._Width = Canvas.clientWidth || 300;
    this._Height = Canvas.clientHeight || 150;
    // 设置物理像素尺寸
    Canvas.width = Math.floor(this._Width * this._Dpr);
    Canvas.height = Math.floor(this._Height * this._Dpr);
    const Ctx = Canvas.getContext('2d', { Alpha: true }) as CanvasRenderingContext2D | null;
    if (!Ctx) {
      throw new Error('无法获取 2D 渲染上下文');
    }
    this._Ctx = Ctx;
    // 缩放至 CSS 像素坐标系，绘制时用逻辑坐标
    this._Ctx.scale(this._Dpr, this._Dpr);
    // 像素风：关闭抗锯齿
    this._Ctx.imageSmoothingEnabled = false;
  }

  get Ctx(): CanvasRenderingContext2D {
    return this._Ctx;
  }

  get Width(): number {
    return this._Width;
  }

  get Height(): number {
    return this._Height;
  }

  get Dpr(): number {
    return this._Dpr;
  }

  /**
   * 容器尺寸变化时重算画布
   * 重新设置物理尺寸 + 重置 scale + 关抗锯齿
   */
  OnResize(Canvas: HTMLCanvasElement): void {
    this._Dpr = window.devicePixelRatio || 1;
    this._Width = Canvas.clientWidth || this._Width;
    this._Height = Canvas.clientHeight || this._Height;
    Canvas.width = Math.floor(this._Width * this._Dpr);
    Canvas.height = Math.floor(this._Height * this._Dpr);
    // resize 后 scale 被重置，需重新设置
    this._Ctx.setTransform(this._Dpr, 0, 0, this._Dpr, 0, 0);
    this._Ctx.imageSmoothingEnabled = false;
  }

  /**
   * 清空整个画布
   */
  Clear(): void {
    this._Ctx.clearRect(0, 0, this._Width, this._Height);
  }

  /**
   * 填充背景色
   */
  FillBackground(Color: string = COLORS.SpaceBg): void {
    this._Ctx.fillStyle = Color;
    this._Ctx.fillRect(0, 0, this._Width, this._Height);
  }
}
