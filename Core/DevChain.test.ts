/**
 * 开发链状态机测试
 * 关联规则：§9、Q4、Q8、冲突点 2
 */
import { describe, it, expect } from 'vitest';
import { DevChain } from './DevChain';
import { DiceMode } from '@/Types/Dice';
import { DevMultiplier } from '@/Types/DevChain';

describe('开发链状态机', () => {
  describe('连续对子倍率', () => {
    it('第 1 次对子应返回 Dev(×2)，连击=1', () => {
      const Chain = new DevChain();
      const R = Chain.Advance(true, DiceMode.Aggressive);

      expect(R.Multiplier).toBe(DevMultiplier.Dev);
      expect(R.IsOverload).toBe(false);
      expect(R.NewConsecutiveDoubles).toBe(1);
      expect(Chain.ConsecutiveDoubles).toBe(1);
    });

    it('第 2 次连续对子应返回 BigDev(×3)，连击=2', () => {
      const Chain = new DevChain(1); // 已有 1 次连击
      const R = Chain.Advance(true, DiceMode.Aggressive);

      expect(R.Multiplier).toBe(DevMultiplier.BigDev);
      expect(R.IsOverload).toBe(false);
      expect(R.NewConsecutiveDoubles).toBe(2);
    });

    it('第 3 次连续对子应触发开发过度，连击归 0', () => {
      const Chain = new DevChain(2); // 已有 2 次连击
      const R = Chain.Advance(true, DiceMode.Aggressive);

      expect(R.IsOverload).toBe(true);
      expect(R.NewConsecutiveDoubles).toBe(0);
      expect(Chain.ConsecutiveDoubles).toBe(0);
    });

    it('完整序列：3 次连续对子从 0 到 Overload', () => {
      const Chain = new DevChain(0);

      const R1 = Chain.Advance(true, DiceMode.Aggressive);
      expect(R1.Multiplier).toBe(DevMultiplier.Dev);

      const R2 = Chain.Advance(true, DiceMode.Aggressive);
      expect(R2.Multiplier).toBe(DevMultiplier.BigDev);

      const R3 = Chain.Advance(true, DiceMode.Aggressive);
      expect(R3.IsOverload).toBe(true);
      expect(Chain.ConsecutiveDoubles).toBe(0);
    });
  });

  describe('非对子清零（Q8）', () => {
    it('非对子结果应清零连击', () => {
      const Chain = new DevChain(2); // 已有 2 次连击
      const R = Chain.Advance(false, DiceMode.Aggressive);

      expect(R.Multiplier).toBe(DevMultiplier.None);
      expect(R.IsOverload).toBe(false);
      expect(R.NewConsecutiveDoubles).toBe(0);
      expect(Chain.ConsecutiveDoubles).toBe(0);
    });

    it('Steady 模式（IsDouble 恒 false）应清零连击', () => {
      const Chain = new DevChain(2);
      const R = Chain.Advance(false, DiceMode.Steady);

      expect(R.Multiplier).toBe(DevMultiplier.None);
      expect(Chain.ConsecutiveDoubles).toBe(0);
    });

    it('Q8：None 模式应清零连击（即使不掷骰）', () => {
      const Chain = new DevChain(2);
      const R = Chain.Advance(false, DiceMode.None);

      expect(R.Multiplier).toBe(DevMultiplier.None);
      expect(R.IsOverload).toBe(false);
      expect(R.NewConsecutiveDoubles).toBe(0);
      expect(Chain.ConsecutiveDoubles).toBe(0);
    });

    it('清零后再次对子应按"第 1 次"处理', () => {
      const Chain = new DevChain(2);
      // 先掷非对子清零
      Chain.Advance(false, DiceMode.Aggressive);
      expect(Chain.ConsecutiveDoubles).toBe(0);

      // 再掷对子，应按第 1 次
      const R = Chain.Advance(true, DiceMode.Aggressive);
      expect(R.Multiplier).toBe(DevMultiplier.Dev);
      expect(R.NewConsecutiveDoubles).toBe(1);
    });
  });

  describe('冲突点2：小对子仍触发开发链', () => {
    it('(1,1) 对子 IsDouble=true 应正常推进连击', () => {
      // DiceRoller 会把 (1,1) 标记 IsDouble=true
      // DevChain 只看 IsDouble，不关心点数大小
      const Chain = new DevChain(0);
      const R = Chain.Advance(true, DiceMode.Aggressive);
      expect(R.Multiplier).toBe(DevMultiplier.Dev);
      expect(R.NewConsecutiveDoubles).toBe(1);
    });

    it('小对子连续 3 次也应触发开发过度', () => {
      const Chain = new DevChain(0);
      Chain.Advance(true, DiceMode.Aggressive); // (1,1) 第1次
      Chain.Advance(true, DiceMode.Aggressive); // (2,2) 第2次
      const R3 = Chain.Advance(true, DiceMode.Aggressive); // (3,3) 第3次
      expect(R3.IsOverload).toBe(true);
    });
  });

  describe('Reset 方法', () => {
    it('应将连击归 0', () => {
      const Chain = new DevChain(2);
      Chain.Reset();
      expect(Chain.ConsecutiveDoubles).toBe(0);
    });

    it('Reset 后再对子按第 1 次处理', () => {
      const Chain = new DevChain(2);
      Chain.Reset();
      const R = Chain.Advance(true, DiceMode.Aggressive);
      expect(R.Multiplier).toBe(DevMultiplier.Dev);
    });
  });
});
