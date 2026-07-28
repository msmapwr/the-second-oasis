/**
 * src/AI/Evaluator.ts
 * 操作类型：新建
 *
 * 静态局面评估器
 * 关联：D 优先级 AI 对手模块 §Phase 3
 *
 * 设计要点：
 * 1. 枚举三种模式的全部可能骰子结果，概率加权计算期望
 * 2. 对每个结果调用 Core/Occupation 计算领土变化，保证与真实规则一致
 * 3. 启发式评分综合考虑：自身领土、与最强对手差距、公共池、开发链风险、溢出风险、记仇
 * 4. 仅做静态评估，不做前瞻模拟（前瞻由 Simulator 负责）
 */
import type { PlayerId, PlayerSnapshot } from '@/Types/Player';
import type { TerritorySnapshot } from '@/Types/Territory';
import { DiceMode } from '@/Types/Dice';
import type { DieFace } from '@/Types/Dice';
import { DevMultiplier } from '@/Types/DevChain';
import type { AIDifficulty, AIPersonality } from '@/Types/AI';
import { Occupation } from '@/Core/Occupation';
import { GetDifficultyProfile } from './Difficulty';
import type { GrudgeRecord } from './Memory';
import type { ModeEvaluation } from './TransparentLog';

/**
 * 评估上下文
 */
export interface EvalContext {
  readonly Snapshot: TerritorySnapshot;
  readonly PlayerId: PlayerId;
  /** 本回合前的连击计数（0~2） */
  readonly ConsecutiveDoubles: number;
  /** 本局已触发过的抢夺次数（0=未触发，≥1=后续溢出走崩坏） */
  readonly RobberyTriggeredCount: number;
  /** 当前崩坏系数 */
  readonly CollapseX: number;
  /** 对当前回合衰减后的敌意快照 */
  readonly Grudges: readonly GrudgeRecord[];
  readonly Personality: AIPersonality;
  readonly Difficulty: AIDifficulty;
  /** 当前回合数（从 1 开始） */
  readonly TurnNumber: number;
}

/**
 * 单个枚举结果
 */
interface OutcomeSample {
  readonly Weight: number;
  readonly RawGain: number;
  readonly IsDouble: boolean;
  readonly Multiplier: DevMultiplier;
  readonly IsOverload: boolean;
  readonly PublicAfter: number;
  readonly PrivateDelta: number;
  readonly IsOverflow: boolean;
  readonly OverflowM2: number;
}

const STEADY_FACES: DieFace[] = [1, 2, 3, 4, 5, 6];

const AGGRESSIVE_OUTCOMES: Array<{ A: DieFace; B: DieFace }> = (() => {
  const Out: Array<{ A: DieFace; B: DieFace }> = [];
  for (let A = 1; A <= 6; A++) {
    for (let B = 1; B <= 6; B++) {
      Out.push({ A: A as DieFace, B: B as DieFace });
    }
  }
  return Out;
})();

const OCCUPATION = new Occupation();

/**
 * 评估单个模式
 */
export function EvaluateMode(Context: EvalContext, Mode: DiceMode): ModeEvaluation {
  const Samples = GenerateSamples(Context, Mode);
  const Evaluations = Samples.map((S) => ({
    Sample: S,
    Score: ScoreOutcome(Context, S),
  }));

  const TotalWeight = Evaluations.reduce((Sum, E) => Sum + E.Sample.Weight, 0);
  const EffectiveWeight = TotalWeight === 0 ? 1 : TotalWeight;

  let ExpectedPublicAfter = 0;
  let ExpectedOwnAfter = 0;
  let ExpectedBestOpponentAfter = 0;
  let HeuristicScore = 0;
  let OverloadChance = 0;
  let RobberyChance = 0;
  let CollapseChance = 0;

  for (const E of Evaluations) {
    const W = E.Sample.Weight / EffectiveWeight;
    ExpectedPublicAfter += E.Sample.PublicAfter * W;
    ExpectedOwnAfter += (GetOwnPrivate(Context) + E.Sample.PrivateDelta) * W;
    ExpectedBestOpponentAfter += GetBestOpponentPrivate(Context) * W;
    HeuristicScore += E.Score * W;

    if (E.Sample.IsOverload) OverloadChance += W;
    if (E.Sample.IsOverflow) {
      if (Context.RobberyTriggeredCount === 0) {
        RobberyChance += W;
      } else {
        CollapseChance += W;
      }
    }
  }

  // 性格与难度微调：Rookie 的启发式分数本身已经带噪声，这里不再额外加
  const FinalScore = ApplyPersonalityToScore(
    HeuristicScore,
    Mode,
    Context.Personality,
    Context.Difficulty,
    OverloadChance,
  );

  return {
    Mode,
    ExpectedPublicAfter,
    ExpectedOwnAfter,
    ExpectedBestOpponentAfter,
    HeuristicScore,
    SimulatedScore: 0,
    FinalScore,
    RiskBreakdown: {
      OverloadChance,
      RobberyChance,
      CollapseChance,
    },
  };
}

