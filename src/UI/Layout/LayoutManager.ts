/**
 * src/UI/Layout/LayoutManager.ts
 * 操作类型：重写
 *
 * 响应式布局管理器
 * 关联：v1.4.1 响应式三档布局
 *
 * 设计要点：
 * 1. DeviceClass 三档：Phone ≤480 / Tablet 481~1024 / Desktop >1024
 * 2. 监听 resize + orientationchange，防抖后广播
 * 3. IsPhone / IsTablet / IsDesktop 便捷访问器
 */
import { EventEmitter } from '@/Store/EventEmitter';
import { type LayoutConfig, type DeviceClass } from './Breakpoints';
import { DetectDeviceClass, DetectLayoutMode } from './Breakpoints';

export type LayoutEvents = {
  Resize: LayoutConfig;
};

const RESIZE_DEBOUNCE = 100;

export class LayoutManager extends EventEmitter<LayoutEvents> {
  private _Current: LayoutConfig;
  private _DebounceId: number | null = null;

  constructor() {
    super();
    this._Current = this._Compute();
    window.addEventListener('resize', this._OnResize);
    window.addEventListener('orientationchange', this._OnResize);
  }

  get Current(): LayoutConfig {
    return this._Current;
  }

  get Mode() {
    return this._Current.Mode;
  }

  get Device(): DeviceClass {
    return this._Current.Device;
  }

  get IsPhone(): boolean {
    return this._Current.Device === 'Phone';
  }

  get IsTablet(): boolean {
    return this._Current.Device === 'Tablet';
  }

  get IsDesktop(): boolean {
    return this._Current.Device === 'Desktop';
  }

  get IsMobile(): boolean {
    return this._Current.Mode === 'Mobile';
  }

  private _Compute(): LayoutConfig {
    const W = window.innerWidth;
    return {
      Mode: DetectLayoutMode(W),
      Device: DetectDeviceClass(W),
      Width: W,
      Height: window.innerHeight,
      Dpr: window.devicePixelRatio || 1,
    };
  }

  private _OnResize = (): void => {
    if (this._DebounceId !== null) clearTimeout(this._DebounceId);
    this._DebounceId = window.setTimeout(() => {
      this._DebounceId = null;
      const Next = this._Compute();
      if (
        Next.Width !== this._Current.Width ||
        Next.Height !== this._Current.Height ||
        Next.Device !== this._Current.Device ||
        Next.Dpr !== this._Current.Dpr
      ) {
        this._Current = Next;
        this.Emit('Resize', Next);
      }
    }, RESIZE_DEBOUNCE);
  };

  Dispose(): void {
    window.removeEventListener('resize', this._OnResize);
    window.removeEventListener('orientationchange', this._OnResize);
    if (this._DebounceId !== null) {
      clearTimeout(this._DebounceId);
      this._DebounceId = null;
    }
    this.Off();
  }
}
