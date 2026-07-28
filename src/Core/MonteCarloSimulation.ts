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

interface GameStats {
  Turns: number;
  WinnerId: number;
  RobberyTriggered: boolean;
  CollapseCount: number;
  OverloadCount: number;
  FinalPrivateMax: number;
  FinalPrivateSum: number;
  CardsUsed: number;
}

/** 模拟一局对局，返回统计 */
function SimulateOneGame(
  PlayerCount: 2 | 3 | 4,
  Seed: number,
  Mode: DiceMode = DiceMode.Aggressive,
  UseCards: boolean = false,
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
            State.UseCard(CurrId, Card.InstanceId, null);
            CardsUsed++;
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
            State.UseCard(CurrId, Card.InstanceId, null);
            CardsUsed++;
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
  const FinalPrivateMax = Math.max(...Players.map((P) => P.PrivateTerritory));
  const FinalPrivateSum = Players.reduce((S, P) => S + P.PrivateTerritory, 0);

  return {
    Turns,
    WinnerId: State.Result?.Winners[0]?.Id ?? -1,
    RobberyTriggered,
    CollapseCount,
    OverloadCount,
    FinalPrivateMax,
    FinalPrivateSum,
    CardsUsed,
  };
}

/** 批量模拟并汇总统计 */
export function RunSimulation(
  PlayerCount: 2 | 3 | 4,
  GameCount: number = 1000,
  Mode: DiceMode = DiceMode.Aggressive,
  BaseSeed: number = 1,
  UseCards: boolean = false,
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
} {
  const Stats: GameStats[] = [];
  for (let I = 0; I < GameCount; I++) {
    Stats.push(SimulateOneGame(PlayerCount, BaseSeed + I, Mode, UseCards));
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
  };
}

function Main(): void {
  console.log('=== 《第二绿洲》蒙特卡洛平衡性模拟 ===\n');

  for (const PlayerCount of [2, 3, 4] as const) {
    console.log(`--- ${PlayerCount} 人局（激进模式，无卡牌，1000 局）---`);
    const R = RunSimulation(PlayerCount, 1000, DiceMode.Aggressive, 1, false);
    console.log(`  平均回合数: ${R.AvgTurns.toFixed(1)} (min=${R.MinTurns}, max=${R.MaxTurns})`);
    console.log(`  胜率: ${R.WinRates.map((W) => (W * 100).toFixed(1) + '%').join(', ')}`);
    console.log(`  抢夺触发率: ${(R.RobberyRate * 100).toFixed(1)}%`);
    console.log(`  崩坏触发率: ${(R.CollapseRate * 100).toFixed(1)}% (平均 ${R.AvgCollapseCount.toFixed(2)} 次/局)`);
    console.log(`  开发过度触发率: ${(R.OverloadRate * 100).toFixed(1)}%`);
    console.log(`  终局最高私有平均: ${R.AvgFinalMax.toFixed(1)}`);
    console.log(`  终局私有总和平均: ${R.AvgFinalSum.toFixed(1)}`);
    console.log();

    console.log(`--- ${PlayerCount} 人局（激进模式，含卡牌，100 局）---`);
    const RC = RunSimulation(PlayerCount, 100, DiceMode.Aggressive, 10000, true);
    console.log(`  平均回合数: ${RC.AvgTurns.toFixed(1)} (min=${RC.MinTurns}, max=${RC.MaxTurns})`);
    console.log(`  胜率: ${RC.WinRates.map((W) => (W * 100).toFixed(1) + '%').join(', ')}`);
    console.log(`  抢夺触发率: ${(RC.RobberyRate * 100).toFixed(1)}%`);
    console.log(`  崩坏触发率: ${(RC.CollapseRate * 100).toFixed(1)}% (平均 ${RC.AvgCollapseCount.toFixed(2)} 次/局)`);
    console.log(`  开发过度触发率: ${(RC.OverloadRate * 100).toFixed(1)}%`);
    console.log(`  平均使用卡牌: ${RC.AvgCardsUsed.toFixed(1)} 张/局`);
    console.log(`  终局最高私有平均: ${RC.AvgFinalMax.toFixed(1)}`);
    console.log(`  终局私有总和平均: ${RC.AvgFinalSum.toFixed(1)}`);
    console.log();
  }
}

// 命令行入口导出（ESM 下手动调用 Main()）
export { Main };

Main();
