/**
 * src/Render/Animation/ChainBadgeAnimation.test.ts
 * 操作类型：新建
 *
 * 开发链徽章动画测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ChainBadgeAnimation } from './ChainBadgeAnimation';
import { InstallFakeDom, ResetFakeDom, FakeElement } from './TestDom';

describe('ChainBadgeAnimation', () => {
  beforeEach(() => {
    ResetFakeDom();
    InstallFakeDom();
  });

  it.each(['X2', 'X3', 'Break'] as const)('创建 %s 徽章', (Type) => {
    const Anim = new ChainBadgeAnimation(document.body, 100, 100, Type);
    const El = Anim['_El'] as unknown as FakeElement;
    expect(El.textContent).toBeTruthy();
    Anim.Dispose();
  });

  it('断链徽章显示红色', () => {
    const Anim = new ChainBadgeAnimation(document.body, 100, 100, 'Break');
    const El = Anim['_El'] as unknown as FakeElement;
    expect(El.style.cssText).toContain('#EF4444');
    Anim.Dispose();
  });

  it('更新时改变位置和缩放', () => {
    const Anim = new ChainBadgeAnimation(document.body, 100, 100, 'X3');
    const El = Anim['_El'] as unknown as FakeElement;
    const Before = El.style.transform;

    Anim.Update(450);

    expect(El.style.transform).not.toBe(Before);
    Anim.Dispose();
  });

  it('Dispose 后标记移除', () => {
    const Anim = new ChainBadgeAnimation(document.body, 100, 100, 'X2');
    const El = Anim['_El'] as unknown as FakeElement;
    Anim.Dispose();
    expect(El.IsRemoved).toBe(true);
  });
});
