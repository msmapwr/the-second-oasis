/**
 * src/Render/Animation/NumberPopAnimation.test.ts
 * 操作类型：新建
 *
 * 数字弹出动画测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NumberPopAnimation } from './NumberPopAnimation';
import { InstallFakeDom, ResetFakeDom, FakeElement } from './TestDom';

describe('NumberPopAnimation', () => {
  beforeEach(() => {
    ResetFakeDom();
    InstallFakeDom();
  });

  it('创建正数弹出元素', () => {
    const Anim = new NumberPopAnimation(document.body, 100, 200, 5);
    expect(document.body.textContent).toContain('+5');
    Anim.Dispose();
  });

  it('创建负数弹出元素', () => {
    const Anim = new NumberPopAnimation(document.body, 100, 200, -3);
    expect(document.body.textContent).toContain('-3');
    Anim.Dispose();
  });

  it('更新时会改变位置和透明度', () => {
    const Anim = new NumberPopAnimation(document.body, 100, 200, 5);
    const El = Anim['_El'] as unknown as FakeElement;
    const Before = El.style.transform;

    Anim.Update(350); // 50% 进度

    expect(El.style.transform).not.toBe(Before);
    expect(El.style.opacity).not.toBe('1');
    Anim.Dispose();
  });

  it('Dispose 后标记移除', () => {
    const Anim = new NumberPopAnimation(document.body, 100, 200, 5);
    const El = Anim['_El'] as unknown as FakeElement;
    Anim.Dispose();
    expect(El.IsRemoved).toBe(true);
  });
});
