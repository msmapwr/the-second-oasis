/**
 * src/Render/Animation/AnimationManager.ts
 * 操作类型：新建
 *
 * 动画时间线管理中心
 *
 * 设计要点：
 * 1. 单一入口 UpdateAndRender，挂在 LayeredCanvas 的 fx 层 rAF 中
 * 2. 维护活跃动画列表，自动清理已完成动画
 * 3. 配合 AccessibilitySettings.ReducedMotion 缩短或跳过动画
 * 4. 不直接引用业务逻辑，只管理动画生命周期
 */
import type { RenderContext } from '@/Render/RenderContext';
import type { AccessibilitySettings } from '@/Audio/AccessibilitySettings';
import { Animation } from './Animation';

/** 减少动画模式下的时长倍率 */
const REDUCED_MOTION_MULT = 0.25;

export class AnimationManager {
  private readonly _Animations = new Map<string, Animation>();
  private readonly _Settings: AccessibilitySettings;

  constructor(Settings: AccessibilitySettings) {
    this._Settings = Settings;
  }

  /**
   * 注册新动画并返回其 ID
   */
  Add(Anim: Animation): string {
    this._Animations.set(Anim.Id, Anim);
    return Anim.Id;
  }

  /**
   * 按 ID 移除动画（不触发完成回调）
   */
  Remove(Id: string): void {
    this._Animations.delete(Id);
  }

  /**
   * 是否存在未完成的动画
   */
  get HasActive(): boolean {
    for (const Anim of this._Animations.values()) {
      if (!Anim.IsFinished) return true;
    }
    return false;
  }

  /**
   * 更新并渲染所有活跃动画
   * 由 LayeredCanvas 的 OnFxFrame 回调每帧调用
   */
  UpdateAndRender(_Ts: number, Dt: number, Ctx: RenderContext): void {
    const Multiplier = this._Settings.ReducedMotion ? REDUCED_MOTION_MULT : 1;
    const AdjustedDt = Dt * Multiplier;

    for (const Anim of this._Animations.values()) {
      Anim.Update(AdjustedDt);
      Anim.Render(Ctx);
      Anim._CheckFinish();
    }

    this._CleanupFinished();
  }

  /**
   * 清空所有动画，常用于场景切换
   */
  Clear(): void {
    this._Animations.clear();
  }

  /**
   * 移除已完成的动画
   */
  private _CleanupFinished(): void {
    for (const [Id, Anim] of this._Animations) {
      if (Anim.IsFinished) {
        Anim.Dispose();
        this._Animations.delete(Id);
      }
    }
  }
}
