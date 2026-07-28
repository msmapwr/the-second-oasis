/**
 * src/AI/DecisionMaker.ts
 * 操作类型：新建
 *
 * 混合决策器
 * 关联：D 优先级 AI 对手模块 §Phase 4
 *
 * 设计要点：
 * 1. 先由 Evaluator 做启发式评分
 * 2. 难度启用前瞻时，由 Simulator 补充模拟评分
 * 3. 按难度权重合并启发式与模拟分数
 * 4. 应用性格矫正与难度噪声
 * 5. 输出 DecisionTrace 透明日志
 */
import type { PlayerId } from '@/Types/Player';
import { DiceMode } from '@/Types/Dice';
import type { AIDifficulty, AIPersonality } from '@/Types/AI';
import { AIDifficulty as AIDifficultyEnum } from '@/Types/AI';
import type { IRandomSource } from '@/Utils/Random/IRandomSource';
import type { TerritorySnapshot } from '@/Types/Territory';
import { EvaluateMode } from './Evaluator';
import { GetDifficultyProfile } from './Difficulty';
import { SimulateFirstMode } from './Simulator';
import type { GrudgeRecord } from './Memory';
import type { ModeDecisionTrace } from './TransparentLog';

/**
 * 决策输入上下文
 */
export interface DecideModeContext {
  readonly PlayerId: PlayerId;
  readonly Snapshot: TerritorySnapshot;
  readonly ConsecutiveDoubles: number;
  readonly RobberyTriggeredCount: number;
  readonly CollapseX: number;
  readonly Grudges: readonly GrudgeRecord[];
  readonly Personality: AIPersonality;
  readonly Difficulty: AIDifficulty;
  readonly TurnNumber: number;
}

const ALL_MODES: DiceMode[] = [DiceMode.Steady, DiceMode.Aggressive, DiceMode.None];

/**
 * 为当前玩家选择模式
 */
