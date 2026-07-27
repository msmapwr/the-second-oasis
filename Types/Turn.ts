/**
 * src/Types/Turn.ts
 * 操作类型：修改
 *
 * 回合类型定义
 * 关联规则：计划书 §6 回合流程 + v1.2 变体包数据字段
 */
import type { PlayerId } from './Player';
import type { DiceMode, DiceRollResult, RevengeRollResult } from './Dice';
import type { DevChainOutcome } from './DevChain';
import type { RobberyResult } from './Robbery';
import type { CollapseResult } from './Collapse';

/**
 * 公敌税记录
 */
export interface LeaderTaxRecord {
  /** 被征税玩家 ID */
  readonly PlayerId: PlayerId;
  /** 税额 */
  readonly Amount: number;
}

/**
 * 复仇突袭回合结果
 */
export interface RevengeResult {
  /** 目标玩家 ID */
  readonly TargetId: PlayerId;
  /** 掷骰结果 */
  readonly Roll: RevengeRollResult;
  /** 目标变化量 */
  readonly TargetDelta: number;
  /** 发动者变化量 */
  readonly SelfDelta: number;
  /** 公共池变化量 */
  readonly PublicDelta: number;
}

/**
 * 一回合的完整结算结果（不可变，用于日志/回放/UI 更新）
 * None 模式下 Dice/DevOutcome/OccupationDelta 为 null（但仍清零连击）
 */
export interface TurnResult {
  /** 本回合行动玩家 ID */
  readonly PlayerId: PlayerId;
  /** 本回合选择的模式 */
  readonly Mode: DiceMode;
  /** 掷骰结果（None 模式为 null） */
  readonly Dice: DiceRollResult | null;
  /** 开发链输出（None 模式为 null，但连击仍清零） */
  readonly DevOutcome: DevChainOutcome | null;
  /** 占领结算变化（开发过度或 None 模式时为 null） */
  readonly OccupationDelta: {
    readonly PublicDelta: number;
    readonly PrivateDelta: number;
  } | null;
  /** 抢夺结果（本回合触发抢夺时非 null） */
  readonly Robbery: RobberyResult | null;
  /** 崩坏结果（本回合触发崩坏时非 null） */
  readonly Collapse: CollapseResult | null;
  /** 本回合是否触发开发过度 */
  readonly IsOverload: boolean;
  /** 下回合是否需重新发射（开发过度后） */
  readonly NeedsRelaunchNext: boolean;

  /** 当前轮次索引（v1.2 顺位轮换） */
  readonly RoundIndex: number;
  /** 本轮首位玩家索引（v1.2 顺位轮换） */
  readonly FirstPlayerIndex: PlayerId;
  /** 本回合公敌税记录（v1.2） */
  readonly LeaderTax: LeaderTaxRecord | null;
  /** 本回合枯竭冲刺奖励（v1.2） */
  readonly SprintBonus: number;
  /** 本回合复仇突袭结果（v1.2） */
  readonly Revenge: RevengeResult | null;
}
