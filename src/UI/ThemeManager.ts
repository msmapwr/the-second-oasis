/**
 * src/UI/ThemeManager.ts
 * 操作类型：新建
 *
 * 主题管理器：亮/暗模式切换 + localStorage 持久化
 * 通过 data-theme 属性切换 CSS 变量，所有 DOM 组件响应变化
 */

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'second-oasis-theme';
const THEME_ATTR = 'data-theme';

class ThemeManager {
  private _Current: ThemeMode = 'dark';
  private _Listeners: Set<(Mode: ThemeMode) => void> = new Set();

  constructor() {
    this._Load();
  }

  get Current(): ThemeMode {
    return this._Current;
  }

  get IsLight(): boolean {
    return this._Current === 'light';
  }

  get IsDark(): boolean {
    return this._Current === 'dark';
  }

  Toggle(): ThemeMode {
    this.Set(this._Current === 'dark' ? 'light' : 'dark');
    return this._Current;
  }

  Set(Mode: ThemeMode): void {
    if (this._Current === Mode) return;
    this._Current = Mode;
    this._Apply();
    this._Save();
    this._Notify();
  }

  OnChange(Fn: (Mode: ThemeMode) => void): () => void {
    this._Listeners.add(Fn);
    return () => this._Listeners.delete(Fn);
  }

  private _Load(): void {
    try {
      const Stored = localStorage.getItem(STORAGE_KEY);
      if (Stored === 'light' || Stored === 'dark') {
        this._Current = Stored;
      } else {
        const PrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this._Current = PrefersDark ? 'dark' : 'light';
      }
    } catch {
      this._Current = 'dark';
    }
    this._Apply();
  }

  private _Save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, this._Current);
    } catch {
      // localStorage 不可用时静默失败
    }
  }

  private _Apply(): void {
    document.documentElement.setAttribute(THEME_ATTR, this._Current);
  }

  private _Notify(): void {
    for (const Fn of this._Listeners) {
      Fn(this._Current);
    }
  }
}

export const ThemeManagerInstance = new ThemeManager();
