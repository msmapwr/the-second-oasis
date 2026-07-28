/**
 * src/Net/Messages.ts
 * 操作类型：新建
 *
 * 联机消息协议定义——客户端与服务端之间所有消息的类型、载荷、错误码。
 * 关联：联机架构方案 §3 消息协议
 *
 * 设计要点：
 * 1. 所有消息格式: { type: MessageType, payload: object }
 * 2. 客户端消息与服务端消息严格分离类型
 * 3. 游戏相关载荷复用 Core 层的已有类型（TurnResult / LaunchResult 等）
 * 4. 提供类型守卫函数用于运行时安全的消息分发
 * 5. 纯类型定义，零运行时依赖（服务端和客户端共享）
 */
import type { DiceMode } from '@/Types/Dice';
import type { PlayerId } from '@/Types/Player';
import type { TerritorySnapshot } from '@/Types/Territory';
import type { GamePhase } from '@/Types/GamePhase';
import type { LaunchResult } from '@/Types/Launch';
import type { TurnResult } from '@/Types/Turn';
import type { TiebreakerRound, GameResult } from '@/Types/GameResult';

// ===== 错误码 =====

/**
 * 服务端返回的错误码
 * 客户端根据 code 决定 UI 提示文案和处理策略
 */
export type ErrorCode =
  | 'ROOM_NOT_FOUND'         // 房间码不存在
  | 'ROOM_FULL'              // 房间已满（4 人上限）
  | 'GAME_IN_PROGRESS'       // 游戏已开始，无法加入
  | 'NICKNAME_TAKEN'         // 房间内昵称重复
  | 'NOT_HOST'               // 非房主无权操作
  | 'NOT_YOUR_TURN'          // 不是当前玩家的回合
  | 'INVALID_DICE_MODE'      // 无效的掷骰模式
  | 'GAME_NOT_STARTED'       // 游戏尚未开始
  | 'GAME_ALREADY_STARTED'   // 游戏已经开始，不可重复操作
  | 'PLAYER_NOT_READY'       // 人数不足（最少 2 人）
  | 'SERVER_ERROR';           // 服务端内部错误

// ===== 客户端 → 服务端消息 =====

/** 客户端可发送的所有消息类型 */
export type ClientMessageType =
  | 'CREATE_ROOM'
  | 'JOIN_ROOM'
  | 'LEAVE_ROOM'
  | 'START_GAME'
  | 'PLAY_TURN'
  | 'ATTEMPT_LAUNCH'
  | 'RUN_TIEBREAKER'
  | 'USE_CARD'
  | 'SPECTATE_ROOM'
  | 'HEARTBEAT';

/** 创建房间 */
export interface CreateRoomPayload {
  nickname: string;
}

/** 加入房间 */
export interface JoinRoomPayload {
  roomCode: string;
  nickname: string;
}

/** 开始游戏（房主操作） */
export interface StartGamePayload {
  /** 预留字段，未来可扩展游戏配置 */
}

/** 执行回合 */
export interface PlayTurnPayload {
  mode: DiceMode;
}

/** 尝试发射 */
export interface AttemptLaunchPayload {
  /** 发射操作无需额外参数 */
}

/** 平局加赛 */
export interface RunTiebreakerPayload {
  /** 加赛操作无需额外参数 */
}

/** 观战房间 */
export interface SpectateRoomPayload {
  roomCode: string;
}

/** 使用卡牌 */
export interface UseCardPayload {
  instanceId: number;
  targetPlayerId: PlayerId | null;
}

/**
 * 客户端消息联合类型
 * 每个消息 = type 标识 + payload 载荷
 */
export type ClientMessage =
  | { type: 'CREATE_ROOM'; payload: CreateRoomPayload }
  | { type: 'JOIN_ROOM'; payload: JoinRoomPayload }
  | { type: 'LEAVE_ROOM'; payload: Record<string, never> }
  | { type: 'START_GAME'; payload: StartGamePayload }
  | { type: 'PLAY_TURN'; payload: PlayTurnPayload }
  | { type: 'ATTEMPT_LAUNCH'; payload: AttemptLaunchPayload }
  | { type: 'RUN_TIEBREAKER'; payload: RunTiebreakerPayload }
  | { type: 'USE_CARD'; payload: UseCardPayload }
  | { type: 'SPECTATE_ROOM'; payload: SpectateRoomPayload }
  | { type: 'HEARTBEAT'; payload: Record<string, never> };

