/**
 * 占领结算模块测试
 * 关联规则：§7.2、Q4、冲突点 1/2
 */
import { describe, it, expect } from 'vitest';
import { Occupation } from './Occupation';
import { DevMultiplier } from '@/Types/DevChain';

describe('占领结算模块', () => {
  const Occ = new Occupation();

  describe('正占领（M>0）', () => {
    it('公共足够时应正常占领：Public=50, M=10 → Public=40, Private+10', () => {
      const R = Occ.Calculate(50, 20, 10, DevMultiplier.None);
      expect(R.M).toBe(10);
      expect(R.PublicAfter).toBe(40);
      expect(R.PrivateDelta).toBe(10);
      expect(R.IsOverflow).toBe(false);
      expect(R.OverflowM2).toBe(0);
      expect(R.PublicDelta).toBe(-10);
    });

    it('冲突点1：溢出时 m2 = M − Public（倍率后占领量）', () => {
      // Public=30, RawGain=14, Multiplier=Dev(2) → M=28，未溢出
      const R1 = Occ.Calculate(30, 0, 14, DevMultiplier.Dev);
      expect(R1.M).toBe(28);
      expect(R1.IsOverflow).toBe(false);

      // Public=30, RawGain=21, Multiplier=Dev(2) → M=42，溢出 m2=12
      const R2 = Occ.Calculate(30, 0, 21, DevMultiplier.Dev);
      expect(R2.M).toBe(42);
      expect(R2.IsOverflow).toBe(true);
      expect(R2.OverflowM2).toBe(12);
      expect(R2.PublicAfter).toBe(0);
      expect(R2.PrivateDelta).toBe(30); // 先把公共拿光
      expect(R2.PublicDelta).toBe(-30);
    });

    it('溢出边界：M 恰好等于 Public 不算溢出', () => {
      const R = Occ.Calculate(30, 0, 30, DevMultiplier.None);
      expect(R.M).toBe(30);
      expect(R.IsOverflow).toBe(false);
      expect(R.PublicAfter).toBe(0);
      expect(R.PrivateDelta).toBe(30);
    });

    it('溢出边界：M = Public+1 刚好溢出 m2=1', () => {
      const R = Occ.Calculate(30, 0, 31, DevMultiplier.None);
      expect(R.IsOverflow).toBe(true);
      expect(R.OverflowM2).toBe(1);
    });
  });

  describe('倍率（Q4：作用于 RawGain）', () => {
    it('Dev(2) 倍率：RawGain=6 → M=12', () => {
      const R = Occ.Calculate(50, 0, 6, DevMultiplier.Dev);
      expect(R.M).toBe(12);
      expect(R.PublicAfter).toBe(38);
    });

    it('BigDev(3) 倍率：RawGain=5 → M=15', () => {
      const R = Occ.Calculate(50, 0, 5, DevMultiplier.BigDev);
      expect(R.M).toBe(15);
    });

    it('冲突点2：倍率作用于负 RawGain（倒扣放大）', () => {
      // RawGain=−2, Multiplier=Dev(2) → M=−4
      const R = Occ.Calculate(50, 10, -2, DevMultiplier.Dev);
      expect(R.M).toBe(-4);
      expect(R.IsOverflow).toBe(false);
      expect(R.PrivateDelta).toBe(-4);
      expect(R.PublicAfter).toBe(54); // 公共 +4
    });
  });

  describe('倒扣与零占领（M≤0）', () => {
    it('倒扣：RawGain=−4, Multiplier=None → M=−4, Private−4, Public+4（守恒）', () => {
      const R = Occ.Calculate(50, 10, -4, DevMultiplier.None);
      expect(R.M).toBe(-4);
      expect(R.PrivateDelta).toBe(-4);
      expect(R.PublicAfter).toBe(54);
      expect(R.PublicDelta).toBe(4);
      expect(R.IsOverflow).toBe(false);
    });

    it('倒扣 clamp：私有不足时扣至 0，公共按实际扣量补（守恒）', () => {
      // Private=2, RawGain=−4 → 实际只扣 2，公共 +2
      const R = Occ.Calculate(50, 2, -4, DevMultiplier.None);
      expect(R.M).toBe(-4);
      expect(R.PrivateDelta).toBe(-2); // 只扣到 0
      expect(R.PublicAfter).toBe(52); // 公共只 +2
      expect(R.PublicDelta).toBe(2);
    });

    it('倒扣私有=0：无变化', () => {
      const R = Occ.Calculate(50, 0, -4, DevMultiplier.None);
      expect(R.PrivateDelta).toBe(0);
      expect(R.PublicAfter).toBe(50);
      expect(R.PublicDelta).toBe(0);
    });

    it('零占领（M=0）：RawGain=0 无变化', () => {
      const R = Occ.Calculate(50, 10, 0, DevMultiplier.None);
      expect(R.M).toBe(0);
      expect(R.PublicAfter).toBe(50);
      expect(R.PrivateDelta).toBe(0);
      expect(R.IsOverflow).toBe(false);
    });

    it('None 模式（RawGain=0）乘任意倍率仍为 0', () => {
      const R = Occ.Calculate(50, 10, 0, DevMultiplier.BigDev);
      expect(R.M).toBe(0);
      expect(R.PrivateDelta).toBe(0);
    });
  });
});
