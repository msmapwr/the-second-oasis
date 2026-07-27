/**
 * 抢夺裁决模块测试
 * 关联规则：§10、Q1、Q5、冲突点 1/3/6
 */
import { describe, it, expect } from 'vitest';
import { Robbery } from './Robbery';
import { RobberyRole } from '@/Types/Robbery';
import { PlayerStatus } from '@/Types/Player';
import type { PlayerId, PlayerSnapshot } from '@/Types/Player';
import type { DieFace } from '@/Types/Dice';
import type { IRandomSource } from '@/Utils/Random/IRandomSource';

/** Mock 随机源：按预设队列返回值 */
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

/** 辅助：构造玩家快照 */
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

describe('抢夺裁决模块', () => {
  describe('掷骰胜负', () => {
    it('发起者赢：InitiatorDelta=+(m2−r), DefenderDelta=−m2', () => {
      // 骰序列：发起者5，防守者3 → 发起者赢；r=2
      const Rob = new Robbery(new MockRandom(5, 3, 2));
      const Players = [MakePlayer(0, 10), MakePlayer(1, 20)];
      const R = Rob.Resolve(0, Players, 10);

      expect(R.Winner).toBe(RobberyRole.Initiator);
      expect(R.Defender).toBe(1);
      expect(R.Transfer).toBe(10); // min(10, 20)
      expect(R.RandomReturn).toBe(2);
      expect(R.InitiatorDelta).toBe(8); // 10 - 2
      expect(R.DefenderDelta).toBe(-10);
      expect(R.PublicDelta).toBe(2);
      expect(R.RollHistory).toHaveLength(1);
      expect(R.RollHistory[0].IsTie).toBe(false);
    });

    it('防守者赢：角色互换，发起者扣 m2', () => {
      // 骰序列：发起者2，防守者6 → 防守者赢；r=3
      const Rob = new Robbery(new MockRandom(2, 6, 3));
      const Players = [MakePlayer(0, 15), MakePlayer(1, 20)];
      const R = Rob.Resolve(0, Players, 10);

      expect(R.Winner).toBe(RobberyRole.Defender);
      // 低者=发起者(15)，Transfer=min(10,15)=10
      expect(R.Transfer).toBe(10);
      expect(R.RandomReturn).toBe(3);
      expect(R.InitiatorDelta).toBe(-10);
      expect(R.DefenderDelta).toBe(7); // 10 - 3
    });
  });

  describe('平手重掷（Q5）', () => {
    it('平手后应重掷直至分高低，RollHistory 记录所有轮次', () => {
      // 骰序列：(3,3)平手 → (5,2)发起者赢 → r=4
      const Rob = new Robbery(new MockRandom(3, 3, 5, 2, 4));
      const Players = [MakePlayer(0, 10), MakePlayer(1, 20)];
      const R = Rob.Resolve(0, Players, 10);

      expect(R.RollHistory).toHaveLength(2);
      expect(R.RollHistory[0].IsTie).toBe(true);
      expect(R.RollHistory[0].InitiatorRoll).toBe(3);
      expect(R.RollHistory[0].DefenderRoll).toBe(3);
      expect(R.RollHistory[1].IsTie).toBe(false);
      expect(R.Winner).toBe(RobberyRole.Initiator);
      expect(R.RandomReturn).toBe(4);
    });

    it('多次平手后分胜负', () => {
      // (2,2)(4,4)(6,6) 三次平手 → (5,1)发起者赢 → r=5
      const Rob = new Robbery(new MockRandom(2, 2, 4, 4, 6, 6, 5, 1, 5));
      const Players = [MakePlayer(0, 10), MakePlayer(1, 20)];
      const R = Rob.Resolve(0, Players, 10);

      expect(R.RollHistory).toHaveLength(4);
      expect(R.RollHistory[0].IsTie).toBe(true);
      expect(R.RollHistory[1].IsTie).toBe(true);
      expect(R.RollHistory[2].IsTie).toBe(true);
      expect(R.RollHistory[3].IsTie).toBe(false);
      expect(R.Winner).toBe(RobberyRole.Initiator);
    });
  });

  describe('冲突点3：低者私有不足 m2', () => {
    it('防守者私有不足：Transfer=min(m2,低者私有)，守恒', () => {
      // 发起者5，防守者3 → 发起者赢；r=8
      // m2=10, 防守者私有=5
      const Rob = new Robbery(new MockRandom(5, 3, 8));
      const Players = [MakePlayer(0, 10), MakePlayer(1, 5)];
      const R = Rob.Resolve(0, Players, 10);

      expect(R.Transfer).toBe(5); // min(10, 5)
      expect(R.RandomReturn).toBe(5); // min(8, 5)
      expect(R.InitiatorDelta).toBe(0); // 5 - 5
      expect(R.DefenderDelta).toBe(-5);
      expect(R.PublicDelta).toBe(5);
    });

    it('防守者私有=0：全部 delta=0，抢夺实质无效', () => {
      const Rob = new Robbery(new MockRandom(5, 3, 5));
      const Players = [MakePlayer(0, 10), MakePlayer(1, 0)];
      const R = Rob.Resolve(0, Players, 10);

      expect(R.Transfer).toBe(0);
      expect(R.RandomReturn).toBe(0);
      expect(R.InitiatorDelta).toBe(0);
      expect(R.DefenderDelta).toBe(0);
      expect(R.PublicDelta).toBe(0);
    });

    it('防守者赢但发起者私有不足', () => {
      // 防守者赢，低者=发起者，发起者私有=3
      const Rob = new Robbery(new MockRandom(2, 6, 4));
      const Players = [MakePlayer(0, 3), MakePlayer(1, 20)];
      const R = Rob.Resolve(0, Players, 10);

      expect(R.Transfer).toBe(3); // min(10, 3)
      expect(R.RandomReturn).toBe(3); // min(4, 3)
      expect(R.InitiatorDelta).toBe(-3);
      expect(R.DefenderDelta).toBe(0); // 3 - 3
    });
  });

  describe('多人局选防守者', () => {
    it('应选除发起者外私有最高者为防守者', () => {
      // 3人：发起者=0(私有5)，玩家1=20，玩家2=15
      const Rob = new Robbery(new MockRandom(5, 3, 2));
      const Players = [MakePlayer(0, 5), MakePlayer(1, 20), MakePlayer(2, 15)];
      const R = Rob.Resolve(0, Players, 10);

      expect(R.Defender).toBe(1); // 玩家1私有最高
    });

    it('并列最高时选 ID 最小者（确定性）', () => {
      // 玩家1和玩家2都私有20，应选玩家1
      const Rob = new Robbery(new MockRandom(5, 3, 2));
      const Players = [MakePlayer(0, 5), MakePlayer(1, 20), MakePlayer(2, 20)];
      const R = Rob.Resolve(0, Players, 10);

      expect(R.Defender).toBe(1);
    });
  });
});
