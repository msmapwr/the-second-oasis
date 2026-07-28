/**
 * src/Types/Replay.ts
 * 操作类型：新建
 *
 * 回放数据类型定义——录制、存储、回放引擎共用的不可变结构。
 */

import type { LaunchResult } from './Launch';
import type { TurnResult } from './Turn';
import type { CardPlayedRecord } from './Turn';
import type { TiebreakerRound, GameResult } from './GameResult';
import type { GamePhase } from './GamePhase';
import type { PlayerId } from './Player';
import type { TerritorySnapshot } from './Territory';

export const REPLAY_VERSION = '1.0';

/** 回放头：一次完整对局的元信息 */
export interface ReplayHeader {
  readonly version: string;
  readonly seed: number;
  readonly playerCount: 2 | 3 | 4;
  readonly variant: boolean;
  readonly playerConfigs: ReadonlyArray<{
    readonly Name: string;
    readonly Color: string;
    readonly IsAI?: boolean;
  }>;
  readonly createdAt: number;
}

/** 单个回放事件 */
export type ReplayEvent =
  | { type: 'Launch'; payload: LaunchResult }
  | { type: 'Turn'; payload: TurnResult }
  | { type: 'Tiebreaker'; payload: TiebreakerRound }
  | { type: 'CardUsed'; payload: { Record: CardPlayedRecord; InstanceId: number } }
  | { type: 'GameOver'; payload: GameResult }
  | { type: 'PhaseChange'; payload: { from: GamePhase; to: GamePhase } }
  | { type: 'RoundChange'; payload: { roundIndex: number; firstPlayerIndex: PlayerId } }
  | { type: 'Keyframe'; payload: TerritorySnapshot };

/** 存储形态 */
export interface StoredReplay {
  readonly id: string;
  readonly header: ReplayHeader;
  readonly events: readonly ReplayEvent[];
  readonly compressed: boolean;
}
