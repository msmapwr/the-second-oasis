/**
 * src/Net/LobbyClient.ts
 * 操作类型：新建
 *
 * 大厅客户端——封装创建/加入/离开房间的操作与事件监听。
 * 关联：联机架构方案 §3 阶段 6
 *
 * 设计要点：
 * 1. 基于 WebSocketClient，提供高层的房间操作 API
 * 2. 监听房间内玩家变动，通过事件回调通知 UI 层
 * 3. 管理本地玩家状态（房主/普通玩家/观战者）
 */
import { WebSocketClient, ConnectionState } from './WebSocketClient';
import { ClientMsg } from './Messages';
import type { RoomCreatedPayload, RoomJoinedPayload, PlayerJoinedPayload, PlayerLeftPayload, PlayerDisconnectedPayload } from './Messages';
import type { PlayerId } from '@/Types/Player';

/** 大厅事件回调 */
export interface LobbyEvents {
  /** 房间创建成功 */
  OnRoomCreated: (RoomCode: string, MyPlayerId: PlayerId) => void;
  /** 加入房间成功 */
  OnRoomJoined: (RoomCode: string, MyPlayerId: PlayerId, Players: Array<{ PlayerId: PlayerId; Nickname: string; IsHost: boolean }>) => void;
  /** 新玩家加入 */
  OnPlayerJoined: (PlayerId: PlayerId, Nickname: string, PlayerCount: number) => void;
  /** 玩家离开 */
  OnPlayerLeft: (PlayerId: PlayerId, Nickname: string, Reason: 'LEFT' | 'DISCONNECTED', PlayerCount: number) => void;
  /** 玩家断线 */
  OnPlayerDisconnected: (PlayerId: PlayerId, Nickname: string) => void;
  /** 连接错误 */
  OnError: (Code: string, Message: string) => void;
  /** 连接状态变化 */
  OnConnectionChange: (State: ConnectionState) => void;
}

/** 超时时间 */
const DEFAULT_TIMEOUT_MS = 15000;

export class LobbyClient {
  private readonly _Client: WebSocketClient;
  private readonly _Events: LobbyEvents;
  private readonly _Unsubs: Array<() => void> = [];

  /** 本地玩家 ID */
  private _MyPlayerId: PlayerId = -1;
  /** 当前房间码 */
  private _RoomCode = '';
  /** 是否为房主 */
  private _IsHost = false;

  constructor(Client: WebSocketClient, Events: LobbyEvents) {
    this._Client = Client;
    this._Events = Events;
    this._BindListeners();
  }

  // ===== 只读属性 =====

  get MyPlayerId(): PlayerId { return this._MyPlayerId; }
  get RoomCode(): string { return this._RoomCode; }
  get IsHost(): boolean { return this._IsHost; }
  get ConnectionState(): ConnectionState { return this._Client.State; }

  // ===== 操作 =====

  /**
   * 连接并创建房间
   */
  async CreateRoom(Nickname: string): Promise<string> {
    await this._EnsureConnected();
    const Result = await this._Client.SendAndWait<RoomCreatedPayload>(
      ClientMsg.CreateRoom(Nickname),
      DEFAULT_TIMEOUT_MS,
    );
    this._MyPlayerId = Result.playerId;
    this._RoomCode = Result.roomCode;
    this._IsHost = true;
    this._Events.OnRoomCreated(Result.roomCode, Result.playerId);
    return Result.roomCode;
  }

  /**
   * 连接并加入房间
   */
  async JoinRoom(RoomCode: string, Nickname: string): Promise<void> {
    await this._EnsureConnected();
    const Result = await this._Client.SendAndWait<RoomJoinedPayload>(
      ClientMsg.JoinRoom(RoomCode, Nickname),
      DEFAULT_TIMEOUT_MS,
    );
    this._MyPlayerId = Result.playerId;
    this._RoomCode = Result.roomCode;
    this._IsHost = Result.players.some((P) => P.playerId === Result.playerId && P.isHost);
    this._Events.OnRoomJoined(
      Result.roomCode,
      Result.playerId,
      Result.players.map((P) => ({
        PlayerId: P.playerId,
        Nickname: P.nickname,
        IsHost: P.isHost,
      })),
    );
  }

