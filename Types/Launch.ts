/**
 * 发射序章类型定义
 * 关联规则：计划书 §12 发射回合
 */
import type { PlayerId } from './Player';
import type { DieFace } from './Dice';

/**
 * 发射状态
 * - Success：双骰和 ≥7，发射成功
 * - Failure：双骰和 <7，发射失败，下回合继续尝试
 */
export enum LaunchStatus {
  Success = 'Success',
  Failure = 'Failure',
}

/**
 * 发射尝试结果（不可变）
 */
export interface LaunchResult {
  /** 尝试发射的玩家 ID */
  readonly PlayerId: PlayerId;
  /** 双骰点数（发射固定用双骰，§12） */
  readonly Dice: readonly [DieFace, DieFace];
  /** 双骰之和 */
  readonly Sum: number;
  /** 发射状态 */
  readonly Status: LaunchStatus;
  /** 私有领土变化（成功 +2，失败 0） */
  readonly PrivateDelta: number;
}
