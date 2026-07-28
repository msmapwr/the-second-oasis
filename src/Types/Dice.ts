/**
 * src/Types/Dice.ts
 * 操作类型：修改
 *
 * 骰子类型定义
 * 关联规则：计划书 §7 掷骰机制、§8 三种模式、冲突点 2（小对子倒扣）
 */

/** 骰面，固定 1..6 */
export type DieFace = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * 掷骰模式（§8 回合开局模式选择）
 * - Steady：稳健，单骰 1~6，永不触发崩坏
 * - Aggressive：激进，双骰 2~12，≤6 倒扣回公共
 * - None：不开发，完全不掷骰（Q3 决定）
 * - Revenge：复仇突袭，单骰判定，消耗复仇令牌
 */
export enum DiceMode {
  Steady = 'Steady',
  Aggressive = 'Aggressive',
  None = 'None',
  Revenge = 'Revenge',
}

/**
 * 掷骰原始结果（DiceRoller 输出，不可变）
 * RawGain 含倒扣符号：正常为正，倒扣为负，None 模式为 0
 */
export interface DiceRollResult {
  /** 本次掷骰模式 */
  readonly Mode: DiceMode;
  /** 骰子点数数组：Steady=1 个；Aggressive=2 个；None=空数组 */
  readonly Dice: readonly DieFace[];
  /** 骰子和；None 模式为 0 */
  readonly Sum: number;
  /** 是否对子（仅 Aggressive 两骰相同为 true；Steady/None/Revenge 恒 false） */
  readonly IsDouble: boolean;
  /** 是否触发激进倒扣（仅 Aggressive 且 Sum≤6 为 true） */
  readonly IsDeducted: boolean;
  /**
   * 本回合应得领土（含倒扣符号）
   * - 正常：= Sum
   * - 倒扣：= −Sum（冲突点 2：倒扣使应得为负）
   * - None：= 0
   * 后续开发链倍率作用于此值（Q4）
   */
  readonly RawGain: number;
}

/**
 * 复仇突袭结果
 */
export interface RevengeRollResult {
  /** 掷骰点数 */
  readonly Die: DieFace;
  /** 是否成功 */
  readonly IsSuccess: boolean;
  /** 成功时夺取量 */
  readonly StealAmount: number;
  /** 失败时自身损失 */
  readonly SelfLoss: number;
}
