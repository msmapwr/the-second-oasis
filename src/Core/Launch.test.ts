/**
 * 发射序章模块测试
 * 关联规则：§12
 */
import { describe, it, expect } from 'vitest';
import { Launch } from './Launch';
import { DiceRoller } from './DiceRoller';
import { LaunchStatus } from '@/Types/Launch';
import { PlayerStatus } from '@/Types/Player';
import type { PlayerId, PlayerSnapshot } from '@/Types/Player';
import type { DieFace } from '@/Types/Dice';
import type { IRandomSource } from '@/Utils/Random/IRandomSource';

class MockRandom implements IRandomSource {
  private _Queue: number[];
  constructor(...Values: number[]) {
    this._Queue = [...Values];
  }
  NextDie(): DieFace {
    const V = this._Queue.shift();
    if (V === undefined) throw new Error('MockRandom 队列耗尽');
    return V as DieFace;
  }
  NextInt(_Min: number, _Max: number): number {
    const V = this._Queue.shift();
    if (V === undefined) throw new Error('MockRandom 队列耗尽');
    return V;
  }
}

function MakePlayer(Id: PlayerId, IsLaunched: boolean): PlayerSnapshot {
  return {
    Id,
    PrivateTerritory: 0,
    ConsecutiveDoubles: 0,
    Status: PlayerStatus.Active,
    IsLaunched,
    IsWasteland: false,
    RevengeToken: false,
  };
}

describe('发射序章模块', () => {
  describe('Attempt 发射尝试', () => {
    it('Sum=7 应发射成功，+2 私有', () => {
      // 双骰 (3,4)=7
      const Launcher = new Launch(new DiceRoller(new MockRandom(3, 4)));
      const R = Launcher.Attempt(0);

      expect(R.Sum).toBe(7);
      expect(R.Status).toBe(LaunchStatus.Success);
      expect(R.PrivateDelta).toBe(2);
      expect(R.Dice).toEqual([3, 4]);
    });

    it('Sum=12 应发射成功，+2', () => {
      const Launcher = new Launch(new DiceRoller(new MockRandom(6, 6)));
      const R = Launcher.Attempt(1);

      expect(R.Sum).toBe(12);
      expect(R.Status).toBe(LaunchStatus.Success);
      expect(R.PrivateDelta).toBe(2);
      expect(R.PlayerId).toBe(1);
    });

    it('Sum=6 应发射失败，+0', () => {
      const Launcher = new Launch(new DiceRoller(new MockRandom(2, 4)));
      const R = Launcher.Attempt(0);

      expect(R.Sum).toBe(6);
      expect(R.Status).toBe(LaunchStatus.Failure);
      expect(R.PrivateDelta).toBe(0);
    });

    it('Sum=2 最小值应失败', () => {
      const Launcher = new Launch(new DiceRoller(new MockRandom(1, 1)));
      const R = Launcher.Attempt(0);

      expect(R.Sum).toBe(2);
      expect(R.Status).toBe(LaunchStatus.Failure);
    });

    it('边界：Sum 恰好 7 成功', () => {
      // (1,6)=7
      const Launcher = new Launch(new DiceRoller(new MockRandom(1, 6)));
      const R = Launcher.Attempt(0);
      expect(R.Status).toBe(LaunchStatus.Success);
    });
  });

  describe('IsAllLaunched 全员发射判定', () => {
    it('全员已发射应返回 true', () => {
      const Players = [MakePlayer(0, true), MakePlayer(1, true)];
      expect(Launch.IsAllLaunched(Players)).toBe(true);
    });

    it('有人未发射应返回 false', () => {
      const Players = [MakePlayer(0, true), MakePlayer(1, false)];
      expect(Launch.IsAllLaunched(Players)).toBe(false);
    });

    it('全员未发射应返回 false', () => {
      const Players = [MakePlayer(0, false), MakePlayer(1, false)];
      expect(Launch.IsAllLaunched(Players)).toBe(false);
    });

    it('4 人局全员已发射应返回 true', () => {
      const Players = [
        MakePlayer(0, true),
        MakePlayer(1, true),
        MakePlayer(2, true),
        MakePlayer(3, true),
      ];
      expect(Launch.IsAllLaunched(Players)).toBe(true);
    });
  });
});
