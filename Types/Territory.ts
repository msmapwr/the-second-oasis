/**
 * 领土快照类型定义
 * 关联规则：计划书 §4 公共/私有领土初值、§7 占领机制
 */
import type { PlayerSnapshot } from './Player';

/**
 * 领土快照（一局某一时刻的全局领土状态，不可变）
 * 公共领土 ≥0，归零即终局；私有领土各自 ≥0
 */
export interface TerritorySnapshot {
  /** 公共领土，≥0，初值 100，归零即终局 */
  readonly PublicTerritory: number;
  /** 各玩家私有领土快照（按 PlayerId 索引） */
  readonly Players: readonly PlayerSnapshot[];
}
