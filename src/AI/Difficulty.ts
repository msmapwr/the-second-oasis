/**
 * src/AI/Difficulty.ts
 * 操作类型：新建
 *
 * 六级难度参数表
 * 关联：D 优先级 AI 对手模块 §Phase 1
 *
 * 设计要点：
 * 1. 每级难度携带固定参数，便于蒙特卡洛批量调参
 * 2. 难度递进体现在：前瞻深度、模拟分支、评估噪声、思考延迟、记仇权重
 * 3. 所有参数在 0~1 或正整数区间，避免魔法数散落
 */
import { AIDifficulty } from '@/Types/AI';

/**
 * 单级难度的完整参数画像
 */
export interface DifficultyProfile {
  /** 前瞻模拟回合数（0 表示不做模拟） */
  readonly LookaheadDepth: number;
  /** 每个候选模式的分支模拟次数 */
  readonly SimulationBranches: number;
  /** 最终评分随机扰动幅度（0~1），Rookie 大而 Master 为 0 */
  readonly EvaluationNoise: number;
  /** 思考延迟区间 [min, max] 毫秒 */
  readonly ThinkingDelayMs: readonly [number, number];
  /** 记仇权重放大倍数 */
  readonly GrudgeMultiplier: number;
  /** 性格随机偏移幅度（0~1） */
  readonly PersonalityVariance: number;
  /** 启发式评分 vs 模拟评分权重：heuristicWeight = 1 - SimWeight */
  readonly SimWeight: number;
  /** 评估时公共池权重系数（落后/领先时公共池价值） */
  readonly PublicWeight: number;
  /** 开发链风险厌恶系数（越高越怕第三对子清零） */
  readonly OverloadAversion: number;
}

/**
 * 默认难度画像表
 * 数值为初版占位，Phase 7 蒙特卡洛验证后调优
 */
const DIFFICULTY_PROFILES: Record<AIDifficulty, DifficultyProfile> = {
  [AIDifficulty.Rookie]: {
    LookaheadDepth: 0,
    SimulationBranches: 0,
    EvaluationNoise: 0.4,
    ThinkingDelayMs: [600, 1200],
    GrudgeMultiplier: 0,
    PersonalityVariance: 0.6,
    SimWeight: 0,
    PublicWeight: 0.3,
    OverloadAversion: 0.2,
  },
  [AIDifficulty.Novice]: {
    LookaheadDepth: 0,
    SimulationBranches: 0,
    EvaluationNoise: 0.2,
    ThinkingDelayMs: [500, 1000],
    GrudgeMultiplier: 0,
    PersonalityVariance: 0.4,
    SimWeight: 0,
    PublicWeight: 0.5,
    OverloadAversion: 0.4,
  },
  [AIDifficulty.Intermediate]: {
    LookaheadDepth: 0,
    SimulationBranches: 0,
    EvaluationNoise: 0.1,
    ThinkingDelayMs: [700, 1400],
    GrudgeMultiplier: 0.5,
    PersonalityVariance: 0.3,
    SimWeight: 0,
    PublicWeight: 0.7,
    OverloadAversion: 0.6,
  },
  [AIDifficulty.Advanced]: {
    LookaheadDepth: 2,
    SimulationBranches: 20,
    EvaluationNoise: 0.05,
    ThinkingDelayMs: [800, 1600],
    GrudgeMultiplier: 1.0,
    PersonalityVariance: 0.2,
    SimWeight: 0.3,
    PublicWeight: 0.9,
    OverloadAversion: 0.8,
  },
  [AIDifficulty.Elite]: {
    LookaheadDepth: 4,
    SimulationBranches: 40,
    EvaluationNoise: 0.02,
    ThinkingDelayMs: [1000, 2000],
    GrudgeMultiplier: 1.5,
    PersonalityVariance: 0.15,
    SimWeight: 0.5,
    PublicWeight: 1.0,
    OverloadAversion: 1.0,
  },
  [AIDifficulty.Master]: {
    LookaheadDepth: 6,
    SimulationBranches: 80,
    EvaluationNoise: 0,
    ThinkingDelayMs: [1200, 2500],
    GrudgeMultiplier: 2.0,
    PersonalityVariance: 0.1,
    SimWeight: 0.7,
    PublicWeight: 1.2,
    OverloadAversion: 1.2,
  },
};

/**
 * 获取难度画像
 */
export function GetDifficultyProfile(Difficulty: AIDifficulty): DifficultyProfile {
  return DIFFICULTY_PROFILES[Difficulty];
}

/**
 * 难度标签（UI 显示）
 */
export function GetDifficultyLabel(Difficulty: AIDifficulty): string {
  const Labels: Record<AIDifficulty, string> = {
    [AIDifficulty.Rookie]: '菜鸟',
    [AIDifficulty.Novice]: '初级',
    [AIDifficulty.Intermediate]: '中级',
    [AIDifficulty.Advanced]: '高级',
    [AIDifficulty.Elite]: '终极',
    [AIDifficulty.Master]: '大师',
  };
  return Labels[Difficulty];
}

/**
 * 难度英文名（日志/调试）
 */
export function GetDifficultyName(Difficulty: AIDifficulty): string {
  return AIDifficulty[Difficulty];
}
