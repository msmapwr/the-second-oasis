/**
 * src/Render/LayeredCanvas.ts
 * 操作类型：新建
 *
 * 多 Canvas 分层管理器
 * 关联：B 阶段架构方案 §2.1/§2.2
 *
 * 设计要点：
 * 1. 3 层 Canvas：背景(低频) + 游戏主层(60fps) + 特效层
 * 2. 单 rAF 主循环驱动，背景降帧（每 ~33ms 画一次）
 * 3. 各层提供 OnFrame 回调，由外部注册渲染逻辑
 * 4. resize 时统一通知各层重算
 * 5. DOM overlay 层（z-index 30）由本管理器创建容器，供 UI 组件挂载
 */
import { RenderContext } from './RenderContext';
import { BG_FRAME_INTERVAL } from '@/Config/UiConstants';
import { LayoutManager } from '@/UI/Layout/LayoutManager';

/**
 * 各层渲染回调签名
 * @param Ts 当前时间戳（performance.now）
 * @param Dt 距上一帧的毫秒数
 */
export type LayerRenderFn = (Ts: number, Dt: number) => void;

/**
 * 分层 Canvas 配置
 */
export interface LayeredCanvasOptions {
  /** 背景层渲染回调 */
  OnBgFrame?: LayerRenderFn;
  /** 游戏主层渲染回调 */
  OnBoardFrame?: LayerRenderFn;
  /** 特效层渲染回调 */
  OnFxFrame?: LayerRenderFn;
}

/**
 * 三层 Canvas + DOM overlay 容器
 *
 * DOM 结构：
 *   <div class="layered-canvas">
 *     <canvas class="layer bg-canvas"></canvas>
 *     <canvas class="layer board-canvas"></canvas>
 *     <canvas class="layer fx-canvas"></canvas>
 *     <div class="ui-overlay"></div>
 *   </div>
 */
export class LayeredCanvas {
  /** 根容器 */
  readonly Root: HTMLElement;
  /** 三层 Canvas 元素 */
  readonly BgCanvas: HTMLCanvasElement;
  readonly BoardCanvas: HTMLCanvasElement;
  readonly FxCanvas: HTMLCanvasElement;
  /** DOM overlay 层（UI 组件挂载点） */
  readonly UiOverlay: HTMLElement;

  /** 三层渲染上下文 */
  readonly BgCtx: RenderContext;
  readonly BoardCtx: RenderContext;
  readonly FxCtx: RenderContext;

  private _RafId = 0;
  private _LastTs = 0;
  private _LastBgTs = 0;
  private _Running = false;
  /** 主层 + 特效层是否暂停（菜单/终局态省 CPU/GPU） */
  private _LayersPaused = false;
  private _FxActive = true;
  private readonly _OnBgFrame?: LayerRenderFn;
  private readonly _OnBoardFrame?: LayerRenderFn;
  private readonly _OnFxFrame?: LayerRenderFn;
  private readonly _Layout: LayoutManager;
  private readonly _UnsubResize: () => void;

  constructor(Parent: HTMLElement, Layout: LayoutManager, Opts: LayeredCanvasOptions = {}) {
    this._Layout = Layout;
    this._OnBgFrame = Opts.OnBgFrame;
    this._OnBoardFrame = Opts.OnBoardFrame;
    this._OnFxFrame = Opts.OnFxFrame;

    // 创建根容器
    this.Root = document.createElement('div');
    this.Root.className = 'layered-canvas';
    this.Root.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;';

    // 创建三层 Canvas
    this.BgCanvas = this._CreateCanvas('bg-canvas', 0);
    this.BoardCanvas = this._CreateCanvas('board-canvas', 10);
    this.FxCanvas = this._CreateCanvas('fx-canvas', 20);

    // DOM overlay
    this.UiOverlay = document.createElement('div');
    this.UiOverlay.className = 'ui-overlay';
    this.UiOverlay.style.cssText =
      'position:absolute;inset:0;z-index:30;pointer-events:none;';

    this.Root.append(this.BgCanvas, this.BoardCanvas, this.FxCanvas, this.UiOverlay);
    Parent.appendChild(this.Root);

    // 创建渲染上下文
    this.BgCtx = new RenderContext(this.BgCanvas);
    this.BoardCtx = new RenderContext(this.BoardCanvas);
    this.FxCtx = new RenderContext(this.FxCanvas);

    // 监听 resize（保存取消函数，Dispose 时精确移除自身）
    this._UnsubResize = this._Layout.On('Resize', () => {
      this.BgCtx.OnResize(this.BgCanvas);
      this.BoardCtx.OnResize(this.BoardCanvas);
      this.FxCtx.OnResize(this.FxCanvas);
    });
  }

  /**
   * 创建单个 Canvas 元素
   */
  private _CreateCanvas(ClassName: string, ZIndex: number): HTMLCanvasElement {
    const Cv = document.createElement('canvas');
    Cv.className = `layer ${ClassName}`;
    Cv.style.cssText = `position:absolute;inset:0;width:100%;height:100%;z-index:${ZIndex};pointer-events:none;`;
    return Cv;
  }

  /**
   * 启动渲染循环
   */
  Start(): void {
    if (this._Running) return;
    this._Running = true;
    this._LastTs = performance.now();
    this._LastBgTs = this._LastTs;
    this._RafId = requestAnimationFrame(this._Loop);
  }

  /**
   * 停止渲染循环
   */
  Stop(): void {
    this._Running = false;
    if (this._RafId !== 0) {
      cancelAnimationFrame(this._RafId);
      this._RafId = 0;
    }
  }

  /**
   * rAF 主循环
   * 背景降帧：距上次背景帧 >33ms 才画
   * 主层 + 特效层每帧画（除非 PauseLayers）
   */
  private _Loop = (Ts: number): void => {
    if (!this._Running) return;
    this._RafId = requestAnimationFrame(this._Loop);
    const Dt = Ts - this._LastTs;
    this._LastTs = Ts;

    // 背景降帧
    if (Ts - this._LastBgTs > BG_FRAME_INTERVAL) {
      this._OnBgFrame?.(Ts, Ts - this._LastBgTs);
      this._LastBgTs = Ts;
    }
    // 主层 + 特效层每帧——菜单/终局态暂停以省 CPU/GPU
    if (!this._LayersPaused) {
      this._OnBoardFrame?.(Ts, Dt);
      if (this._FxActive) {
        this._OnFxFrame?.(Ts, Dt);
      }
    }
  };

  /**
   * 暂停主层 + 特效层渲染（菜单态/终局态）
   * 背景星空层仍低频渲染，保持视觉氛围
   */
  PauseLayers(): void {
    this._LayersPaused = true;
    // 暂停时清空主层和特效层，避免残留
    this.BoardCtx.Clear();
    this.FxCtx.Clear();
  }

  /**
   * 恢复主层 + 特效层渲染
   */
  ResumeLayers(): void {
    this._LayersPaused = false;
  }

  PauseFx(): void {
    this._FxActive = false;
    this.FxCtx.Clear();
  }

  ResumeFx(): void {
    this._FxActive = true;
  }

  /**
   * 销毁：停止循环 + 移除监听 + 清理 DOM
   */
  Dispose(): void {
    this.Stop();
    this._UnsubResize();
    this.Root.remove();
  }
}
