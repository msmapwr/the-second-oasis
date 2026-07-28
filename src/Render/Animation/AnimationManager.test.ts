/**
 * src/Render/Animation/AnimationManager.test.ts
 * 操作类型：新建
 *
 * 动画管理器测试
 */
import { describe, it, expect, vi } from 'vitest';
import { AnimationManager } from './AnimationManager';
import { Animation } from './Animation';
import { AccessibilitySettings } from '@/Audio/AccessibilitySettings';
import type { RenderContext } from '@/Render/RenderContext';

class TestAnim extends Animation {
  RenderCount = 0;
  DoneCount = 0;

  constructor(Duration: number, OnDone?: () => void) {
    super(Duration, OnDone);
  }

  Update(Dt: number): void {
    super.Update(Dt);
  }

  Render(_Ctx: RenderContext): void {
    this.RenderCount += 1;
  }
}

function _MakeManager(Reduced = false): {
  Manager: AnimationManager;
  Settings: AccessibilitySettings;
} {
  const Settings = new AccessibilitySettings();
  Settings.SetReducedMotion(Reduced);
  return { Manager: new AnimationManager(Settings), Settings };
}

function _MockCtx(): RenderContext {
  // RenderContext 依赖真实 Canvas，测试里只验证生命周期，无需真实绘制
  return {} as RenderContext;
}

describe('AnimationManager', () => {
  it('添加动画后返回 ID', () => {
    const { Manager } = _MakeManager();
    const Anim = new TestAnim(1000);
    const Id = Manager.Add(Anim);
    expect(Id).toBe(Anim.Id);
  });

  it('更新并渲染动画', () => {
    const { Manager } = _MakeManager();
    const Anim = new TestAnim(1000);
    Manager.Add(Anim);

    Manager.UpdateAndRender(0, 16, _MockCtx());

    expect(Anim.RenderCount).toBe(1);
  });

  it('动画结束后自动清理', () => {
    const { Manager } = _MakeManager();
    const Anim = new TestAnim(100);
    Manager.Add(Anim);

    Manager.UpdateAndRender(0, 200, _MockCtx());

    expect(Anim.IsFinished).toBe(true);
    expect(Manager.HasActive).toBe(false);
  });

  it('触发完成回调', () => {
    const { Manager } = _MakeManager();
    const Done = vi.fn();
    const Anim = new TestAnim(100, Done);
    Manager.Add(Anim);

    Manager.UpdateAndRender(0, 200, _MockCtx());

    expect(Done).toHaveBeenCalledTimes(1);
  });

  it('移除动画不触发回调', () => {
    const { Manager } = _MakeManager();
    const Done = vi.fn();
    const Anim = new TestAnim(100, Done);
    const Id = Manager.Add(Anim);

    Manager.Remove(Id);
    Manager.UpdateAndRender(0, 200, _MockCtx());

    expect(Done).not.toHaveBeenCalled();
  });

  it('减少动画模式加速时间流逝', () => {
    const { Manager } = _MakeManager(true);
    const Anim = new TestAnim(100);
    Manager.Add(Anim);

    // 正常 16ms 在 ReducedMotion 下被乘以 0.25，即 4ms
    Manager.UpdateAndRender(0, 16, _MockCtx());

    expect(Anim.IsFinished).toBe(false);
    Manager.UpdateAndRender(16, 400, _MockCtx());
    expect(Anim.IsFinished).toBe(true);
  });

  it('Clear 清空所有动画', () => {
    const { Manager } = _MakeManager();
    Manager.Add(new TestAnim(1000));
    Manager.Add(new TestAnim(1000));

    Manager.Clear();

    expect(Manager.HasActive).toBe(false);
  });
});
