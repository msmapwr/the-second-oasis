/**
 * src/App/InputGate.test.ts
 * 操作类型：新建
 *
 * InputGate 单元测试
 */
import { describe, it, expect } from 'vitest';
import { InputGate } from './InputGate';
import { DiceMode } from '@/Types/Dice';

describe('InputGate', () => {
  it('RequestMode 返回 Promise，SubmitMode resolve', async () => {
    const Gate = new InputGate();
    const Promise_ = Gate.RequestMode();
    Gate.SubmitMode(DiceMode.Steady);
    const Mode = await Promise_;
    expect(Mode).toBe(DiceMode.Steady);
  });

  it('SubmitMode 无 resolver 时被忽略', () => {
    const Gate = new InputGate();
    expect(() => Gate.SubmitMode(DiceMode.Aggressive)).not.toThrow();
  });

  it('动画中 SubmitMode 被忽略', async () => {
    const Gate = new InputGate();
    const Promise_ = Gate.RequestMode();
    Gate.SetAnimating(true);
    Gate.SubmitMode(DiceMode.Steady); // 应被忽略
    // Promise 仍未 resolve
    let Resolved = false;
    Promise_.then(() => { Resolved = true; });
    await new Promise((R) => setTimeout(R, 10));
    expect(Resolved).toBe(false);
    // 结束动画后可提交
    Gate.SetAnimating(false);
    Gate.SubmitMode(DiceMode.Aggressive);
    const Mode = await Promise_;
    expect(Mode).toBe(DiceMode.Aggressive);
  });

  it('RequestLaunch + SubmitLaunch', async () => {
    const Gate = new InputGate();
    const Promise_ = Gate.RequestLaunch();
    Gate.SubmitLaunch();
    await expect(Promise_).resolves.toBeUndefined();
  });

  it('RequestTiebreaker + SubmitTiebreaker', async () => {
    const Gate = new InputGate();
    const Promise_ = Gate.RequestTiebreaker();
    Gate.SubmitTiebreaker();
    await expect(Promise_).resolves.toBeUndefined();
  });

  it('IsAnimating 初始为 false', () => {
    const Gate = new InputGate();
    expect(Gate.IsAnimating).toBe(false);
  });

  it('SetAnimating 发射 AnimatingChanged 事件', () => {
    const Gate = new InputGate();
    const States: boolean[] = [];
    Gate.On('AnimatingChanged', (V) => States.push(V));
    Gate.SetAnimating(true);
    Gate.SetAnimating(false);
    expect(States).toEqual([true, false]);
  });

  it('SetAnimating 相同值不重复发射事件', () => {
    const Gate = new InputGate();
    let Count = 0;
    Gate.On('AnimatingChanged', () => Count++);
    Gate.SetAnimating(true);
    Gate.SetAnimating(true); // 相同，不发射
    expect(Count).toBe(1);
  });

  it('WaitingForMode 事件在 RequestMode 时发射', () => {
    const Gate = new InputGate();
    let Emitted = false;
    Gate.On('WaitingForMode', () => { Emitted = true; });
    Gate.RequestMode();
    expect(Emitted).toBe(true);
  });

  it('IsWaitingForMode 状态正确', () => {
    const Gate = new InputGate();
    expect(Gate.IsWaitingForMode).toBe(false);
    Gate.RequestMode();
    expect(Gate.IsWaitingForMode).toBe(true);
    Gate.SubmitMode(DiceMode.None);
    expect(Gate.IsWaitingForMode).toBe(false);
  });

  it('CancelAll 清除所有 resolver', () => {
    const Gate = new InputGate();
    Gate.RequestMode();
    Gate.RequestLaunch();
    Gate.CancelAll();
    expect(Gate.IsWaitingForMode).toBe(false);
    expect(Gate.IsWaitingForLaunch).toBe(false);
    expect(Gate.IsAnimating).toBe(false);
  });
});
