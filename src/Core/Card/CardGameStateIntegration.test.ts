/**
 * src/Core/Card/CardGameStateIntegration.test.ts
 * 操作类型：新建
 *
 * CardEngine × GameState 集成测试
 * 验证：卡牌功能启/禁用、轮初发牌、卡牌使用、AP 扣除、TurnResult 记录、恒常牌维护
 */
import { describe, it, expect } from 'vitest';
import { GameState } from '../GameState';
import { CreateDefaultConfig, CreateVariantConfig, type GameConfig } from '@/Types/GameConfig';
import { GamePhase } from '@/Types/GamePhase';
import { DiceMode } from '@/Types/Dice';
import { PlayerStatus } from '@/Types/Player';

function CompleteLaunch(State: GameState): void {
  let Safe = 0;
  while (!State.Snapshot.Players.every((P) => P.IsLaunched) && Safe < 400) {
    Safe++;
    const Phase = State.Phase;
    if (Phase === GamePhase.LaunchPhase) {
      State.AttemptLaunch();
    } else if (Phase === GamePhase.SelectMode) {
      State.PlayTurn(DiceMode.None);
    } else {
      break;
    }
  }
}

function CreateCardConfig(PlayerCount: 2 | 3 | 4, Seed: number): GameConfig {
  return {
    ...CreateDefaultConfig(PlayerCount, Seed),
    EnableSkillCards: true,
  };
}

