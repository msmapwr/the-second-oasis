/**
 * 终局判定 + 加赛模块测试
 * 关联规则：§3、Q1、Q7
 */
import { describe, it, expect } from 'vitest';
import { GameEnd } from './GameEnd';
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

function MakePlayer(Id: PlayerId, Private: number): PlayerSnapshot {
  return {
    Id,
    PrivateTerritory: Private,
    ConsecutiveDoubles: 0,
    Status: PlayerStatus.Active,
    IsLaunched: true,
    IsWasteland: false,
    RevengeToken: false,
  };
}

describe('终局判定模块', () => {
  describe('IsGameOver', () => {
    it('公共=0 应返回 true', () => {
      expect(GameEnd.IsGameOver(0)).toBe(true);
    });

    it('公共>0 应返回 false', () => {
      expect(GameEnd.IsGameOver(1)).toBe(false);
      expect(GameEnd.IsGameOver(50)).toBe(false);
      expect(GameEnd.IsGameOver(100)).toBe(false);
    });
  });

  describe('ComputeWinners', () => {
    it('唯一最高者应返回长度 1', () => {
      const Players = [MakePlayer(0, 30), MakePlayer(1, 50), MakePlayer(2, 20)];
      const Winners = GameEnd.ComputeWinners(Players);

      expect(Winners).toHaveLength(1);
      expect(Winners[0].Id).toBe(1);
      expect(Winners[0].PrivateTerritory).toBe(50);
    });

    it('双人并列最高应返回长度 2（平手）', () => {
      const Players = [MakePlayer(0, 40), MakePlayer(1, 40), MakePlayer(2, 20)];
      const Winners = GameEnd.ComputeWinners(Players);

      expect(Winners).toHaveLength(2);
      expect(Winners[0].Id).toBe(0);
      expect(Winners[1].Id).toBe(1);
    });

    it('全员私有=0（全员荒地）应全员并列，触发加赛', () => {
      const Players = [MakePlayer(0, 0), MakePlayer(1, 0)];
      const Winners = GameEnd.ComputeWinners(Players);

      expect(Winners).toHaveLength(2);
    });

    it('空玩家列表应返回空数组', () => {
      expect(GameEnd.ComputeWinners([])).toHaveLength(0);
    });
  });

  describe('RunTiebreakerRound 加赛', () => {
    it('一轮分出胜负应 IsFinal=true', () => {
      // 玩家0掷(3,4)=7，玩家1掷(2,3)=5 → 玩家0赢
      const End = new GameEnd(new MockRandom(3, 4, 2, 3));
      const R = End.RunTiebreakerRound([0, 1]);

      expect(R.Participants).toEqual([0, 1]);
      expect(R.Rolls).toHaveLength(2);
      expect(R.Rolls[0].Sum).toBe(7);
      expect(R.Rolls[1].Sum).toBe(5);
      expect(R.WinnersThisRound).toEqual([0]);
      expect(R.IsFinal).toBe(true);
    });

    it('仍平手应 IsFinal=false，需继续加赛', () => {
      // 玩家0掷(3,4)=7，玩家1掷(2,5)=7 → 平手
      const End = new GameEnd(new MockRandom(3, 4, 2, 5));
      const R = End.RunTiebreakerRound([0, 1]);

      expect(R.WinnersThisRound).toHaveLength(2);
      expect(R.IsFinal).toBe(false);
    });

    it('3 人加赛：一人最高应 IsFinal=true', () => {
      // 玩家0掷(5,5)=10，玩家1掷(4,3)=7，玩家2掷(6,6)=12 → 玩家2赢
      const End = new GameEnd(new MockRandom(5, 5, 4, 3, 6, 6));
      const R = End.RunTiebreakerRound([0, 1, 2]);

      expect(R.WinnersThisRound).toEqual([2]);
      expect(R.IsFinal).toBe(true);
    });

    it('3 人加赛：两人并列最高应 IsFinal=false', () => {
      // 玩家0掷(6,6)=12，玩家1掷(4,3)=7，玩家2掷(6,6)=12 → 0和2平手
      const End = new GameEnd(new MockRandom(6, 6, 4, 3, 6, 6));
      const R = End.RunTiebreakerRound([0, 1, 2]);

      expect(R.WinnersThisRound).toHaveLength(2);
      expect(R.WinnersThisRound).toContain(0);
      expect(R.WinnersThisRound).toContain(2);
      expect(R.IsFinal).toBe(false);
    });
  });
});
