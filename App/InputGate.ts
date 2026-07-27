/**
 * src/App/InputGate.ts
 * 操作类型：新建
 *
 * 输入门控：阻塞等待用户输入 + 动画期间禁用操作
 * 关联：B 阶段架构方案 §4.2
 *
 * 设计要点：
 * 1. Promise + resolver 模式：RequestMode() 返回 Promise，SubmitMode() resolve
 * 2. 动画期间 SetAnimating(true)，所有 Submit 被忽略，防止重复提交
 * 3. AppController 用 await InputGate.RequestMode() 阻塞主循环
 * 4. 未来 D 优先级（AI）：AI 适配器可直接调用 SubmitMode()，无需 UI 点击
 */
import { DiceMode } from '@/Types/Dice';

/**
 * InputGate 事件
 * 用于 UI 层响应门控状态变化（如禁用/启用按钮）
 *
 * 注意：必须是 type alias 而非 interface，否则不满足 EventMap 约束
 */
export type InputGateEvents = {
  /** 动画状态变化（true=开始动画禁用输入，false=结束动画恢复输入） */
  AnimatingChanged: boolean;
  /** 等待模式选择（UI 此时应启用模式按钮） */
  WaitingForMode: void;
  /** 等待发射确认（UI 此时应显示发射按钮） */
  WaitingForLaunch: void;
  /** 等待加赛确认 */
  WaitingForTiebreaker: void;
};

import { EventEmitter } from '@/Store/EventEmitter';

export class InputGate extends EventEmitter<InputGateEvents> {
  private _ModeResolver: ((M: DiceMode) => void) | null = null;
  private _LaunchResolver: (() => void) | null = null;
  private _TiebreakerResolver: (() => void) | null = null;
  private _IsAnimating = false;
  private _Cancelled = false;

  get IsAnimating(): boolean {
    return this._IsAnimating;
  }

  get Cancelled(): boolean {
    return this._Cancelled;
  }

  SetAnimating(Value: boolean): void {
    if (this._IsAnimating === Value) return;
    this._IsAnimating = Value;
    this.Emit('AnimatingChanged', Value);
  }

  RequestMode(): Promise<DiceMode> {
    this._Cancelled = false;
    this.Emit('WaitingForMode', undefined);
    return new Promise<DiceMode>((Resolve) => {
      this._ModeResolver = Resolve;
    });
  }

  SubmitMode(Mode: DiceMode): void {
    if (this._IsAnimating || this._ModeResolver === null) return;
    const Resolve = this._ModeResolver;
    this._ModeResolver = null;
    Resolve(Mode);
  }

  RequestLaunch(): Promise<void> {
    this._Cancelled = false;
    this.Emit('WaitingForLaunch', undefined);
    return new Promise<void>((Resolve) => {
      this._LaunchResolver = Resolve;
    });
  }

  SubmitLaunch(): void {
    if (this._IsAnimating || this._LaunchResolver === null) return;
    const Resolve = this._LaunchResolver;
    this._LaunchResolver = null;
    Resolve();
  }

  RequestTiebreaker(): Promise<void> {
    this._Cancelled = false;
    this.Emit('WaitingForTiebreaker', undefined);
    return new Promise<void>((Resolve) => {
      this._TiebreakerResolver = Resolve;
    });
  }

  SubmitTiebreaker(): void {
    if (this._IsAnimating || this._TiebreakerResolver === null) return;
    const Resolve = this._TiebreakerResolver;
    this._TiebreakerResolver = null;
    Resolve();
  }

  CancelAll(): void {
    this._Cancelled = true;
    if (this._ModeResolver) {
      this._ModeResolver(DiceMode.None);
      this._ModeResolver = null;
    }
    if (this._LaunchResolver) {
      this._LaunchResolver();
      this._LaunchResolver = null;
    }
    if (this._TiebreakerResolver) {
      this._TiebreakerResolver();
      this._TiebreakerResolver = null;
    }
    this._IsAnimating = false;
  }

  /** 键盘事件处理器引用（用于解绑） */
  private _KeyHandler: ((E: KeyboardEvent) => void) | null = null;

  /**
   * 绑定键盘快捷键，实现免鼠标操作
   * 1/2/3 → 稳健/激进/不开发；空格/回车 → 发射或加赛
   * 仅在对应输入等待时生效，其他按键直接忽略；不等待时不监听
   * 注意：需在游戏结束/退出时调用 UnbindKeyboard 清理
   */
  BindKeyboard(): void {
    if (this._KeyHandler !== null) return;
    this._KeyHandler = (E: KeyboardEvent): void => {
      if (this._LaunchResolver !== null) {
        if (E.key === ' ' || E.key === 'Enter') {
          E.preventDefault();
          this.SubmitLaunch();
        }
        return;
      }
      if (this._TiebreakerResolver !== null) {
        if (E.key === ' ' || E.key === 'Enter') {
          E.preventDefault();
          this.SubmitTiebreaker();
        }
        return;
      }
      if (this._ModeResolver !== null) {
        if (E.key === '1') {
          E.preventDefault();
          this.SubmitMode('Steady' as DiceMode);
        } else if (E.key === '2') {
          E.preventDefault();
          this.SubmitMode('Aggressive' as DiceMode);
        } else if (E.key === '3') {
          E.preventDefault();
          this.SubmitMode('None' as DiceMode);
        }
      }
    };
    document.addEventListener('keydown', this._KeyHandler);
  }

  /**
   * 解绑键盘快捷键（游戏结束/退出时调用，避免泄漏到其它界面）
   */
  UnbindKeyboard(): void {
    if (this._KeyHandler === null) return;
    document.removeEventListener('keydown', this._KeyHandler);
    this._KeyHandler = null;
  }

  /**
   * 当前是否正在等待模式选择
   */
  get IsWaitingForMode(): boolean {
    return this._ModeResolver !== null;
  }

  /**
   * 当前是否正在等待发射确认
   */
  get IsWaitingForLaunch(): boolean {
    return this._LaunchResolver !== null;
  }
}
