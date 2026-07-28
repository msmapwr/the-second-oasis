/**
 * 掷骰模块测试
 * 关联规则：§7、§8、冲突点 2
 * 测试策略：用 MockRandom 精确控制骰子输出，断言精确值
 */
import { describe, it, expect } from 'vitest';
import { DiceRoller } from './DiceRoller';
import { DiceMode } from '@/Types/Dice';
import type { DieFace } from '@/Types/Dice';
import type { IRandomSource } from '@/Utils/Random/IRandomSource';
import { SeededRandom } from '@/Utils/Random/SeededRandom';
import { InvalidDiceModeError } from './Errors';

/**
 * Mock 随机源：按预设队列返回值，记录调用次数
 * 用于精确控制骰子输出，验证 None 模式不消耗随机源
 */
class MockRandom implements IRandomSource {
  private _Queue: number[];
  private _CallCount = 0;

  constructor(...Values: number[]) {
    this._Queue = [...Values];
  }

  NextDie(): DieFace {
    this._CallCount++;
    const V = this._Queue.shift();
    if (V === undefined) {
      throw new Error('MockRandom 队列已耗尽');
    }
    return V as DieFace;
  }

  NextInt(_Min: number, _Max: number): number {
    this._CallCount++;
    const V = this._Queue.shift();
    if (V === undefined) {
      throw new Error('MockRandom 队列已耗尽');
    }
    return V;
  }

  get CallCount(): number {
    return this._CallCount;
  }
}

