/**
 * src/Render/Animation/SeatPulseAnimation.test.ts
 * 操作类型：新建
 *
 * 席位脉冲动画测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SeatPulseAnimation } from './SeatPulseAnimation';
import { InstallFakeDom, ResetFakeDom, FakeElement } from './TestDom';

describe('SeatPulseAnimation', () => {
  beforeEach(() => {
    ResetFakeDom();
    InstallFakeDom();
  });

  it('创建脉冲元素', () => {
    const Anim = new SeatPulseAnimation(document.body, 100, 100, 80, 40);
    expect(document.body.children.length).toBe(1);
    const El = Anim['_El'] as unknown as FakeElement;
    expect(El.style.cssText).toContain('border: 2px solid');
    Anim.Dispose();
  });

  it('更新时缩放和透明度变化', () => {
    const Anim = new SeatPulseAnimation(document.body, 100, 100, 80, 40);
    const El = Anim['_El'] as unknown as FakeElement;

    Anim.Update(300);

    expect(El.style.transform).toContain('scale');
    expect(El.style.opacity).not.toBe('0.6');
    Anim.Dispose();
  });

  it('Dispose 后标记移除', () => {
    const Anim = new SeatPulseAnimation(document.body, 100, 100, 80, 40);
    const El = Anim['_El'] as unknown as FakeElement;
    Anim.Dispose();
    expect(El.IsRemoved).toBe(true);
  });
});