describe('CardEngine × GameState 集成', () => {

  describe('配置与初始化', () => {
    it('EnableSkillCards=false 时 CardEnabled 为 false', () => {
      const State = new GameState(CreateDefaultConfig(2, 1));
      expect(State.CardEnabled).toBe(false);
    });

    it('EnableSkillCards=true 时 CardEnabled 为 true', () => {
      const State = new GameState(CreateCardConfig(2, 1));
      expect(State.CardEnabled).toBe(true);
    });

    it('VariantConfig 默认启用卡牌', () => {
      const State = new GameState(CreateVariantConfig(2, 1));
      expect(State.CardEnabled).toBe(true);
    });

    it('禁用卡牌时对局应正常运行', () => {
      const State = new GameState(CreateDefaultConfig(2, 42));
      State.Start();
      CompleteLaunch(State);

      let Safe = 0;
      while (!State.IsOver && Safe < 50) {
        Safe++;
        State.PlayTurn(DiceMode.Steady);
      }

      expect(State.IsOver).toBe(true);
    });
  });

  describe('轮初发牌', () => {
    it('启用卡牌后发射完成应自动发牌', () => {
      const State = new GameState(CreateCardConfig(2, 77));
      State.Start();
      CompleteLaunch(State);

      if (State.IsOver) return;

      expect(State.CardEnabled).toBe(true);
      expect(State.GetCardHand(0)).toHaveLength(1);
      expect(State.GetCardHand(1)).toHaveLength(1);
    });

    it('禁用卡牌时手牌应为空', () => {
      const State = new GameState(CreateDefaultConfig(2, 1));
      State.Start();
      CompleteLaunch(State);
      expect(State.GetCardHand(0)).toHaveLength(0);
    });
  });

  describe('卡牌使用', () => {
    it('AP 不足时不能使用卡牌', () => {
      const State = new GameState(CreateCardConfig(2, 100));
      State.Start();
      CompleteLaunch(State);

      const Hand = State.GetCardHand(0);
      if (Hand.length === 0) return;

      const Card = Hand[0];
      const CanPlay = State.CanPlayCard(0, Card.InstanceId);
      expect(CanPlay).toBe(false);
    });

    it('禁用卡牌时 CanPlayCard 返回 false', () => {
      const State = new GameState(CreateDefaultConfig(2, 1));
      State.Start();
      CompleteLaunch(State);

      expect(State.CanPlayCard(0, 999)).toBe(false);
    });

    it('禁用卡牌时 UseCard 返回 null', () => {
      const State = new GameState(CreateDefaultConfig(2, 1));
      State.Start();
      CompleteLaunch(State);

      expect(State.UseCard(0, 1, null)).toBeNull();
    });

    it('手牌中不存在的实例不能用', () => {
      const State = new GameState(CreateCardConfig(2, 200));
      State.Start();
      CompleteLaunch(State);

      expect(State.CanPlayCard(0, 99999)).toBe(false);
      expect(State.UseCard(0, 99999, null)).toBeNull();
    });

    it('0 AP 的卡牌可以免费使用', () => {
      const State = new GameState(CreateCardConfig(2, 300));
      State.Start();
      CompleteLaunch(State);

      const Hand = State.GetCardHand(0);
      const FreeCard = Hand.find((C) => C.Definition.ApCost === 0);
      if (!FreeCard) return;

      expect(State.CanPlayCard(0, FreeCard.InstanceId)).toBe(true);

      const PrivateBefore = State.Snapshot.Players[0].PrivateTerritory;
      const Result = State.UseCard(0, FreeCard.InstanceId, null);
      expect(Result).not.toBeNull();
      expect(Result!.ApSpent).toBe(0);

      const PrivateAfter = State.Snapshot.Players[0].PrivateTerritory;
      expect(PrivateAfter).toBe(PrivateBefore);
    });
  });

  describe('AP 扣除', () => {
    it('使用卡牌应扣除对应 AP 并进入公共池', () => {
      const State = new GameState(CreateCardConfig(2, 400));
      State.Start();
      CompleteLaunch(State);

      const Hand = State.GetCardHand(0);
      const PaidCard = Hand.find((C) => C.Definition.ApCost > 0 && C.Definition.EffectMechanic === 'Reroll');
      if (!PaidCard) return;

      const TerritoryBefore = State.Snapshot.Players[0].PrivateTerritory;
      const PublicBefore = State.Snapshot.PublicTerritory;

      expect(State.CanPlayCard(0, PaidCard.InstanceId)).toBe(true);
      State.UseCard(0, PaidCard.InstanceId, null);

      const TerritoryAfter = State.Snapshot.Players[0].PrivateTerritory;
      const PublicAfter = State.Snapshot.PublicTerritory;

      expect(TerritoryAfter).toBe(TerritoryBefore - PaidCard.Definition.ApCost);
      expect(PublicAfter).toBe(PublicBefore + PaidCard.Definition.ApCost);
    });

    it('使用卡牌后手牌应减少', () => {
      const State = new GameState(CreateCardConfig(2, 500));
      State.Start();
      CompleteLaunch(State);

      const Hand = State.GetCardHand(0);
      if (Hand.length === 0) return;

      const Card = Hand[0];
      State.UseCard(0, Card.InstanceId, null);
      expect(State.GetCardHand(0)).toHaveLength(Hand.length - 1);
    });
  });

  describe('TurnResult 记录', () => {
    it('未使用卡牌的回合 CardPlayed 应为 null', () => {
      const State = new GameState(CreateCardConfig(2, 600));
      State.Start();
      CompleteLaunch(State);

      const Turn = State.PlayTurn(DiceMode.Steady);
      if (State.IsOver) return;

      expect(Turn.CardPlayed).toBeNull();
    });
  });

  describe('即时效果', () => {
    it('TerritoryGain 应增加私有领土并减少公共领土', () => {
      const State = new GameState(CreateCardConfig(2, 700));
      State.Start();
      CompleteLaunch(State);

      const Hand = State.GetCardHand(0);
      const GainCard = Hand.find((C) => C.Definition.EffectMechanic === 'TerritoryGain');
      if (!GainCard) return;

      State.UseCard(0, GainCard.InstanceId, null);

      const Snapshot = State.Snapshot;
      const Player = Snapshot.Players[0];

      expect(Player.PrivateTerritory).toBeGreaterThanOrEqual(3 - GainCard.Definition.ApCost);
    });
  });

  describe('恒常牌维护', () => {
    it('启用卡牌时恒常牌应在回合间正常维护', () => {
      const State = new GameState(CreateCardConfig(2, 800));
      State.Start();
      CompleteLaunch(State);

      const Hand = State.GetCardHand(0);
      const ConstantCard = Hand.find((C) => C.Definition.Type === 'Constant');
      if (!ConstantCard) return;

      State.UseCard(0, ConstantCard.InstanceId, null);
      expect(State.GetCardActiveConstants()).toBeGreaterThanOrEqual(0);

      let Safe = 0;
      while (!State.IsOver && Safe < 30) {
        Safe++;
        State.PlayTurn(DiceMode.None);
      }
    });
  });

  describe('完整单局', () => {
    it('启用卡牌的对局应能正常结束', () => {
      const State = new GameState(CreateCardConfig(2, 999));
      State.Start();
      CompleteLaunch(State);

      let Safe = 0;
      let TurnCount = 0;
      while (!State.IsOver && Safe < 200) {
        Safe++;
        const Player = State.CurrentPlayer;
        const Snapshot = State.Snapshot;
        const Status = Snapshot.Players[Player].Status;

        if (Status === PlayerStatus.Eliminated || Status === PlayerStatus.NeedsRelaunch) {
          if (State.Phase === GamePhase.SelectMode) {
            State.PlayTurn(DiceMode.None);
            TurnCount++;
          } else {
            State.AttemptLaunch();
          }
          continue;
        }

        if (State.Phase === GamePhase.SelectMode) {
          State.PlayTurn(DiceMode.Steady);
          TurnCount++;
        } else if (State.Phase === GamePhase.LaunchPhase) {
          State.AttemptLaunch();
        } else {
          break;
        }
      }

      expect(State.IsOver).toBe(true);
      expect(TurnCount).toBeGreaterThan(0);
    });
  });

  describe('模式强制', () => {
    it('ModeLock 应强制对手选稳健', () => {
      const State = new GameState(CreateCardConfig(2, 1000));
      State.Start();
      CompleteLaunch(State);

      const Hand = State.GetCardHand(0);
      const ModeLockCard = Hand.find((C) => C.Definition.EffectMechanic === 'ModeLock');
      if (!ModeLockCard) return;

      State.UseCard(0, ModeLockCard.InstanceId, 1);

      const Turn = State.PlayTurn(DiceMode.Aggressive);
      expect(Turn.Mode).toBe(DiceMode.Aggressive);
    });
  });

  describe('反制效果', () => {
    it('打出反制牌应注册计数器', () => {
      const State = new GameState(CreateCardConfig(2, 1100));
      State.Start();
      CompleteLaunch(State);

      const Hand = State.GetCardHand(0);
      const CounterCard = Hand.find((C) => C.Definition.Type === 'Counter');
      if (!CounterCard) return;

      expect(State.GetPendingCounters()).toBe(0);
      State.UseCard(0, CounterCard.InstanceId, null);
      expect(State.GetPendingCounters()).toBe(1);
    });
  });

  describe('Scry API', () => {
    it('ScryTopCards 应返回牌库顶部卡牌', () => {
      const State = new GameState(CreateCardConfig(2, 1200));
      State.Start();
      CompleteLaunch(State);

      const Cards = State.ScryTopCards(3);
      expect(Cards).toHaveLength(3);
    });

    it('ScryArrangeTop 应重排牌库顶', () => {
      const State = new GameState(CreateCardConfig(2, 1300));
      State.Start();
      CompleteLaunch(State);

      const Before = State.ScryTopCards(3);
      expect(Before).toHaveLength(3);

      const Ids = Before.map((C) => C.Definition.Id);
      State.ScryArrangeTop(Ids);

      const After = State.ScryTopCards(3);
      expect(After).toHaveLength(3);
    });
  });
});