// ===== 服务端 → 客户端消息 =====

/** 服务端可发送的所有消息类型 */
export type ServerMessageType =
  | 'ROOM_CREATED'
  | 'ROOM_JOINED'
  | 'PLAYER_JOINED'
  | 'PLAYER_LEFT'
  | 'GAME_STARTING'
  | 'TURN_RESULT'
  | 'LAUNCH_RESULT'
  | 'TIEBREAKER_RESULT'
  | 'GAME_OVER'
  | 'CARD_RESULT'
  | 'COUNTER_WINDOW'
  | 'HAND_UPDATE'
  | 'PLAYER_DISCONNECTED'
  | 'PLAYER_RECONNECTED'
  | 'SPECTATOR_JOINED'
  | 'SPECTATOR_UPDATE'
  | 'ERROR'
  | 'HEARTBEAT_ACK';

/** 房间中的玩家信息 */
export interface PlayerInfo {
  playerId: PlayerId;
  nickname: string;
  isHost: boolean;
}

/** 房间创建成功 */
export interface RoomCreatedPayload {
  roomCode: string;
  playerId: PlayerId;
}

/** 加入房间成功 */
export interface RoomJoinedPayload {
  roomCode: string;
  playerId: PlayerId;
  players: PlayerInfo[];
}

/** 新玩家加入（广播给房间内其他玩家） */
export interface PlayerJoinedPayload {
  playerId: PlayerId;
  nickname: string;
  playerCount: number;
}

/** 玩家离开（广播） */
export interface PlayerLeftPayload {
  playerId: PlayerId;
  nickname: string;
  reason: 'LEFT' | 'DISCONNECTED';
  playerCount: number;
}

/** 游戏中的玩家信息（含阵营色） */
export interface GamePlayerInfo {
  playerId: PlayerId;
  nickname: string;
  color: string;
}

/** 游戏开始（广播给房间内全体玩家） */
export interface GameStartingPayload {
  seed: number;
  playerOrder: PlayerId[];
  players: GamePlayerInfo[];
}

/** 回合结果（广播） */
export interface TurnResultPayload {
  turnResult: TurnResult;
  snapshot: TerritorySnapshot;
  currentPlayer: PlayerId;
  nextPlayer: PlayerId;
}

/** 发射结果（广播） */
export interface LaunchResultPayload {
  launchResult: LaunchResult;
  currentPlayer: PlayerId;
  snapshot: TerritorySnapshot;
}

/** 加赛结果（广播） */
export interface TiebreakerResultPayload {
  round: TiebreakerRound;
  snapshot: TerritorySnapshot;
}

/** 游戏结束（广播） */
export interface GameOverPayload {
  result: GameResult;
  winnerId: PlayerId;
  winnerNickname: string;
}

/** 玩家断线通知 */
export interface PlayerDisconnectedPayload {
  playerId: PlayerId;
  nickname: string;
  takenOverByAI: boolean;
}

/** 玩家重连通知 */
export interface PlayerReconnectedPayload {
  playerId: PlayerId;
  nickname: string;
}

/** 错误消息 */
export interface ErrorPayload {
  code: ErrorCode;
  message: string;
}

/** 观战者加入时收到的完整初始状态 */
export interface SpectatorInitialState {
  phase: GamePhase;
  currentPlayer: PlayerId;
  players: PlayerInfo[];
  snapshot: TerritorySnapshot;
}

/** 观战者加入 */
export interface SpectatorJoinedPayload {
  roomCode: string;
  initialState: SpectatorInitialState;
}

/** 观战者回合更新 */
export interface SpectatorUpdatePayload {
  turnResult: TurnResult;
  snapshot: TerritorySnapshot;
  currentPlayer: PlayerId;
}

/** 卡牌使用结果（广播） */
export interface CardResultPayload {
  playerId: PlayerId;
  cardId: string;
  cardType: string;
  snapshot: TerritorySnapshot;
  currentPlayer: PlayerId;
}

/** 反制窗口通知 */
export interface CounterWindowPayload {
  triggerType: 'Robbery' | 'Collapse';
  timeoutMs: number;
  eligiblePlayers: PlayerId[];
}

/** 手牌更新通知 */
export interface HandUpdatePayload {
  playerId: PlayerId;
  cardCount: number;
}

/**
 * 服务端消息联合类型
 * 每个消息 = type 标识 + payload 载荷
 */
