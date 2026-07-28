/**
 * 开发链类型定义
 * 关联规则：计划书 §9 连击机制、Q4（翻倍基数）、Q8（计数清零）
 */

/**
 * 开发倍率（§9）
 * - None=1：非对子，本回合无倍率加成
 * - Dev=2：第 1 次连续对子
 * - BigDev=3：第 2 次连续对子
 * 第 3 次连续对子不返回倍率，直接触发 IsOverload 事件
 */
export enum DevMultiplier {
  None = 1,
  Dev = 2,
  BigDev = 3,
}

/**
 * 开发链状态机输出（DevChain.Advance 返回值，不可变）
 */
export interface DevChainOutcome {
  /** 本回合倍率（Overload 时为 None，但因清零不使用） */
  readonly Multiplier: DevMultiplier;
  /** 是否开发过度（第 3 次连续对子，触发私有清零+荒地+重新发射） */
  readonly IsOverload: boolean;
  /** 结算后连击计数（0..2；Overload 后归 0） */
  readonly NewConsecutiveDoubles: number;
}
