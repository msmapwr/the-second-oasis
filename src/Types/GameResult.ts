/**
 * 终局结果类型定义
 * 关联规则：计划书 §3 游戏目标与胜负、Q7（终局平局加赛）
 */
import type { PlayerId } from './Player';
import type { DieFace } from './Dice';
import type { TerritorySnapshot } from './Territory';

/**
 * 胜者记录（不可变）
 */
export interface Winner {
  /** 胜者玩家 ID */
  readonly Id: PlayerId;
  /** 胜者最终私有领土 */
  readonly PrivateTerritory: number;
}

/**
 * 一轮加赛记录（不可变，Q7：仅平手者，每人掷双骰）
 */
export interface TiebreakerRound {
  /** 本轮参与者（平手者 ID 列表） */
  readonly Participants: readonly PlayerId[];
  /** 每位参与者掷骰记录 */
  readonly Rolls: ReadonlyArray<{
    readonly Id: PlayerId;
    readonly Dice: readonly [DieFace, DieFace];
    readonly Sum: number;
  }>;
  /** 本轮最高者（可能多个 = 仍平手，需继续加赛） */
  readonly WinnersThisRound: readonly PlayerId[];
  /** 是否决出最终唯一胜者 */
  readonly IsFinal: boolean;
}

/**
 * 游戏终局结果（不可变）
 */
export interface GameResult {
  /** 是否终局（= true） */
  readonly IsOver: boolean;
  /** 胜者列表（长度 1 = 唯一胜者；>1 不应出现在最终结果，仅中间态） */
  readonly Winners: readonly Winner[];
  /** 加赛历史（终局平局时记录所有加赛轮次） */
  readonly TiebreakerHistory: readonly TiebreakerRound[];
  /** 终局时的领土快照 */
  readonly FinalSnapshot: TerritorySnapshot;
}
