/**
 * 蒙特卡洛模拟脚本——验证对局平衡性
 * 关联规范：CodeBuddy代码规范 §12 性能与质量底线
 *
 * 模拟大量对局，统计：
 * - 平均对局时长（回合数）
 * - 各位置胜率
 * - 抢夺/崩坏/开发过度触发频率
 * - 终局私有领土分布
 *
 * 用法：npx tsx src/Core/MonteCarloSimulation.ts
 */
import { GameState } from './GameState';
import { CreateDefaultConfig, CreateVariantConfig } from '@/Types/GameConfig';
import { GamePhase } from '@/Types/GamePhase';
import { DiceMode } from '@/Types/Dice';
import { ALL_TAROT_CARDS } from './Card/CardData';
import type { CardDefinition } from '@/Types/Card';

interface GameStats {
  Turns: number;
  WinnerId: number;
  RobberyTriggered: boolean;
  CollapseCount: number;
  OverloadCount: number;
  FinalPrivateMax: number;
  FinalPrivateSum: number;
  CardsUsed: number;
  CardUsages: Map<string, { Uses: number; Wins: number }>;
}

interface CardUsageEntry {
  CardId: string;
  Name: string;
  Suit: string;
  ApCost: number;
  Type: string;
  Uses: number;
  Wins: number;
}

function SimulateOneGame(
  PlayerCount: 2 | 3 | 4,
  Seed: number,
  Mode: DiceMode = DiceMode.Aggressive,
  UseCards: boolean = false,
  CollectCardStats: boolean = false,
): GameStats {
  const Config = UseCards
    ? CreateVariantConfig(PlayerCount, Seed)
    : CreateDefaultConfig(PlayerCount, Seed);
  const State = new GameState(Config);
  State.Start();

  let Turns = 0;
  let RobberyTriggered = false;
  let CollapseCount = 0;
  let OverloadCount = 0;
  let CardsUsed = 0;
  const MaxIter = 2000;
  const UsedCardIds: string[] = [];

  while (!State.IsOver && Turns < MaxIter) {
    const Phase = State.Phase as GamePhase;
    const RobberyBefore = State.RobberyTriggeredCount;
    const XBefore = State.CollapseX;

    if (Phase === GamePhase.LaunchPhase) {
      if (UseCards) {
        const CurrId = State.CurrentPlayer;
        const Hand = State.GetCardHand(CurrId);
        for (const Card of Hand) {
          if (Card.Definition.EffectPhase === 'LaunchPhase' &&
              State.CanPlayCard(CurrId, Card.InstanceId)) {
            const R = State.UseCard(CurrId, Card.InstanceId, null);
            if (R) { CardsUsed++; UsedCardIds.push(R.CardId); }
          }
        }
      }
      State.AttemptLaunch();
    } else if (Phase === GamePhase.SelectMode) {
      if (UseCards) {
        const CurrId = State.CurrentPlayer;
        const Hand = State.GetCardHand(CurrId);
        for (const Card of Hand) {
          if (State.CanPlayCard(CurrId, Card.InstanceId)) {
            const R = State.UseCard(CurrId, Card.InstanceId, null);
            if (R) { CardsUsed++; UsedCardIds.push(R.CardId); }
          }
        }
      }
      const Turn = State.PlayTurn(Mode);
      if (Turn.IsOverload) OverloadCount++;
      if (Turn.Robbery) RobberyTriggered = true;
      if (Turn.Collapse) CollapseCount++;
    } else if (Phase === GamePhase.Tiebreaker) {
      State.RunTiebreaker();
    } else {
      break;
    }
    Turns++;
    if (State.CollapseX > XBefore) CollapseCount++;
    if (State.RobberyTriggeredCount > RobberyBefore) RobberyTriggered = true;
  }

  const Players = State.Snapshot.Players;
  const WinnerId = State.Result?.Winners[0]?.Id ?? -1;

  const CardUsages = new Map<string, { Uses: number; Wins: number }>();
  if (CollectCardStats) {
    for (const Cid of UsedCardIds) {
      const Entry = CardUsages.get(Cid) ?? { Uses: 0, Wins: 0 };
      Entry.Uses++;
      CardUsages.set(Cid, Entry);
    }
  }

  return {
    Turns,
    WinnerId,
    RobberyTriggered,
    CollapseCount,
    OverloadCount,
    FinalPrivateMax: Math.max(...Players.map((P) => P.PrivateTerritory)),
    FinalPrivateSum: Players.reduce((S, P) => S + P.PrivateTerritory, 0),
    CardsUsed,
    CardUsages,
  };
}

