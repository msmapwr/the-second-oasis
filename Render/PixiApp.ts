import { Application, Container, type ICanvas } from 'pixi.js';
import { LayoutManager } from '@/UI/Layout/LayoutManager';

export class PixiApp {
  readonly App: Application;
  readonly BgContainer: Container;
  readonly BoardContainer: Container;
  readonly FxContainer: Container;
  readonly Canvas: HTMLCanvasElement;

  private _Running = false;
  private _LayersPaused = false;
  private _OnBgFrame?: (Ts: number, Dt: number) => void;
  private _OnBoardFrame?: (Ts: number, Dt: number) => void;
  private _OnFxFrame?: (Ts: number, Dt: number) => void;
  private readonly _Parent: HTMLElement;
  private readonly _UnsubResize: () => void;

  constructor(Parent: HTMLElement, Layout: LayoutManager, Opts: {
    OnBgFrame?: (Ts: number, Dt: number) => void;
    OnBoardFrame?: (Ts: number, Dt: number) => void;
    OnFxFrame?: (Ts: number, Dt: number) => void;
  } = {}) {
    this._Parent = Parent;
    this.App = new Application();
    this._OnBgFrame = Opts.OnBgFrame;
    this._OnBoardFrame = Opts.OnBoardFrame;
    this._OnFxFrame = Opts.OnFxFrame;

    this.BgContainer = new Container();
    this.BoardContainer = new Container();
    this.FxContainer = new Container();

    this.Canvas = document.createElement('canvas');
    this.Canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    Parent.appendChild(this.Canvas);

    this._UnsubResize = Layout.On('Resize', () => {
      try {
        this.App.renderer.resize(this._Parent.clientWidth, this._Parent.clientHeight);
      } catch {
        // Renderer not initialized yet
      }
    });
  }

  async Init(): Promise<void> {
    await this.App.init({
      canvas: this.Canvas as unknown as ICanvas,
      backgroundAlpha: 0,
      resizeTo: this._Parent,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    this.App.stage.addChild(this.BgContainer, this.BoardContainer, this.FxContainer);
    this.App.ticker.add((Ticker) => this._Tick(Ticker));
    this._Running = true;
  }

  private _Tick(Ticker: { deltaMS: number }): void {
    if (!this._Running) return;
    const Ts = performance.now();
    const Dt = Ticker.deltaMS;
    if (this._LayersPaused) {
      this._OnBgFrame?.(Ts, Dt);
      return;
    }
    this._OnBgFrame?.(Ts, Dt);
    this._OnBoardFrame?.(Ts, Dt);
    this._OnFxFrame?.(Ts, Dt);
  }

  PauseLayers(): void {
    this._LayersPaused = true;
    this.BoardContainer.visible = false;
    this.FxContainer.visible = false;
  }

  ResumeLayers(): void {
    this._LayersPaused = false;
    this.BoardContainer.visible = true;
    this.FxContainer.visible = true;
  }

  Stop(): void {
    this._Running = false;
    try {
      this.App.ticker.stop();
    } catch {
      // Ticker may not be initialized
    }
  }

  Dispose(): void {
    this.Stop();
    this._UnsubResize();
    try {
      this.App.destroy({ removeView: false });
    } catch {
      // Ignore cleanup errors
    }
    this.Canvas.remove();
  }

  get Width(): number {
    try {
      return this.App.screen.width;
    } catch {
      return this._Parent.clientWidth;
    }
  }

  get Height(): number {
    try {
      return this.App.screen.height;
    } catch {
      return this._Parent.clientHeight;
    }
  }
}