/**
 * 生成某个模式下的全部等概率样本
 */
function GenerateSamples(Context: EvalContext, Mode: DiceMode): OutcomeSample[] {
  if (Mode === DiceMode.None) {
    const Outcome = OCCUPATION.Calculate(
      Context.Snapshot.PublicTerritory,
      GetOwnPrivate(Context),
      0,
      DevMultiplier.None,
    );
    return [
      {
        Weight: 1,
        RawGain: 0,
        IsDouble: false,
        Multiplier: DevMultiplier.None,
        IsOverload: false,
        PublicAfter: Outcome.PublicAfter,
        PrivateDelta: Outcome.PrivateDelta,
        IsOverflow: Outcome.IsOverflow,
        OverflowM2: Outcome.OverflowM2,
      },
    ];
  }

  if (Mode === DiceMode.Steady) {
    return STEADY_FACES.map((Face) => {
      const Outcome = OCCUPATION.Calculate(
        Context.Snapshot.PublicTerritory,
        GetOwnPrivate(Context),
        Face,
        DevMultiplier.None,
      );
      return {
        Weight: 1,
        RawGain: Face,
        IsDouble: false,
        Multiplier: DevMultiplier.None,
        IsOverload: false,
        PublicAfter: Outcome.PublicAfter,
        PrivateDelta: Outcome.PrivateDelta,
        IsOverflow: Outcome.IsOverflow,
        OverflowM2: Outcome.OverflowM2,
      };
    });
  }

  // Aggressive
  return AGGRESSIVE_OUTCOMES.map(({ A, B }) => {
    const Sum = A + B;
    const IsDouble = A === B;
    const RawGain = Sum <= 6 ? 0 - Sum : Sum;
    const CurrentCount = Context.ConsecutiveDoubles;
    let Multiplier = DevMultiplier.None;
    let IsOverload = false;

    if (IsDouble) {
      const NewCount = CurrentCount + 1;
      if (NewCount >= 3) {
        IsOverload = true;
      } else if (NewCount === 1) {
        Multiplier = DevMultiplier.Dev;
      } else {
        Multiplier = DevMultiplier.BigDev;
      }
    }

    const Outcome = IsOverload
      ? {
          M: 0,
          PublicAfter: Context.Snapshot.PublicTerritory,
          PrivateDelta: 0,
          IsOverflow: false,
          OverflowM2: 0,
          PublicDelta: 0,
        }
      : OCCUPATION.Calculate(
          Context.Snapshot.PublicTerritory,
          GetOwnPrivate(Context),
          RawGain,
          Multiplier,
        );

    return {
      Weight: 1,
      RawGain,
      IsDouble,
      Multiplier,
      IsOverload,
      PublicAfter: Outcome.PublicAfter,
      PrivateDelta: Outcome.PrivateDelta,
      IsOverflow: Outcome.IsOverflow,
      OverflowM2: Outcome.OverflowM2,
    };
  });
}

/**
 * 对单个样本打分
 */
