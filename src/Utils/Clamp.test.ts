/**
 * Clamp 工具测试
 */
import { describe, it, expect } from 'vitest';
import { Clamp, ClampMin, ClampMax } from './Clamp';

describe('Clamp 工具', () => {
  describe('Clamp', () => {
    it('值在区间内应返回原值', () => {
      expect(Clamp(5, 0, 10)).toBe(5);
    });

    it('值低于下界应返回下界', () => {
      expect(Clamp(-3, 0, 10)).toBe(0);
    });

    it('值高于上界应返回上界', () => {
      expect(Clamp(15, 0, 10)).toBe(10);
    });

    it('恰好等于边界应返回边界值', () => {
      expect(Clamp(0, 0, 10)).toBe(0);
      expect(Clamp(10, 0, 10)).toBe(10);
    });
  });

  describe('ClampMin', () => {
    it('值低于下界应返回下界', () => {
      expect(ClampMin(-5, 0)).toBe(0);
    });

    it('值不低于下界应返回原值', () => {
      expect(ClampMin(7, 0)).toBe(7);
    });
  });

  describe('ClampMax', () => {
    it('值高于上界应返回上界', () => {
      expect(ClampMax(15, 10)).toBe(10);
    });

    it('值不高于上界应返回原值', () => {
      expect(ClampMax(3, 10)).toBe(3);
    });
  });
});
