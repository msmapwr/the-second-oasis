/**
 * src/Types/AI.ts
 * 操作类型：新建
 *
 * AI 相关的共享类型定义
 * 关联：D 优先级 AI 对手模块 §Phase 1
 *
 * 设计要点：
 * 1. 放置在 Types 层，避免 AI/Store/UI 之间循环依赖
 * 2. 仅定义纯数据类型，无运行时逻辑
 */

/**
 * 六级 AI 难度梯度
 */
export enum AIDifficulty {
  Rookie = 0,
  Novice = 1,
  Intermediate = 2,
  Advanced = 3,
  Elite = 4,
  Master = 5,
}

/**
 * AI 四维性格
 * 每维在 [0,1] 区间
 */
export interface AIPersonality {
  readonly Aggressiveness: number;
  readonly RiskTolerance: number;
  readonly Vengefulness: number;
  readonly Patience: number;
}

/**
 * 命名性格原型（UI 选项）
 */
export type PersonalityArchetype =
  | 'Balanced'
  | 'Conservative'
  | 'Gambler'
  | 'Avenger'
  | 'Random';
