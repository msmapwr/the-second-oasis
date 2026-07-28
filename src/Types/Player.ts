/**
 * src/Types/Player.ts
 * 操作类型：修改
 *
 * 玩家类型定义
 * 关联规则：计划书 §4 游戏准备（2~4 人）、§9 开发过度后的玩家状态
 */

/** 玩家 ID（0-based 索引，0..MAX_PLAYERS-1） */
export type PlayerId = number;

/**
 * 玩家状态（决定可否参与占领主循环）
 * - Active：正常参与占领
 * - NeedsRelaunch：开发过度清零后，需重新走发射流程恢复
 * - Eliminated：预留枚举（A 阶段不淘汰玩家，保留以备扩展）
 */
export enum PlayerStatus {
  Active = 'Active',
  NeedsRelaunch = 'NeedsRelaunch',
  Eliminated = 'Eliminated',
}

/**
 * 玩家快照（不可变，用于状态回放/日志/UI 展示）
 * 所有数值字段保证 ≥0（clamp 后的不变量）
 */
export interface PlayerSnapshot {
  /** 玩家 ID */
  readonly Id: PlayerId;
  /** 私有领土，≥0，决定胜负的最终数值 */
  readonly PrivateTerritory: number;
  /** 连续对子计数 0..2（第 3 次触发开发过度后归 0） */
  readonly ConsecutiveDoubles: number;
  /** 玩家状态 */
  readonly Status: PlayerStatus;
  /** 是否已发射成功（首轮序章 / 开发过度后重新发射） */
  readonly IsLaunched: boolean;
  /** 是否处于荒地状态（开发过度后，私有清零，需重新发射解除） */
  readonly IsWasteland: boolean;
  /** 是否持有复仇令牌 */
  readonly RevengeToken: boolean;
}
