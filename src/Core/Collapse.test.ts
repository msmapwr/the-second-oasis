/**
 * 崩坏结算模块测试
 * 关联规则：§11、Q6、冲突点 4/5
 */
import { describe, it, expect } from 'vitest';
import { Collapse } from './Collapse';
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

describe('崩坏结算模块', () => {
  describe('系数递增', () => {
    it('初次崩坏 X=2，结算后 NextX=3', () => {
      const Col = new Collapse(new MockRandom(0), 2);
      expect(Col.X).toBe(2);
      const R = Col.Resolve(0, [MakePlayer(0, 20), MakePlayer(1, 20)], 8, 50);
      expect(R.CoefficientX).toBe(2);
      expect(R.NextX).toBe(3);
      expect(Col.X).toBe(3);
    });

    it('第二次崩坏 X=3，结算后 NextX=4', () => {
      const Col = new Collapse(new MockRandom(0), 3);
      const R = Col.Resolve(0, [MakePlayer(0, 50), MakePlayer(1, 50)], 8, 50);
      expect(R.CoefficientX).toBe(3);
      expect(R.NextX).toBe(4);
    });
  });

  describe('Q6 守恒（私有充足时）', () => {
    it('2人局：TotalLoss === X·m2', () => {
      // X=2, m2=8 → TotalTarget=16, PerCap=4
      // 防守者 RandomLoss=3, ActualLoss=3（私有20充足）
      // 发起者承担 16-3=13
      const Col = new Collapse(new MockRandom(3), 2);
      const Players = [MakePlayer(0, 20), MakePlayer(1, 20)];
      const R = Col.Resolve(0, Players, 8, 50);

      expect(R.TotalLoss).toBe(16); // 3 + 13
      expect(R.IsConserved).toBe(true);

      // 发起者损失 13
      const InitiatorLoss = R.PlayerLosses.find((L) => L.Id === 0);
      expect(InitiatorLoss?.RandomLoss).toBe(13);
      expect(InitiatorLoss?.ActualLoss).toBe(13);
      expect(InitiatorLoss?.AfterPrivate).toBe(7); // 20 - 13

      // 防守者损失 3
      const DefenderLoss = R.PlayerLosses.find((L) => L.Id === 1);
      expect(DefenderLoss?.RandomLoss).toBe(3);
      expect(DefenderLoss?.ActualLoss).toBe(3);
      expect(DefenderLoss?.AfterPrivate).toBe(17); // 20 - 3
    });

    it('3人局：两位非发起者随机损失，发起者承担剩余', () => {
      // X=2, m2=12 → TotalTarget=24, PerCap=6
      // 玩家1 RandomLoss=4, 玩家2 RandomLoss=2 → OthersSum=6
      // 发起者承担 24-6=18
      const Col = new Collapse(new MockRandom(4, 2), 2);
      const Players = [MakePlayer(0, 50), MakePlayer(1, 50), MakePlayer(2, 50)];
      const R = Col.Resolve(0, Players, 12, 50);

      expect(R.TotalLoss).toBe(24);
      expect(R.IsConserved).toBe(true);

      const P1 = R.PlayerLosses.find((L) => L.Id === 1);
      expect(P1?.ActualLoss).toBe(4);
      const P2 = R.PlayerLosses.find((L) => L.Id === 2);
      expect(P2?.ActualLoss).toBe(2);
      const P0 = R.PlayerLosses.find((L) => L.Id === 0);
      expect(P0?.ActualLoss).toBe(18);
    });
  });

  describe('冲突点4：私有不足', () => {
    it('非发起者私有不足：ActualLoss clamp，缺口转给发起者', () => {
      // X=2, m2=8 → TotalTarget=16, PerCap=4
      // 防守者 RandomLoss=4, 但私有=2 → ActualLoss=2
      // OthersSum=2, 发起者承担 16-2=14
      const Col = new Collapse(new MockRandom(4), 2);
      const Players = [MakePlayer(0, 20), MakePlayer(1, 2)];
      const R = Col.Resolve(0, Players, 8, 50);

      const DefenderLoss = R.PlayerLosses.find((L) => L.Id === 1);
      expect(DefenderLoss?.RandomLoss).toBe(4);
      expect(DefenderLoss?.ActualLoss).toBe(2);
      expect(DefenderLoss?.AfterPrivate).toBe(0);

      const InitiatorLoss = R.PlayerLosses.find((L) => L.Id === 0);
      expect(InitiatorLoss?.RandomLoss).toBe(14);
      expect(InitiatorLoss?.ActualLoss).toBe(14);
      expect(R.IsConserved).toBe(true); // 发起者充足，仍守恒
    });

    it('发起者也不足：IsConserved=false', () => {
      // TotalTarget=16, 防守者ActualLoss=2, 发起者承担14但私有=5
      const Col = new Collapse(new MockRandom(4), 2);
      const Players = [MakePlayer(0, 5), MakePlayer(1, 2)];
      const R = Col.Resolve(0, Players, 8, 50);

      const InitiatorLoss = R.PlayerLosses.find((L) => L.Id === 0);
      expect(InitiatorLoss?.ActualLoss).toBe(5); // clamp
      expect(R.TotalLoss).toBe(7); // 2 + 5
      expect(R.IsConserved).toBe(false); // 7 ≠ 16
    });
  });

  describe('冲突点5：公共 clamp', () => {
    it('公共不足时 clamp 至 0', () => {
      // X=2, PublicBefore=1 → 实际扣 1，不是 2
      const Col = new Collapse(new MockRandom(0), 2);
      const R = Col.Resolve(0, [MakePlayer(0, 20), MakePlayer(1, 20)], 8, 1);

      expect(R.PublicDelta).toBe(-1); // min(2, 1)
    });

    it('公共充足时正常扣 X', () => {
      const Col = new Collapse(new MockRandom(0), 2);
      const R = Col.Resolve(0, [MakePlayer(0, 20), MakePlayer(1, 20)], 8, 50);

      expect(R.PublicDelta).toBe(-2);
    });

    it('公共恰好等于 X', () => {
      const Col = new Collapse(new MockRandom(0), 2);
      const R = Col.Resolve(0, [MakePlayer(0, 20), MakePlayer(1, 20)], 8, 2);

      expect(R.PublicDelta).toBe(-2);
    });
  });

  describe('边界', () => {
    it('m2=1 时 PerCap=floor(X/4)，X=2→PerCap=0，非发起者必损失0', () => {
      // TotalTarget=2, PerCap=0 → 非发起者RandomLoss=NextInt(0,0)=0
      // 发起者承担 2-0=2
      const Col = new Collapse(new MockRandom(0), 2);
      const R = Col.Resolve(0, [MakePlayer(0, 20), MakePlayer(1, 20)], 1, 50);

      const DefenderLoss = R.PlayerLosses.find((L) => L.Id === 1);
      expect(DefenderLoss?.ActualLoss).toBe(0);
      expect(R.PlayerLosses.find((L) => L.Id === 0)?.ActualLoss).toBe(2);
      expect(R.IsConserved).toBe(true);
    });
  });
});
