/**
 * 抢夺类型定义
 * 关联规则：计划书 §10 抢夺机制、Q1（阈值）、Q5（平手重掷）、冲突点 1/3/6
 */
import type { PlayerId } from './Player';
import type { DieFace } from './Dice';

/**
 * 抢夺角色
 * - Initiator：发起者 p（占领溢出者）
 * - Defender：防守者（除 p 外当前私有领土最高者）
 */
export enum RobberyRole {
  Initiator = 'Initiator',
  Defender = 'Defender',
}

/**
 * 抢夺一次掷骰记录（含平手重掷链）
 * 关联：冲突点 6（单骰 1~6）
 */
export interface RobberyRollRecord {
  /** 发起者本次掷骰点数 */
  readonly InitiatorRoll: DieFace;
  /** 防守者本次掷骰点数 */
  readonly DefenderRoll: DieFace;
  /** 本次是否平手（相等则需重掷，Q5） */
  readonly IsTie: boolean;
}

/**
 * 抢夺结算结果（不可变）
 * 冲突点 3 方案 E 守恒：Transfer = min(m2, 低者私有)，r = min(r, Transfer)
 */
export interface RobberyResult {
  /** 溢出量 m2 = m − 公共原值（冲突点 1） */
  readonly OverflowM2: number;
  /** 防守者 ID */
  readonly Defender: PlayerId;
  /** 所有掷骰记录（含平手重掷，Q5） */
  readonly RollHistory: readonly RobberyRollRecord[];
  /** 最终胜方角色 */
  readonly Winner: RobberyRole;
  /** 随机回归公共的损耗量 r（受 Transfer 上限约束，冲突点 3） */
  readonly RandomReturn: number;
  /** 实际转移量（守恒后 = min(m2, 低者私有原值)） */
  readonly Transfer: number;
  /** 发起者私有变化（胜则正、败则负） */
  readonly InitiatorDelta: number;
  /** 防守者私有变化（胜则正、败则负） */
  readonly DefenderDelta: number;
  /** 公共领土变化（= r） */
  readonly PublicDelta: number;
}