/** 批量模拟并汇总统计 */
export function RunSimulation(
  PlayerCount: 2 | 3 | 4,
  GameCount: number = 1000,
  Mode: DiceMode = DiceMode.Aggressive,
  BaseSeed: number = 1,
  UseCards: boolean = false,
  CollectCardStats: boolean = false,
): {
  PlayerCount: number;
  GameCount: number;
  AvgTurns: number;
  MinTurns: number;
  MaxTurns: number;
  WinRates: number[];
  RobberyRate: number;
  CollapseRate: number;
  AvgCollapseCount: number;
  OverloadRate: number;
  AvgFinalMax: number;
  AvgFinalSum: number;
  AvgCardsUsed: number;
  CardUsageList: CardUsageEntry[];
} {
  const Stats: GameStats[] = [];
  for (let I = 0; I < GameCount; I++) {
    Stats.push(SimulateOneGame(PlayerCount, BaseSeed + I, Mode, UseCards, CollectCardStats));
  }

  const TurnCounts = Stats.map((S) => S.Turns);
  const WinRates = new Array(PlayerCount).fill(0);
  for (const S of Stats) {
    if (S.WinnerId >= 0) WinRates[S.WinnerId]++;
  }

  const RobberyCount = Stats.filter((S) => S.RobberyTriggered).length;
  const CollapseGames = Stats.filter((S) => S.CollapseCount > 0).length;
  const OverloadGames = Stats.filter((S) => S.OverloadCount > 0).length;
  const Avg = (Arr: number[]) => Arr.reduce((A, B) => A + B, 0) / Arr.length;

  const AggCardMap = new Map<string, CardUsageEntry>();
  if (CollectCardStats) {
    for (const S of Stats) {
      for (const [CardId, Stat] of S.CardUsages) {
        const Entry = AggCardMap.get(CardId) ?? {
          CardId, Name: CardId, Suit: '', ApCost: 0, Type: '', Uses: 0, Wins: 0,
        };
        Entry.Uses += Stat.Uses;
        AggCardMap.set(CardId, Entry);
      }
    }
  }

  return {
    PlayerCount,
    GameCount,
    AvgTurns: Avg(TurnCounts),
    MinTurns: Math.min(...TurnCounts),
    MaxTurns: Math.max(...TurnCounts),
    WinRates: WinRates.map((C) => C / GameCount),
    RobberyRate: RobberyCount / GameCount,
    CollapseRate: CollapseGames / GameCount,
    AvgCollapseCount: Avg(Stats.map((S) => S.CollapseCount)),
    OverloadRate: OverloadGames / GameCount,
    AvgFinalMax: Avg(Stats.map((S) => S.FinalPrivateMax)),
    AvgFinalSum: Avg(Stats.map((S) => S.FinalPrivateSum)),
    AvgCardsUsed: Avg(Stats.map((S) => S.CardsUsed)),
    CardUsageList: Array.from(AggCardMap.values()),
  };
}

