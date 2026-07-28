import { describe, it, expect } from 'vitest';
import { GameState } from './GameState';
import { CreateDefaultConfig, CreateVariantConfig } from '@/Types/GameConfig';
import { GamePhase } from '@/Types/GamePhase';
import { DiceMode } from '@/Types/Dice';

function CompleteLaunch(State: GameState): void {
  let Iterations = 0;
  while (!State.Snapshot.Players.every((P) => P.IsLaunched) && Iterations < 400) {
    Iterations++;
    const Phase = State.Phase as GamePhase;
    if (Phase === GamePhase.LaunchPhase) {
      State.AttemptLaunch();
    } else if (Phase === GamePhase.SelectMode) {
      State.PlayTurn(DiceMode.None);
    } else {
      break;
    }
  }
}

describe('v1.2 变体包 A 优先级', () => {
  describe('G-001 公敌税', () => {
    it('轮次结束时唯一领先者缴纳 1 点私有到公共池', () => {
      const State = new GameState(CreateVariantConfig(2, 1));
      State.Start();
      CompleteLaunch(State);

      while (State.CurrentPlayer !== 0 && !State.IsOver) {
        State.PlayTurn(DiceMode.None);
      }

      State.PlayTurn(DiceMode.Aggressive);
      State.PlayTurn(DiceMode.None);
      State.PlayTurn(DiceMode.None);

      const PublicBefore = State.Snapshot.PublicTerritory;
      const LeaderBefore = Math.max(
        State.Snapshot.Players[0].PrivateTerritory,
        State.Snapshot.Players[1].PrivateTerritory,
      );

      const LastTurn = State.PlayTurn(DiceMode.None);

      expect(LastTurn.LeaderTax).not.toBeNull();
      expect(LastTurn.LeaderTax!.Amount).toBe(1);
      const LeaderAfter = Math.max(
        State.Snapshot.Players[0].PrivateTerritory,
        State.Snapshot.Players[1].PrivateTerritory,
      );
      expect(LeaderAfter).toBe(LeaderBefore - 1);
      expect(State.Snapshot.PublicTerritory).toBe(PublicBefore + 1);
    });

    it('多人并列最高时不征税', () => {
      const State = new GameState(CreateVariantConfig(2, 2));
      State.Start();
      CompleteLaunch(State);

      let LastTurn = State.PlayTurn(DiceMode.None);
      State.PlayTurn(DiceMode.None);

      expect(LastTurn.LeaderTax).toBeNull();
    });

    it('默认配置关闭公敌税', () => {
      const State = new GameState(CreateDefaultConfig(2, 3));
      State.Start();
      CompleteLaunch(State);

      State.PlayTurn(DiceMode.Aggressive);
      State.PlayTurn(DiceMode.None);

      let LastTurn = State.PlayTurn(DiceMode.None);
      State.PlayTurn(DiceMode.None);

      expect(LastTurn.LeaderTax).toBeNull();
    });
  });

  describe('G-002 顺位轮换', () => {
    it('每轮结束后首位玩家按轮次递增', () => {
      const State = new GameState(CreateVariantConfig(3, 4));
      State.Start();
      CompleteLaunch(State);

      const FirstRoundFirst = State.FirstPlayerIndex;
      const RoundBefore = State.RoundIndex;

      let FirstChanged = false;
      let RoundIncreased = false;
      for (let I = 0; I < 12 && !State.IsOver && (!FirstChanged || !RoundIncreased); I++) {
        State.PlayTurn(DiceMode.None);
        if (State.FirstPlayerIndex !== FirstRoundFirst) FirstChanged = true;
        if (State.RoundIndex > RoundBefore) RoundIncreased = true;
      }

      expect(FirstChanged).toBe(true);
      expect(RoundIncreased).toBe(true);
    });

    it('默认配置关闭顺位轮换，首位始终为 0', () => {
      const State = new GameState(CreateDefaultConfig(3, 5));
      State.Start();
      CompleteLaunch(State);

      expect(State.FirstPlayerIndex).toBe(0);

      for (let I = 0; I < 6 && !State.IsOver; I++) {
        State.PlayTurn(DiceMode.None);
      }

      expect(State.FirstPlayerIndex).toBe(0);
    });
  });

  describe('G-003 枯竭冲刺', () => {
    it('公共 ≤30 时正向 RawGain 获得 +2 奖励', () => {
      const State = new GameState({ ...CreateVariantConfig(2, 6), InitialPublic: 30 });
      State.Start();
      CompleteLaunch(State);

      const Turn = State.PlayTurn(DiceMode.Steady);
      expect(Turn.SprintBonus).toBe(2);
      if (Turn.Dice && Turn.Dice.Sum > 0 && Turn.OccupationDelta) {
        expect(Turn.OccupationDelta.PrivateDelta).toBe(Turn.Dice.Sum + 2);
      }
    });

    it('公共 >30 时不触发冲刺奖励', () => {
      const State = new GameState({ ...CreateVariantConfig(2, 7), InitialPublic: 40 });
      State.Start();
      CompleteLaunch(State);

      expect(State.Snapshot.PublicTerritory).toBeGreaterThan(30);

      const Turn = State.PlayTurn(DiceMode.Steady);
      expect(Turn.SprintBonus).toBe(0);
    });

    it('激进倒扣不享受冲刺奖励', () => {
      const State = new GameState({ ...CreateVariantConfig(2, 8), InitialPublic: 10 });
      State.Start();
      CompleteLaunch(State);

      let FoundDeducted = false;
      for (let I = 0; I < 200 && !State.IsOver && !FoundDeducted; I++) {
        const Turn = State.PlayTurn(DiceMode.Aggressive);
        if (Turn.Dice && Turn.Dice.IsDeducted) {
          FoundDeducted = true;
          expect(Turn.SprintBonus).toBe(0);
        }
      }
      expect(FoundDeducted).toBe(true);
    });

    it('默认配置关闭枯竭冲刺', () => {
      const State = new GameState({ ...CreateDefaultConfig(2, 9), InitialPublic: 10 });
      State.Start();
      CompleteLaunch(State);

      const Turn = State.PlayTurn(DiceMode.Steady);
      expect(Turn.SprintBonus).toBe(0);
    });
  });

  describe('Cfg-001 变体配置', () => {
    it('标准变体开启前三项，关闭复仇突袭', () => {
      const Config = CreateVariantConfig(3, 10);
      expect(Config.EnableLeaderTax).toBe(true);
      expect(Config.EnableRotatingStart).toBe(true);
      expect(Config.EnableScarcitySprint).toBe(true);
      expect(Config.EnableRevengeRaid).toBe(false);
      expect(Config.LeaderTaxBase).toBe(1);
      expect(Config.SprintThreshold).toBe(30);
      expect(Config.SprintBonus).toBe(2);
    });

    it('默认配置全部关闭以保持 v1.1 兼容', () => {
      const Config = CreateDefaultConfig(3, 11);
      expect(Config.EnableLeaderTax).toBe(false);
      expect(Config.EnableRotatingStart).toBe(false);
      expect(Config.EnableScarcitySprint).toBe(false);
      expect(Config.EnableRevengeRaid).toBe(false);
    });
  });
});