function ScoreOutcome(Context: EvalContext, Sample: OutcomeSample): number {
  if (Sample.IsOverload) {
    const Profile = GetDifficultyProfile(Context.Difficulty);
    return -1000 * Profile.OverloadAversion;
  }

  const OwnAfter = GetOwnPrivate(Context) + Sample.PrivateDelta;
  const BestOppAfter = GetBestOpponentPrivate(Context);
  const Lead = OwnAfter - BestOppAfter;
  const PublicAfter = Sample.PublicAfter;
  const PrivateDelta = Sample.PrivateDelta;

  // 直接奖励私有增量，但不过度放大稳健模式（其每面均为正）相对优势
  let Score = OwnAfter * 1.0 + Lead * 0.6 + PrivateDelta * 0.3;

  // 公共池因子：领先时希望公共尽快归零，落后时希望公共保留；
  // 仅在中后期生效，避免早期把公共池价值放得过大，压过私有增量
  const Profile = GetDifficultyProfile(Context.Difficulty);
  const EndgameProximity = (100 - PublicAfter) / 100;
  const PublicFactor = -Math.tanh(Lead / 20) * Profile.PublicWeight * EndgameProximity;
  Score += PublicAfter * PublicFactor;

  // 记仇：对记仇目标，领先/落后幅度额外加权
  for (const Grudge of Context.Grudges) {
    const Target = Context.Snapshot.Players[Grudge.TargetId];
    if (!Target || Target.Id === Context.PlayerId) continue;
    const Diff = OwnAfter - Target.PrivateTerritory;
    const Weight = Grudge.Score * Profile.GrudgeMultiplier * 0.15;
    Score += Diff * Weight;
  }

  // 溢出风险惩罚：抢夺/崩坏会带来不确定性损失，按系数惩罚
  if (Sample.IsOverflow) {
    if (Context.RobberyTriggeredCount === 0) {
      // 首次溢出：抢夺，风险中等
      Score -= 4 * (1 + Context.Personality.RiskTolerance);
    } else {
      // 后续溢出：崩坏，所有玩家受损，惩罚随 CollapseX 增加
      Score -= 6 * Context.CollapseX * (1 - Context.Personality.RiskTolerance * 0.3);
    }
  }

  // 终局临近加权：公共池少时，领先优势的边际价值提升
  const EndgameWeight = 1 + (100 - Context.Snapshot.PublicTerritory) / 100 * 0.5;
  Score *= EndgameWeight;

  return Score;
}

/**
 * 应用性格矫正到最终启发式分数
 */
function ApplyPersonalityToScore(
  Score: number,
  Mode: DiceMode,
  Personality: AIPersonality,
  Difficulty: AIDifficulty,
  OverloadChance: number,
): number {
  let Adjusted = Score;

  if (Mode === DiceMode.Aggressive) {
    // 高侵略性偏好激进；额外给予上限潜力奖励，使公共充足时激进优于稳健
    Adjusted += Personality.Aggressiveness * 4 + 1.5;
    // 高风险容忍更愿意承担开发过度风险
    Adjusted -= OverloadChance * 10 * (1 - Personality.RiskTolerance);
  } else if (Mode === DiceMode.Steady) {
    // 保守者偏好稳健，但奖励幅度低于激进，避免低风险成为默认最优
    Adjusted += (1 - Personality.Aggressiveness) * 1;
  } else {
    // None：耐心高者更愿意等
    Adjusted += Personality.Patience * 0.5;
  }

  // 根据难度加入小噪声：Rookie 最大，Master 0（由 DecisionMaker 统一处理也可，但这里做兜底）
  const Profile = GetDifficultyProfile(Difficulty);
  if (Profile.EvaluationNoise > 0) {
    // 噪声不在这里加，避免 Evaluator 不可测试；DecisionMaker 会加
  }

  return Adjusted;
}

/**
 * 获取自身私有领土
 */
function GetOwnPrivate(Context: EvalContext): number {
  return Context.Snapshot.Players[Context.PlayerId].PrivateTerritory;
}

/**
 * 获取最强对手私有领土
 */
function GetBestOpponentPrivate(Context: EvalContext): number {
  let Best = 0;
  for (const P of Context.Snapshot.Players) {
    if (P.Id === Context.PlayerId) continue;
    if (P.PrivateTerritory > Best) Best = P.PrivateTerritory;
  }
  return Best;
}

/**
 * 获取所有对手私有领土（用于模拟器）
 */
export function GetOpponentPrivates(Context: EvalContext): number[] {
  return Context.Snapshot.Players
    .filter((P) => P.Id !== Context.PlayerId)
    .map((P) => P.PrivateTerritory);
}

/**
 * 获取玩家快照（用于模拟器）
 */
export function GetPlayerSnapshot(
  Context: EvalContext,
): PlayerSnapshot {
  return Context.Snapshot.Players[Context.PlayerId];
}
