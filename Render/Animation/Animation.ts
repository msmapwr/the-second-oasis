/**
 * src/Render/Animation/Animation.ts
 * 操作类型：新建
 *
 * Canvas 动画基类
 *
 * 设计要点：
 * 1. 所有动画统一由 AnimationManager 在每帧 rAF 中驱动
 * 2. 子类只关心 Update（推进逻辑）和 Render（绘制），不自己开循环
 * 3. 完成时统一回调 OnDone，便于编排顺序
 * 4. 支持 Finish 强制结束，用于跳过动画或 ReducedMotion 模式
 */
import type { RenderContext } from '@/Render/RenderContext';

let _GlobalId = 0;

/**
 * 生成唯一动画 ID（测试友好，单递增）
 */
function _NextId(): string {
  _GlobalId += 1;
  return `anim_${_GlobalId}`;
}

/**
 * 抽象动画基类
 */
export abstract class Animation {
  readonly Id: string;

  /** 总时长（ms） */
  readonly Duration: number;

  /** 已运行时间（ms） */
  protected _Elapsed = 0;

  private _Finished = false;
  private _OnDone?: () => void;

  /**
   * @param Duration 动画总时长，必须 > 0
   * @param OnDone 动画自然结束或 Finish 后调用一次
   */
  constructor(Duration: number, OnDone?: () => void) {
    if (Duration <= 0) {
      throw new Error('动画时长必须大于 0');
    }
    this.Id = _NextId();
    this.Duration = Duration;
    this._OnDone = OnDone;
  }

  /**
   * 推进动画时间，子类可覆盖以加入特殊逻辑
   */
  Update(Dt: number): void {
    this._Elapsed += Dt;
  }

  /**
   * 绘制当前帧，由 AnimationManager 在 rAF 中调用
   */
  abstract Render(Ctx: RenderContext): void;

  /**
   * 当前进度 [0, 1]，子类常用
   */
  protected get _Progress(): number {
    return Math.min(1, this._Elapsed / this.Duration);
  }

  /**
   * 是否已自然结束
   */
  get IsFinished(): boolean {
    return this._Finished || this._Elapsed >= this.Duration;
  }

  /**
   * 强制结束动画并触发回调
   */
  Finish(): void {
    if (this._Finished) return;
    this._Finished = true;
    this._Elapsed = this.Duration;
    const Fn = this._OnDone;
    this._OnDone = undefined;
    if (Fn) Fn();
  }

  /**
   * 内部完成检查，由 AnimationManager 调用以触发回调
   */
  _CheckFinish(): void {
    if (this.IsFinished && !this._Finished) {
      this._Finished = true;
      const Fn = this._OnDone;
      this._OnDone = undefined;
      if (Fn) Fn();
    }
  }

  /**
   * 资源释放钩子，由 AnimationManager 在清理时调用
   * 子类可覆盖以移除 DOM 元素或释放其它资源
   */
  Dispose(): void {
    // 默认空实现
  }
}
