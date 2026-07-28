/**
 * server/AIController.ts
 * 操作类型：修改
 *
 * 断线玩家 AI 接管控制器。
 * v1.3.2：集成 CardStrategist 卡牌决策 + UseCard 钩子。
 */
import { DiceMode } from './Types';
import type { GameState } from './Types';
import type { CardDecision } from '@/AI/CardStrategist';

const CARD_DIFFICULTY = 3;

export interface IAIController {
  SelectDiceMode(State: GameState, PlayerId: number): DiceMode;
  ShouldAttemptLaunch(State: GameState, PlayerId: number): boolean;
  ShouldRunTiebreaker(_State: GameState, _PlayerId: number): boolean;
  GetCardDecisions(State: GameState, PlayerId: number): CardDecision[];
}

export class AIController implements IAIController {
  SelectDiceMode(_State: GameState, _PlayerId: number): DiceMode {
    return Math.random() < 0.7 ? DiceMode.Steady : DiceMode.Aggressive;
  }

  ShouldAttemptLaunch(_State: GameState, _PlayerId: number): boolean {
    return true;
  }

  ShouldRunTiebreaker(_State: GameState, _PlayerId: number): boolean {
    return true;
  }

  GetCardDecisions(State: GameState, PlayerId: number): CardDecision[] {
    if (!State.CardEnabled) return [];
    try {
      const { EvaluateCardHand } = require('@/AI/CardStrategist');
      const CardStore = State as unknown as import('@/Store/GameStore').IGameStore;
      return EvaluateCardHand(CardStore, PlayerId, CARD_DIFFICULTY);
    } catch {
      return [];
    }
  }
}
