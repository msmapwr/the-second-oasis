/**
 * src/AI/TransparentLog.ts
 * 操作类型：新建
 *
 * AI 决策透明日志数据结构
 * 关联：D 优先级 AI 对手模块 §Phase 2
 *
 * 设计要点：
 * 1. 纯数据类型，便于 UI 渲染和存档回放
 * 2. 包含每个候选模式的评估明细、风险分解、最终选择理由
 * 3. 覆盖模式选择、发射、加赛三种决策场景
 */
import type { PlayerId } from '@/Types/Player';
import type { DiceMode } from '@/Types/Dice';
import type { AIDifficulty, AIPersonality } from '@/Types/AI';
import type { GrudgeRecord } from './Memory';

/**
 * 单个模式（Steady / Aggressive / None）的评估结果
 */
export interface ModeEvaluation {
  readonly Mode: DiceMode;
  /** 选择该模式后期望的公共领土 */
  readonly ExpectedPublicAfter: number;
  /** 选择该模式后自己的期望私有领土 */
  readonly ExpectedOwnAfter: number;
  /** 选择该模式后最强对手的期望私有领土 */
  readonly ExpectedBestOpponentAfter: number;
  /** 启发式评分（越高越好） */
  readonly HeuristicScore: number;
  /** 模拟前瞻评分（无模拟时为 0） */
  readonly SimulatedScore: number;
  /** 最终综合评分 */
  readonly FinalScore: number;
  /** 风险分解 */
  readonly RiskBreakdown: {
    /** 开发过度概率估计 */
    readonly OverloadChance: number;
    /** 本回合触发抢夺的概率估计 */
    readonly RobberyChance: number;
    /** 本回合触发崩坏的概率估计 */
    readonly CollapseChance: number;
  };
}

/**
 * 模式选择决策的完整轨迹
 */
export interface ModeDecisionTrace {
  readonly Type: 'Mode';
  readonly PlayerId: PlayerId;
  readonly Difficulty: AIDifficulty;
  readonly Personality: AIPersonality;
  readonly Grudges: readonly GrudgeRecord[];
  readonly Evaluations: readonly ModeEvaluation[];
  readonly SelectedMode: DiceMode;
  readonly Reason: string;
  readonly ThinkingTimeMs: number;
}

/**
 * 发射阶段决策轨迹（当前游戏无模式选择，只生成叙事日志）
 */
export interface LaunchDecisionTrace {
  readonly Type: 'Launch';
  readonly PlayerId: PlayerId;
  readonly Difficulty: AIDifficulty;
  readonly Personality: AIPersonality;
  readonly Reason: string;
  readonly ObservedLaunchFailures: number;
  readonly ThinkingTimeMs: number;
}

/**
 * 加赛阶段决策轨迹（无模式选择，只生成叙事日志）
 */
export interface TiebreakerDecisionTrace {
  readonly Type: 'Tiebreaker';
  readonly PlayerId: PlayerId;
  readonly Difficulty: AIDifficulty;
  readonly Personality: AIPersonality;
  readonly Reason: string;
  readonly OwnPrivate: number;
  readonly BestOpponentPrivate: number;
  readonly ThinkingTimeMs: number;
}

/**
 * 统一决策轨迹
 */
export type DecisionTrace =
  | ModeDecisionTrace
  | LaunchDecisionTrace
  | TiebreakerDecisionTrace;

/**
 * 判断是否为模式选择轨迹
 */
export function IsModeTrace(Trace: DecisionTrace): Trace is ModeDecisionTrace {
  return Trace.Type === 'Mode';
}

/**
 * 判断是否为发射轨迹
 */
export function IsLaunchTrace(Trace: DecisionTrace): Trace is LaunchDecisionTrace {
  return Trace.Type === 'Launch';
}

/**
 * 判断是否为加赛轨迹
 */
export function IsTiebreakerTrace(Trace: DecisionTrace): Trace is TiebreakerDecisionTrace {
  return Trace.Type === 'Tiebreaker';
}
