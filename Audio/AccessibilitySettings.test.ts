/**
 * src/Audio/AccessibilitySettings.test.ts
 * 操作类型：新建
 *
 * 可访问性设置测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccessibilitySettings } from './AccessibilitySettings';

function _CreateStorageMock(): Record<string, string> {
  return {};
}

function _MockLocalStorage(Store: Record<string, string>): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (Key: string) => Store[Key] ?? null,
      setItem: (Key: string, Value: string) => {
        Store[Key] = Value;
      },
      removeItem: (Key: string) => {
        delete Store[Key];
      },
    },
    writable: true,
  });
}

describe('AccessibilitySettings', () => {
  let Store: Record<string, string>;

  beforeEach(() => {
    Store = _CreateStorageMock();
    _MockLocalStorage(Store);
  });

  it('默认全部关闭', () => {
    const S = new AccessibilitySettings();
    expect(S.Muted).toBe(false);
    expect(S.ReducedMotion).toBe(false);
  });

  it('从 localStorage 读取已保存的静音状态', () => {
    Store.oasis_muted = 'true';
    const S = new AccessibilitySettings();
    expect(S.Muted).toBe(true);
  });

  it('从 localStorage 读取已保存的减少动画状态', () => {
    Store.oasis_reduced_motion = 'true';
    const S = new AccessibilitySettings();
    expect(S.ReducedMotion).toBe(true);
  });

  it('设置静音会发射事件并写入 localStorage', () => {
    const S = new AccessibilitySettings();
    const Fn = vi.fn();
    S.On('MutedChanged', Fn);

    S.SetMuted(true);

    expect(S.Muted).toBe(true);
    expect(Store.oasis_muted).toBe('true');
    expect(Fn).toHaveBeenCalledTimes(1);
    expect(Fn).toHaveBeenLastCalledWith(true);
  });

  it('设置相同值不会重复发射事件', () => {
    const S = new AccessibilitySettings();
    const Fn = vi.fn();
    S.On('MutedChanged', Fn);

    S.SetMuted(false);

    expect(Fn).not.toHaveBeenCalled();
  });

  it('减少动画变化也会持久化', () => {
    const S = new AccessibilitySettings();
    S.SetReducedMotion(true);
    expect(S.ReducedMotion).toBe(true);
    expect(Store.oasis_reduced_motion).toBe('true');
  });

  it('localStorage 异常时不会抛错', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => {
          throw new Error('quota');
        },
        setItem: () => {
          throw new Error('quota');
        },
      },
      writable: true,
    });

    const S = new AccessibilitySettings();
    expect(() => S.SetMuted(true)).not.toThrow();
    expect(S.Muted).toBe(true);
  });
});
