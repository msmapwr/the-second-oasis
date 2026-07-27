/**
 * src/Audio/AccessibilitySettings.ts
 * 操作类型：新建
 *
 * 可访问性全局开关：静音 + 减少动画
 *
 * 设计要点：
 * 1. 先埋设接口，后续设置 UI 直接读写即可，无需再改动画/音频系统
 * 2. 默认值从 localStorage 读取，刷新页面保留用户偏好
 * 3. 使用 EventEmitter 模式发送变化通知，便于跨模块联动
 * 4. 在 SSR/测试环境无 localStorage 时静默回退，不抛错
 */
import { EventEmitter, type Listener } from '@/Store/EventEmitter';

const STORAGE_MUTED = 'oasis_muted';
const STORAGE_REDUCED_MOTION = 'oasis_reduced_motion';

export type AccessibilityEvents = {
  MutedChanged: boolean;
  ReducedMotionChanged: boolean;
};

/**
 * 读取 localStorage 布尔值，缺失或异常时返回默认值
 */
function _ReadBool(Key: string, Default: boolean): boolean {
  if (typeof localStorage === 'undefined') return Default;
  try {
    const Raw = localStorage.getItem(Key);
    if (Raw === null) return Default;
    return Raw === 'true';
  } catch {
    return Default;
  }
}

/**
 * 写入 localStorage 布尔值，异常时静默忽略
 */
function _WriteBool(Key: string, Value: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(Key, String(Value));
  } catch {
    // 隐私模式或 SSR 下写入可能失败，不影响游戏运行
  }
}

/**
 * 可访问性设置
 *
 * 用法：
 *   const Settings = new AccessibilitySettings();
 *   Settings.SetMuted(true);
 *   Settings.On('MutedChanged', (V) => AudioEngine.SetMuted(V));
 */
export class AccessibilitySettings extends EventEmitter<AccessibilityEvents> {
  private _Muted: boolean;
  private _ReducedMotion: boolean;

  constructor() {
    super();
    this._Muted = _ReadBool(STORAGE_MUTED, false);
    this._ReducedMotion = _ReadBool(STORAGE_REDUCED_MOTION, false);
  }

  get Muted(): boolean {
    return this._Muted;
  }

  SetMuted(Val: boolean): void {
    if (this._Muted === Val) return;
    this._Muted = Val;
    _WriteBool(STORAGE_MUTED, Val);
    this.Emit('MutedChanged', Val);
  }

  get ReducedMotion(): boolean {
    return this._ReducedMotion;
  }

  SetReducedMotion(Val: boolean): void {
    if (this._ReducedMotion === Val) return;
    this._ReducedMotion = Val;
    _WriteBool(STORAGE_REDUCED_MOTION, Val);
    this.Emit('ReducedMotionChanged', Val);
  }

  /**
   * 重载父类 On 以收紧返回类型，方便外部使用
   */
  On<K extends keyof AccessibilityEvents>(
    Type: K,
    Fn: Listener<AccessibilityEvents[K]>,
  ): () => void {
    return super.On(Type, Fn);
  }
}
