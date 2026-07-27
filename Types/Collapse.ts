/**
 * 崩坏类型定义
 * 关联规则：计划书 §11 崩坏机制、Q6（随机分配）、冲突点 4/5
 */
import type { PlayerId } from './Player';

/**
 * 单玩家崩坏损失记录（不可变）
 */
export interface CollapsePlayerLoss {
  /** 玩家 ID */
  readonly Id: PlayerId;
  /**
   * 随机生成的损失量
   * - 非发起者：[0, floor((x·m2)/4)]
   * - 发起者：= (x·m2) − 其他玩家实际损失之和（Q6 承担剩余）
   */
  readonly RandomLoss: number;
  /** 实际扣除量（受该玩家私有上限 clamp，冲突点 4） */
  readonly ActualLoss: number;
  /** 崩坏前私有领土 */
  readonly BeforePrivate: number;
  /** 崩坏后私有领土 */
  readonly AfterPrivate: number;
}

/**
 * 崩坏结算结果（不可变）
 */
export interface CollapseResult {
  /** 本次崩坏所用系数 x（结算前值，初值 2） */
  readonly CoefficientX: number;
  /** 实际总扣除量（目标 = x·m2，可能因私有不足而小） */
  readonly TotalLoss: number;
  /** 是否严格守恒（= 实际总扣除 === x·m2；冲突点 4：全员不足时 false） */
  readonly IsConserved: boolean;
  /** 每位玩家的损失记录（含发起者） */
  readonly PlayerLosses: readonly CollapsePlayerLoss[];
  /** 发起者 ID */
  readonly InitiatorId: PlayerId;
  /** 公共领土变化（= −x，受 0 下限 clamp，冲突点 5） */
  readonly PublicDelta: number;
  /** 结算后系数（= x+1） */
  readonly NextX: number;
}