  /**
   * 开始游戏（房主操作）
   */
  async StartGame(): Promise<void> {
    await this._Client.SendAndWait(
      ClientMsg.StartGame(),
      DEFAULT_TIMEOUT_MS,
    );
  }

  /**
   * 观战房间
   * @returns 观战者初始状态
   */
  async SpectateRoom(RoomCode: string): Promise<{ roomCode: string; initialState: { phase: string; currentPlayer: number; players: Array<{ playerId: number; nickname: string; isHost: boolean }>; snapshot: { PublicTerritory: number; Players: Array<{ Id: number; PrivateTerritory: number }> }; hands: Array<{ playerId: number; hand: unknown[] }>; deckSize: number; discardSize: number; cardEnabled: boolean } }> {
    await this._EnsureConnected();
    const Result = await this._Client.SendAndWait<{ roomCode: string; initialState: { phase: string; currentPlayer: number; players: Array<{ playerId: number; nickname: string; isHost: boolean }>; snapshot: { PublicTerritory: number; Players: Array<{ Id: number; PrivateTerritory: number }> }; hands: Array<{ playerId: number; hand: unknown[] }>; deckSize: number; discardSize: number; cardEnabled: boolean } }>(
      ClientMsg.SpectateRoom(RoomCode),
      DEFAULT_TIMEOUT_MS,
    );
    this._RoomCode = RoomCode;
    this._IsHost = false;
    return Result;
  }

  /**
   * 获取可观战房间列表
   */
  async GetRoomList(): Promise<Array<{ roomCode: string; phase: string; playerCount: number; maxPlayers: number; hostNickname: string; spectatorCount: number }>> {
    await this._EnsureConnected();
    const Result = await this._Client.SendAndWait<{ rooms: Array<{ roomCode: string; phase: string; playerCount: number; maxPlayers: number; hostNickname: string; spectatorCount: number }> }>(
      ClientMsg.GetRoomList(),
      DEFAULT_TIMEOUT_MS,
    );
    return Result.rooms;
  }

  /**
   * 离开房间
   */
  LeaveRoom(): void {
    this._Client.Send(ClientMsg.LeaveRoom());
    this._Reset();
  }

  /**
   * 断开连接
   */
  Disconnect(): void {
    this._Cleanup();
    this._Client.Disconnect();
  }

  // ===== 内部方法 =====

  private async _EnsureConnected(): Promise<void> {
    if (!this._Client.IsConnected) {
      await this._Client.Connect();
    }
  }

  private _BindListeners(): void {
    this._Unsubs.push(
      this._Client.On('PLAYER_JOINED', (Payload: PlayerJoinedPayload) => {
        this._Events.OnPlayerJoined(Payload.playerId, Payload.nickname, Payload.playerCount);
      }),
    );

    this._Unsubs.push(
      this._Client.On('PLAYER_LEFT', (Payload: PlayerLeftPayload) => {
        this._Events.OnPlayerLeft(Payload.playerId, Payload.nickname, Payload.reason, Payload.playerCount);
      }),
    );

    this._Unsubs.push(
      this._Client.On('PLAYER_DISCONNECTED', (Payload: PlayerDisconnectedPayload) => {
        this._Events.OnPlayerDisconnected(Payload.playerId, Payload.nickname);
      }),
    );

    this._Unsubs.push(
      this._Client.On('ERROR', (Payload) => {
        this._Events.OnError(Payload.code, Payload.message);
      }),
    );
  }

  private _Reset(): void {
    this._MyPlayerId = -1;
    this._RoomCode = '';
    this._IsHost = false;
  }

  private _Cleanup(): void {
    for (const Unsub of this._Unsubs) {
      Unsub();
    }
    this._Unsubs.length = 0;
    this._Reset();
  }
}
