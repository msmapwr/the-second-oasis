/**
 * src/UI/Layout/LayoutManager.ts
 * 操作类型：新建
 *
 * 响应式布局管理器
 * 关联：B 阶段架构方案 §5.8
 *
 * 设计要点：
 * 1. 监听 window resize，防抖后广播 LayoutConfig
 * 2. 提供 Current 快照供初始化读取
 * 3. 继承 EventEmitter，订阅 'Resize' 即可响应布局变化
 * 4. Canvas 尺寸/格子几何/粒子坐标重映射均由订阅者自行处理
 */
import { EventEmitter } from '@/Store/EventEmitter';
import { BREAKPOINTS, type LayoutConfig, type LayoutMode } from './Breakpoints';

/**
 * LayoutManager 事件
 *
 * 注意：必须是 type alias 而非 interface，否则不满足 EventMap 约束
 */
export type LayoutEvents = {
  /** 尺寸/模式变化（防抖后） */
  Resize: LayoutConfig;
};

/**
 * 防抖延迟（ms），避免 resize 事件高频触发
 */
const RESIZE_DEBOUNCE = 100;

export class LayoutManager extends EventEmitter<LayoutEvents> {
  private readonly _Breakpoint: number;
  private _Current: LayoutConfig;
  private _DebounceId: number | null = null;

  constructor(Breakpoint: number = BREAKPOINTS.Mobile) {
    super();
    this._Breakpoint = Breakpoint;
    this._Current = this._Compute();
    // 绑定 resize（箭头函数保持 this）
    window.addEventListener('resize', this._OnResize);
    window.addEventListener('orientationchange', this._OnResize);
  }

  /** 当前布局配置 */
  get Current(): LayoutConfig {
    return this._Current;
  }

  /** 当前布局模式（便捷访问） */
  get Mode(): LayoutMode {
    return this._Current.Mode;
  }

  /** 是否移动端 */
  get IsMobile(): boolean {
    return this._Current.Mode === 'Mobile';
  }

  /**
   * 计算当前布局配置
   */
  private _Compute(): LayoutConfig {
    return {
      Mode: window.innerWidth < this._Breakpoint ? 'Mobile' : 'Desktop',
      Width: window.innerWidth,
      Height: window.innerHeight,
      Dpr: window.devicePixelRatio || 1,
    };
  }

  /**
   * resize 回调（防抖）
   */
  private _OnResize = (): void => {
    if (this._DebounceId !== null) {
      clearTimeout(this._DebounceId);
    }
    this._DebounceId = window.setTimeout(() => {
      this._DebounceId = null;
      const Next = this._Compute();
      // 仅在尺寸或模式真正变化时广播
      if (
        Next.Width !== this._Current.Width ||
        Next.Height !== this._Current.Height ||
        Next.Mode !== this._Current.Mode ||
        Next.Dpr !== this._Current.Dpr
      ) {
        this._Current = Next;
        this.Emit('Resize', Next);
      }
    }, RESIZE_DEBOUNCE);
  };

  /**
   * 销毁，移除监听
   */
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