function Main(): void {
  console.log('=== 《第二绿洲》蒙特卡洛平衡性模拟 ===\n');

  for (const PlayerCount of [2, 3, 4] as const) {
    console.log(`--- ${PlayerCount} 人局（无卡牌，1000 局）---`);
    const R = RunSimulation(PlayerCount, 1000, DiceMode.Aggressive, 1, false);
    console.log(`  平均回合: ${R.AvgTurns.toFixed(1)} (${R.MinTurns}~${R.MaxTurns})`);
    console.log(`  胜率: ${R.WinRates.map((W) => (W * 100).toFixed(1) + '%').join(', ')}`);
    console.log(`  抢夺率: ${(R.RobberyRate * 100).toFixed(1)}%  崩坏率: ${(R.CollapseRate * 100).toFixed(1)}%  过度率: ${(R.OverloadRate * 100).toFixed(1)}%`);
    console.log(`  终局最高: ${R.AvgFinalMax.toFixed(1)}  总和: ${R.AvgFinalSum.toFixed(1)}`);
    console.log();

    const GameN = PlayerCount === 2 ? 10000 : 5000;
    console.log(`--- ${PlayerCount} 人局（含卡牌，${GameN} 局，收集卡牌统计）---`);
    const RC = RunSimulation(PlayerCount, GameN, DiceMode.Aggressive, 50000 + PlayerCount * 10000, true, true);
    console.log(`  平均回合: ${RC.AvgTurns.toFixed(1)} (${RC.MinTurns}~${RC.MaxTurns})`);
    console.log(`  胜率: ${RC.WinRates.map((W) => (W * 100).toFixed(1) + '%').join(', ')}`);
    console.log(`  抢夺率: ${(RC.RobberyRate * 100).toFixed(1)}%  崩坏率: ${(RC.CollapseRate * 100).toFixed(1)}%  过度率: ${(RC.OverloadRate * 100).toFixed(1)}%`);
    console.log(`  用牌: ${RC.AvgCardsUsed.toFixed(1)} 张/局  终局最高: ${RC.AvgFinalMax.toFixed(1)}  总和: ${RC.AvgFinalSum.toFixed(1)}`);
    console.log();

    const CardMeta = new Map<string, CardDefinition>(ALL_TAROT_CARDS.map((C) => [C.Id, C]));
    const Sorted = RC.CardUsageList
      .filter((U) => U.Uses > 0)
      .sort((A, B) => B.Uses - A.Uses);

    if (Sorted.length > 0) {
      const TotalGames = RC.GameCount;
      const GameLoop = TotalGames * RC.AvgTurns;
      console.log('  卡牌使用率 TOP 20（按使用次数降序）：');
      console.log('  ' + 'ID'.padEnd(24) + '花色'.padEnd(6) + 'AP'.padEnd(4) + '使用次数'.padEnd(10) + '每轮率');
      const TopN = Sorted.slice(0, 20);
      for (const U of TopN) {
        const Meta = CardMeta.get(U.CardId);
        const Name = Meta?.NameCn ?? U.CardId;
        const Suit = Meta?.Suit ?? '';
        const Ap = Meta?.ApCost ?? 0;
        const Rate = GameLoop > 0 ? (U.Uses / GameLoop * 100).toFixed(2) + '%' : '0%';
        console.log('  ' + Name.padEnd(20) + Suit.padEnd(8) + String(Ap).padEnd(4) + String(U.Uses).padEnd(10) + Rate);
      }
      console.log();

      const BySuit = new Map<string, { Uses: number; Count: number }>();
      for (const U of Sorted) {
        const Meta = CardMeta.get(U.CardId);
        const Suit = Meta?.Suit ?? 'Unknown';
        const E = BySuit.get(Suit) ?? { Uses: 0, Count: 0 };
        E.Uses += U.Uses;
        E.Count++;
        BySuit.set(Suit, E);
      }
      console.log('  花色贡献度：');
      const SuitTotal = Sorted.reduce((S, U) => S + U.Uses, 0);
      const SuitOrder = ['Major', 'Swords', 'Wands', 'Cups', 'Pentacles'];
      for (const Suit of SuitOrder) {
        const E = BySuit.get(Suit);
        if (E) {
          const Pct = SuitTotal > 0 ? (E.Uses / SuitTotal * 100).toFixed(1) + '%' : '0%';
          console.log('    ' + Suit.padEnd(12) + E.Count + '张  使用' + E.Uses + '次  ' + Pct);
        }
      }
      console.log();
    }
  }
}

// 命令行入口导出（ESM 下手动调用 Main()）
export { Main };

Main();
