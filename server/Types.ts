/**
 * server/Types.ts
 * 操作类型：新建
 *
 * 服务端类型——重新导出共享消息类型和游戏 Core 类型
 * 服务端代码统一从此文件导入，避免路径混乱
 */
export type {
  ClientMessage,
  ServerMessage,
  ServerMessageType,
  ClientMessageType,
  ErrorCode,
  PlayerInfo,
  GamePlayerInfo,
  CreateRoomPayload,
  JoinRoomPayload,
  RoomCreatedPayload,
  RoomJoinedPayload,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  GameStartingPayload,
  TurnResultPayload,
  LaunchResultPayload,
  TiebreakerResultPayload,
  GameOverPayload,
  PlayerDisconnectedPayload,
  PlayerReconnectedPayload,
  SpectatorJoinedPayload,
  SpectatorUpdatePayload,
  ErrorPayload,
} from '../src/Net/Messages';

export {
  SerializeMessage,
  DeserializeMessage,
  IsMessageType,
} from '../src/Net/Messages';

export { GameState } from '../src/Core/GameState';
export { GameStore, type IGameStore, type StoreEvents } from '../src/Store/GameStore';
export { CreateDefaultConfig } from '../src/Types/GameConfig';
export { GamePhase } from '../src/Types/GamePhase';
export { DiceMode } from '../src/Types/Dice';
export { PlayerStatus } from '../src/Types/Player';
export type { PlayerId, PlayerSnapshot } from '../src/Types/Player';
export type { TerritorySnapshot } from '../src/Types/Territory';
export type { LaunchResult } from '../src/Types/Launch';
export type { TurnResult } from '../src/Types/Turn';
export type { TiebreakerRound, GameResult } from '../src/Types/GameResult';
export type { GameConfig } from '../src/Types/GameConfig';