export type ServerMessage =
  | { type: 'ROOM_CREATED'; payload: RoomCreatedPayload }
  | { type: 'ROOM_JOINED'; payload: RoomJoinedPayload }
  | { type: 'PLAYER_JOINED'; payload: PlayerJoinedPayload }
  | { type: 'PLAYER_LEFT'; payload: PlayerLeftPayload }
  | { type: 'GAME_STARTING'; payload: GameStartingPayload }
  | { type: 'TURN_RESULT'; payload: TurnResultPayload }
  | { type: 'LAUNCH_RESULT'; payload: LaunchResultPayload }
  | { type: 'TIEBREAKER_RESULT'; payload: TiebreakerResultPayload }
  | { type: 'GAME_OVER'; payload: GameOverPayload }
  | { type: 'CARD_RESULT'; payload: CardResultPayload }
  | { type: 'COUNTER_WINDOW'; payload: CounterWindowPayload }
  | { type: 'HAND_UPDATE'; payload: HandUpdatePayload }
  | { type: 'PLAYER_DISCONNECTED'; payload: PlayerDisconnectedPayload }
  | { type: 'PLAYER_RECONNECTED'; payload: PlayerReconnectedPayload }
  | { type: 'SPECTATOR_JOINED'; payload: SpectatorJoinedPayload }
  | { type: 'SPECTATOR_UPDATE'; payload: SpectatorUpdatePayload }
  | { type: 'ERROR'; payload: ErrorPayload }
  | { type: 'HEARTBEAT_ACK'; payload: Record<string, never> };

// ===== 类型工具函数 =====

/**
 * 根据消息类型提取对应的 payload 类型
 *
 * 用法：
 *   type P = ExtractPayload<'TURN_RESULT'>;  // → TurnResultPayload
 */
export type ExtractPayload<T extends ServerMessageType> =
  Extract<ServerMessage, { type: T }>['payload'];

/**
 * 序列化消息为 JSON 字符串
 * 客户端/服务端统一使用此函数，保证格式一致
 */
export function SerializeMessage(Msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(Msg);
}

/**
 * 反序列化 JSON 字符串为消息对象
 * 不做类型验证，调用方需通过消息 type 字段自行分发
 */
export function DeserializeMessage(Raw: string): ClientMessage | ServerMessage {
  return JSON.parse(Raw) as ClientMessage | ServerMessage;
}

/**
 * 检查消息类型是否匹配
 * 用于消息分发时的类型收窄
 *
 * 用法：
 *   if (IsMessageType(msg, 'TURN_RESULT')) {
 *     // msg.payload 类型自动收窄为 TurnResultPayload
 *   }
 */
export function IsMessageType<T extends ServerMessageType>(
  Msg: ClientMessage | ServerMessage,
  Type: T,
): Msg is Extract<ServerMessage, { type: T }> {
  return Msg.type === Type;
}

/**
 * 创建客户端消息的便捷工厂
 */
export const ClientMsg = {
  CreateRoom: (Nickname: string): ClientMessage => ({
    type: 'CREATE_ROOM',
    payload: { nickname: Nickname },
  }),
  JoinRoom: (RoomCode: string, Nickname: string): ClientMessage => ({
    type: 'JOIN_ROOM',
    payload: { roomCode: RoomCode, nickname: Nickname },
  }),
  LeaveRoom: (): ClientMessage => ({
    type: 'LEAVE_ROOM',
    payload: {},
  }),
  StartGame: (): ClientMessage => ({
    type: 'START_GAME',
    payload: {},
  }),
  PlayTurn: (Mode: DiceMode): ClientMessage => ({
    type: 'PLAY_TURN',
    payload: { mode: Mode },
  }),
  AttemptLaunch: (): ClientMessage => ({
    type: 'ATTEMPT_LAUNCH',
    payload: {},
  }),
  RunTiebreaker: (): ClientMessage => ({
    type: 'RUN_TIEBREAKER',
    payload: {},
  }),
  UseCard: (InstanceId: number, TargetPlayerId: PlayerId | null): ClientMessage => ({
    type: 'USE_CARD',
    payload: { instanceId: InstanceId, targetPlayerId: TargetPlayerId },
  }),
  SpectateRoom: (RoomCode: string): ClientMessage => ({
    type: 'SPECTATE_ROOM',
    payload: { roomCode: RoomCode },
  }),
  Heartbeat: (): ClientMessage => ({
    type: 'HEARTBEAT',
    payload: {},
  }),
} as const;