export function DecideMode(
  Context: DecideModeContext,
  Random: IRandomSource,
): { Mode: DiceMode; Trace: ModeDecisionTrace } {
  const Start = performance.now();
  const Profile = GetDifficultyProfile(Context.Difficulty);

  const Evaluations = ALL_MODES.map((Mode) =>
    EvaluateMode(
      {
        Snapshot: Context.Snapshot,
        PlayerId: Context.PlayerId,
        ConsecutiveDoubles: Context.ConsecutiveDoubles,
        RobberyTriggeredCount: Context.RobberyTriggeredCount,
        CollapseX: Context.CollapseX,
        Grudges: Context.Grudges,
        Personality: Context.Personality,
        Difficulty: Context.Difficulty,
        TurnNumber: Context.TurnNumber,
      },
      Mode,
    ),
  );

  // 启发式分数归一化到同一量级，便于与模拟分数合并
  const HeuristicScores = Evaluations.map((E) => E.HeuristicScore);
  const HMin = Math.min(...HeuristicScores);
  const HMax = Math.max(...HeuristicScores);
  const HRange = HMax - HMin || 1;

  // 模拟评分（仅高难启用）
  const SimulatedScores: number[] = new Array(ALL_MODES.length).fill(0);
  if (Profile.LookaheadDepth > 0 && Profile.SimulationBranches > 0) {
    for (let I = 0; I < ALL_MODES.length; I++) {
      const Mode = ALL_MODES[I];
      const Sim = SimulateFirstMode(
        Context.Snapshot,
        Context.PlayerId,
        Mode,
        Profile.LookaheadDepth,
        Profile.SimulationBranches,
        Random,
        Context.CollapseX,
        Context.RobberyTriggeredCount,
        Context.PlayerId,
      );
      // 模拟分数：胜率主导 + 最终私有加权
      SimulatedScores[I] =
        Sim.WinProbability * 100 +
        Sim.ExpectedFinalOwn * 0.5 -
        Sim.ExpectedBestOpponent * 0.3 -
        Sim.OverloadProbability * 50;
    }
  }

  const SMin = Math.min(...SimulatedScores);
  const SMax = Math.max(...SimulatedScores);
  const SRange = SMax - SMin || 1;

  // 合并分数
  const FinalScores = Evaluations.map((E, I) => {
    const NormalizedHeuristic = (E.HeuristicScore - HMin) / HRange * 100;
    const NormalizedSim = (SimulatedScores[I] - SMin) / SRange * 100;
    const Base =
      NormalizedHeuristic * (1 - Profile.SimWeight) +
      NormalizedSim * Profile.SimWeight;
    return Base;
  });

  // 应用性格微调（已在 Evaluator 中部分应用，这里做最终加权）
  for (let I = 0; I < ALL_MODES.length; I++) {
    const Mode = ALL_MODES[I];
    const E = Evaluations[I];
    if (Mode === DiceMode.Aggressive) {
      FinalScores[I] += Context.Personality.Aggressiveness * 3;
      FinalScores[I] -= E.RiskBreakdown.OverloadChance * 8 * (1 - Context.Personality.RiskTolerance);
    } else if (Mode === DiceMode.Steady) {
      FinalScores[I] += (1 - Context.Personality.Aggressiveness) * 1.5;
    } else {
      FinalScores[I] += Context.Personality.Patience * 1;
    }
  }

  // 加入难度噪声（Rookie 最大，Master 0）
  if (Profile.EvaluationNoise > 0) {
    for (let I = 0; I < FinalScores.length; I++) {
      const Noise = (Random.NextInt(0, 1000) / 1000 - 0.5) * 2 * Profile.EvaluationNoise * 50;
      FinalScores[I] += Noise;
    }
  }

  // 选择最高分的模式
  let BestIndex = 0;
  let BestScore = FinalScores[0];
  for (let I = 1; I < FinalScores.length; I++) {
    if (FinalScores[I] > BestScore) {
      BestScore = FinalScores[I];
      BestIndex = I;
    }
  }

  const SelectedMode = ALL_MODES[BestIndex];
  const End = performance.now();

  // 组装透明日志（注意 FinalScore 写入 Evaluations 副本）
  const EvaluationsWithFinal = Evaluations.map((E, I) => ({
    ...E,
    FinalScore: FinalScores[I],
  }));

  const Trace: ModeDecisionTrace = {
    Type: 'Mode',
    PlayerId: Context.PlayerId,
    Difficulty: Context.Difficulty,
    Personality: Context.Personality,
    Grudges: Context.Grudges,
    Evaluations: EvaluationsWithFinal,
    SelectedMode,
    Reason: BuildReason(SelectedMode, EvaluationsWithFinal, Context.Personality),
    ThinkingTimeMs: Math.round(End - Start),
  };

  return { Mode: SelectedMode, Trace };
}

/**
 * 生成人类可读的决策理由
 */
function BuildReason(
  SelectedMode: DiceMode,
  Evaluations: ReadonlyArray<{
    readonly Mode: DiceMode;
    readonly HeuristicScore: number;
    readonly FinalScore: number;
    readonly RiskBreakdown: {
      readonly OverloadChance: number;
      readonly RobberyChance: number;
      readonly CollapseChance: number;
    };
  }>,
  Personality: AIPersonality,
): string {
  const Selected = Evaluations.find((E) => E.Mode === SelectedMode)!;
  const ScoreStr = Selected.FinalScore.toFixed(1);
  const Risk = Selected.RiskBreakdown;

  const Parts: string[] = [];
  if (SelectedMode === DiceMode.Aggressive) {
    Parts.push('选择激进：期望收益最高');
  } else if (SelectedMode === DiceMode.Steady) {
    Parts.push('选择稳健：风险可控');
  } else {
    Parts.push('选择不开发：保留实力');
  }

  if (Risk.OverloadChance > 0.15) {
    Parts.push(`开发过度风险 ${(Risk.OverloadChance * 100).toFixed(0)}%`);
  }
  if (Risk.RobberyChance > 0.1) {
    Parts.push('可能触发抢夺');
  }
  if (Risk.CollapseChance > 0.1) {
    Parts.push('可能触发崩坏');
  }

  if (Personality.Aggressiveness > 0.7) {
    Parts.push('性格激进');
  } else if (Personality.Aggressiveness < 0.3) {
    Parts.push('性格保守');
  }

  Parts.push(`综合评分 ${ScoreStr}`);
  return Parts.join('，');
}

/**
 * 工具：把 AIDifficulty 数值当枚举用时导出
 */
export { AIDifficultyEnum };