describe('掷骰模块', () => {
  describe('稳健模式 Steady', () => {
    it('应掷单骰，Sum=骰值，RawGain=Sum', () => {
      const Mock = new MockRandom(4);
      const Roller = new DiceRoller(Mock);
      const Result = Roller.Roll(DiceMode.Steady);

      expect(Result.Mode).toBe(DiceMode.Steady);
      expect(Result.Dice).toEqual([4]);
      expect(Result.Sum).toBe(4);
      expect(Result.RawGain).toBe(4);
      expect(Result.IsDouble).toBe(false);
      expect(Result.IsDeducted).toBe(false);
      expect(Mock.CallCount).toBe(1);
    });

    it('单骰永远不可能 IsDouble', () => {
      // 多次验证
      for (let V = 1; V <= 6; V++) {
        const Roller = new DiceRoller(new MockRandom(V));
        expect(Roller.Roll(DiceMode.Steady).IsDouble).toBe(false);
      }
    });

    it('稳健模式永不倒扣', () => {
      for (let V = 1; V <= 6; V++) {
        const Roller = new DiceRoller(new MockRandom(V));
        expect(Roller.Roll(DiceMode.Steady).IsDeducted).toBe(false);
      }
    });
  });

  describe('激进模式 Aggressive', () => {
    it('应掷双骰，Sum=两骰之和，RawGain=Sum（当 Sum>6）', () => {
      const Mock = new MockRandom(5, 3);
      const Roller = new DiceRoller(Mock);
      const Result = Roller.Roll(DiceMode.Aggressive);

      expect(Result.Mode).toBe(DiceMode.Aggressive);
      expect(Result.Dice).toEqual([5, 3]);
      expect(Result.Sum).toBe(8);
      expect(Result.RawGain).toBe(8);
      expect(Result.IsDouble).toBe(false);
      expect(Result.IsDeducted).toBe(false);
      expect(Mock.CallCount).toBe(2);
    });

    it('Sum≤6 时应触发倒扣，RawGain=−Sum', () => {
      // (2,3)=5 ≤6 → 倒扣
      const Mock = new MockRandom(2, 3);
      const Roller = new DiceRoller(Mock);
      const Result = Roller.Roll(DiceMode.Aggressive);

      expect(Result.Sum).toBe(5);
      expect(Result.IsDeducted).toBe(true);
      expect(Result.RawGain).toBe(-5);
    });

    it('Sum=6（边界）应触发倒扣', () => {
      // (2,4)=6 → 倒扣
      const Roller = new DiceRoller(new MockRandom(2, 4));
      const Result = Roller.Roll(DiceMode.Aggressive);
      expect(Result.Sum).toBe(6);
      expect(Result.IsDeducted).toBe(true);
      expect(Result.RawGain).toBe(-6);
    });

    it('Sum=7（边界）不应触发倒扣', () => {
      // (3,4)=7 → 不倒扣
      const Roller = new DiceRoller(new MockRandom(3, 4));
      const Result = Roller.Roll(DiceMode.Aggressive);
      expect(Result.Sum).toBe(7);
      expect(Result.IsDeducted).toBe(false);
      expect(Result.RawGain).toBe(7);
    });

    it('两骰相同应为对子 IsDouble=true', () => {
      const Roller = new DiceRoller(new MockRandom(5, 5));
      const Result = Roller.Roll(DiceMode.Aggressive);
      expect(Result.IsDouble).toBe(true);
      expect(Result.Sum).toBe(10);
      expect(Result.IsDeducted).toBe(false);
    });

    it('冲突点2：小对子 (1,1) 既是对子又触发倒扣', () => {
      // (1,1)=2 ≤6 → 倒扣 + 对子
      const Roller = new DiceRoller(new MockRandom(1, 1));
      const Result = Roller.Roll(DiceMode.Aggressive);

      expect(Result.IsDouble).toBe(true);
      expect(Result.Sum).toBe(2);
      expect(Result.IsDeducted).toBe(true);
      expect(Result.RawGain).toBe(-2);
    });

    it('冲突点2：小对子 (2,2) Sum=4 倒扣+对子', () => {
      const Roller = new DiceRoller(new MockRandom(2, 2));
      const Result = Roller.Roll(DiceMode.Aggressive);

      expect(Result.IsDouble).toBe(true);
      expect(Result.IsDeducted).toBe(true);
      expect(Result.RawGain).toBe(-4);
    });

    it('冲突点2：小对子 (3,3) Sum=6 倒扣+对子（边界）', () => {
      const Roller = new DiceRoller(new MockRandom(3, 3));
      const Result = Roller.Roll(DiceMode.Aggressive);

      expect(Result.IsDouble).toBe(true);
      expect(Result.IsDeducted).toBe(true);
      expect(Result.RawGain).toBe(-6);
    });

    it('大对子 (4,4) Sum=8 对子但不倒扣', () => {
      const Roller = new DiceRoller(new MockRandom(4, 4));
      const Result = Roller.Roll(DiceMode.Aggressive);

      expect(Result.IsDouble).toBe(true);
      expect(Result.IsDeducted).toBe(false);
      expect(Result.RawGain).toBe(8);
    });

    it('双六 (6,6) Sum=12 最大值', () => {
      const Roller = new DiceRoller(new MockRandom(6, 6));
      const Result = Roller.Roll(DiceMode.Aggressive);

      expect(Result.Sum).toBe(12);
      expect(Result.IsDouble).toBe(true);
      expect(Result.IsDeducted).toBe(false);
      expect(Result.RawGain).toBe(12);
    });
  });

  describe('不开发模式 None', () => {
    it('应返回空结果，RawGain=0', () => {
      const Mock = new MockRandom(); // 空队列
      const Roller = new DiceRoller(Mock);
      const Result = Roller.Roll(DiceMode.None);

      expect(Result.Mode).toBe(DiceMode.None);
      expect(Result.Dice).toEqual([]);
      expect(Result.Sum).toBe(0);
      expect(Result.IsDouble).toBe(false);
      expect(Result.IsDeducted).toBe(false);
      expect(Result.RawGain).toBe(0);
    });

    it('关键：不消耗随机源（联机种子同步保证）', () => {
      // 两个相同种子的随机源，一个先 Roll(None)，一个不调
      // 之后两者 NextDie() 序列应完全一致
      const A = new SeededRandom(42);
      const B = new SeededRandom(42);

      const Roller = new DiceRoller(A);
      Roller.Roll(DiceMode.None); // 不应消耗 A 的随机序列

      // 之后 A 和 B 的序列应一致
      for (let I = 0; I < 10; I++) {
        expect(A.NextDie()).toBe(B.NextDie());
      }
    });

    it('调用次数应为 0', () => {
      const Mock = new MockRandom();
      const Roller = new DiceRoller(Mock);
      Roller.Roll(DiceMode.None);
      expect(Mock.CallCount).toBe(0);
    });
  });

  describe('非法模式', () => {
    it('应抛出 InvalidDiceModeError', () => {
      const Roller = new DiceRoller(new MockRandom(1));
      // 用类型断言绕过 TS 检查，测试运行时防御
      expect(() => Roller.Roll('Invalid' as unknown as DiceMode)).toThrow(
        InvalidDiceModeError,
      );
    });
  });
});
