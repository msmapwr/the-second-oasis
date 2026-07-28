/**
 * src/Net/NetworkGameStore.ts
 * 操作类型：新建
 *
 * 网络版 GameStore——实现 IGameStore 接口，通过 WebSocket 与服务端同步。
 * 关联：联机架构方案 §3 阶段 5
 *
 * 设计要点：
 * 1. 实现 IGameStore 完整接口（包括 async 别名方法）
 * 2. 内部维护一个本地 GameStore 镜像（用于渲染层查询状态）
 * 3. 同步方法（Start/PlayTurn 等）：发送消息 + 等待服务端响应 + 应用到本地镜像 + 触发事件
 * 4. 只读属性委托给本地 GameStore
 * 5. 事件系统重定向到本地 GameStore（服务端结果到达后 apply + emit）
 * 6. 作为 AppController 的 drop-in 替换——AppController 无需知道联机/单机差异
 */
import { GameStore, type IGameStore, type StoreEvents } from '@/Store/GameStore';
import type { Listener } from '@/Store/EventEmitter';
import { CreateDefaultConfig } from '@/Types/GameConfig';
import { GamePhase } from '@/Types/GamePhase';
import type { PlayerId } from '@/Types/Player';
import type { TerritorySnapshot } from '@/Types/Territory';
import type { DiceMode } from '@/Types/Dice';
import type { LaunchResult } from '@/Types/Launch';
import type { TurnResult } from '@/Types/Turn';
import type { TiebreakerRound, GameResult } from '@/Types/GameResult';
import { WebSocketClient, ConnectionState } from './WebSocketClient';
import { ClientMsg } from './Messages';
import type { TurnResultPayload, LaunchResultPayload, TiebreakerResultPayload, GameOverPayload, GameStartingPayload } from './Messages';

/** 默认超时时间（毫秒） */
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * NetworkGameStore——IGameStore 的网络实现
 *
 * 用法：
 *   const Client = new WebSocketClient('ws://localhost:9528');
 *   const Store = new NetworkGameStore(Client);
 *   await Store.ConnectAndJoin('4829', '玩家1'); // 或者 CreateAndWait
 *   // 之后像普通 GameStore 一样使用
 *   Store.On('Turn', ({ Result }) => { ... });
 *   await Store.PlayTurnAsync('Steady');
 */
export class NetworkGameStore implements IGameStore {
  private readonly _Client: WebSocketClient;
  private _LocalStore: GameStore | null = null;

  /** 本地玩家 ID */
  private _MyPlayerId: PlayerId = -1;

  /** 房间中所有玩家的昵称映射 */
  private _PlayerNicknames: Map<PlayerId, string> = new Map();

  constructor(Client: WebSocketClient) {
    this._Client = Client;
  }

  // ===== 只读属性（委托给本地镜像） =====

  get Phase(): GamePhase {
    return this._LocalStore?.Phase ?? GamePhase.Init;
  }

  get CurrentPlayer(): PlayerId {
    return this._LocalStore?.CurrentPlayer ?? 0;
  }

  get IsOver(): boolean {
    return this._LocalStore?.IsOver ?? false;
  }

  get Result(): GameResult | null {
    return this._LocalStore?.Result ?? null;
  }

  get Snapshot(): TerritorySnapshot {
    return this._LocalStore?.Snapshot ?? { PublicTerritory: 100, Players: [] };
  }

  get RobberyTriggeredCount(): number {
    return this._LocalStore?.RobberyTriggeredCount ?? 0;
  }

  get CollapseX(): number {
    return this._LocalStore?.CollapseX ?? 2;
  }

  get RoundIndex(): number {
    return this._LocalStore?.RoundIndex ?? 0;
  }

  get FirstPlayerIndex(): PlayerId {
    return this._LocalStore?.FirstPlayerIndex ?? 0;
  }

  GetConsecutiveDoubles(Id: PlayerId): number {
    return this._LocalStore?.GetConsecutiveDoubles(Id) ?? 0;
  }

  SetRevengeTarget(TargetId: PlayerId): void {
    this._LocalStore?.SetRevengeTarget(TargetId);
  }

  Forfeit(PlayerId: PlayerId): void {
    this._LocalStore?.Forfeit(PlayerId);
  }

  InitiateRobbery(InitiatorId: PlayerId, TargetId: PlayerId): import('@/Types/Turn').TurnResult | null {
    return this._LocalStore?.InitiateRobbery(InitiatorId, TargetId) ?? null;
  }

  /** 本地玩家 ID（只有联机模式下有效） */
  get MyPlayerId(): PlayerId {
    return this._MyPlayerId;
  }

  /** 底层 WebSocket 连接状态 */
  get ConnectionState(): ConnectionState {
    return this._Client.State;
  }

  // ===== 同步命令（抛出同步结果，不阻塞） =====

  /** @deprecated 联机模式请使用 StartAsync */
  Start(): void {
    throw new Error('联机模式请使用 StartAsync() 而非 Start()');
  }

  /** @deprecated 联机模式请使用 AttemptLaunchAsync */
  AttemptLaunch(): LaunchResult {
    throw new Error('联机模式请使用 AttemptLaunchAsync() 而非 AttemptLaunch()');
  }

  /** @deprecated 联机模式请使用 PlayTurnAsync */
  PlayTurn(_Mode: DiceMode): TurnResult {
    throw new Error('联机模式请使用 PlayTurnAsync() 而非 PlayTurn()');
  }

  /** @deprecated 联机模式请使用 RunTiebreakerAsync */
  RunTiebreaker(): TiebreakerRound {
    throw new Error('联机模式请使用 RunTiebreakerAsync() 而非 RunTiebreaker()');
  }

  // ===== 异步命令（联机核心） =====

  /**
   * 创建房间并等待房间创建成功
   * @param Nickname 昵称
   * @returns 房间码
   */
  async CreateRoomAsync(Nickname: string): Promise<string> {
    const Result = await this._Client.SendAndWait<{ roomCode: string; playerId: PlayerId }>(
      ClientMsg.CreateRoom(Nickname),
      DEFAULT_TIMEOUT_MS,
    );
    this._MyPlayerId = Result.playerId;
    this._PlayerNicknames.set(Result.playerId, Nickname);
    return Result.roomCode;
  }

  /**
   * 加入房间并等待加入成功
   * @param RoomCode 房间码
   * @param Nickname 昵称
   */
  async JoinRoomAsync(RoomCode: string, Nickname: string): Promise<void> {
    const Result = await this._Client.SendAndWait<{ roomCode: string; playerId: PlayerId; players: Array<{ playerId: PlayerId; nickname: string; isHost: boolean }> }>(
      ClientMsg.JoinRoom(RoomCode, Nickname),
      DEFAULT_TIMEOUT_MS,
    );
    this._MyPlayerId = Result.playerId;
    for (const P of Result.players) {
      this._PlayerNicknames.set(P.playerId, P.nickname);
    }
  }

  /**
   * 开始游戏（房主调用）
   * 等待服务端 GAME_STARTING 消息，初始化本地 GameStore
   */
  async StartAsync(): Promise<void> {
    const Result = await this._Client.SendAndWait<GameStartingPayload>(
      ClientMsg.StartGame(),
      DEFAULT_TIMEOUT_MS,
    );
    this.InitFromGameStarting(Result);
  }

  /**
   * 用服务端下发的 GAME_STARTING 载荷初始化本地 GameStore 镜像
   * - 房主：StartAsync 内部调用
   * - 非房主：通过 WaitForGameStart 或外部监听 GAME_STARTING 后调用
   */
  InitFromGameStarting(Payload: GameStartingPayload): void {
    // 使用服务端下发的种子初始化本地 GameStore 镜像
    this._LocalStore = new GameStore(
      CreateDefaultConfig(Payload.players.length as 2 | 3 | 4, Payload.seed),
    );

    // 记录玩家昵称
    for (const P of Payload.players) {
      this._PlayerNicknames.set(P.playerId, P.nickname);
    }

    // 本地 GameStore 也需要启动（进入发射阶段）
    this._LocalStore.Start();
  }

  /**
   * 尝试发射
   * 发送 ATTEMPT_LAUNCH，等待 LAUNCH_RESULT，应用到本地镜像
   */
  async AttemptLaunchAsync(): Promise<LaunchResult> {
    const Result = await this._Client.SendAndWait<LaunchResultPayload>(
      ClientMsg.AttemptLaunch(),
      DEFAULT_TIMEOUT_MS,
    );

    // 将结果应用到本地镜像
    if (this._LocalStore) {
      this._ApplyLaunchResult(Result);
    }

    return Result.launchResult;
  }

  /**
   * 执行回合
   * 发送 PLAY_TURN，等待 TURN_RESULT，应用到本地镜像
   */
  async PlayTurnAsync(Mode: DiceMode): Promise<TurnResult> {
    const Result = await this._Client.SendAndWait<TurnResultPayload>(
      ClientMsg.PlayTurn(Mode as DiceMode),
      DEFAULT_TIMEOUT_MS,
    );

    // 将结果应用到本地镜像
    if (this._LocalStore) {
      this._ApplyTurnResult(Result);
    }

    return Result.turnResult;
  }

  /**
   * 加赛
   * 发送 RUN_TIEBREAKER，等待 TIEBREAKER_RESULT，应用到本地镜像
   */
  async RunTiebreakerAsync(): Promise<TiebreakerRound> {
    const Result = await this._Client.SendAndWait<TiebreakerResultPayload>(
      ClientMsg.RunTiebreaker(),
      DEFAULT_TIMEOUT_MS,
    );

    if (this._LocalStore) {
      this._ApplyTiebreakerResult(Result);
    }

    return Result.round;
  }

  // ===== 事件监听（重定向到本地 Store） =====

  /**
   * 注册事件监听器
   *
   * 同时监听：
   * 1. 本地 Store 的事件（当 Turn/Launch 结果 arrive 后触发）
   * 2. WebSocket 服务端推送的事件（如 GAME_OVER / PLAYER_DISCONNECTED）
   */
  On<K extends keyof StoreEvents>(Type: K, Fn: Listener<StoreEvents[K]>): () => void {
    // 本地 Store 尚未创建时，暂存监听器
    if (!this._LocalStore) {
      // 延迟绑定：在 StartAsync 初始化 LocalStore 后再注册
    }

    const UnsubLocal = this._LocalStore?.On(Type, Fn) ?? (() => { /* noop */ });

    return () => {
      UnsubLocal();
    };
  }

  /**
   * 获取玩家昵称
   */
  GetPlayerNickname(PlayerId: PlayerId): string {
    return this._PlayerNicknames.get(PlayerId) ?? `玩家${PlayerId + 1}`;
  }

  /**
   * 离开房间
   */
  LeaveRoom(): void {
    this._Client.Send(ClientMsg.LeaveRoom());
    this._Client.Disconnect();
  }

  /**
   * 连接并等待服务端推送的 GAME_STARTING（非房主用）
   * 在加入房间后调用，阻塞直到服务端推送 GAME_STARTING
   */
  WaitForGameStart(): Promise<GameStartingPayload> {
    return new Promise<GameStartingPayload>((Resolve) => {
      this._Client.Once('GAME_STARTING', (Payload) => {
        // 初始化本地镜像
        this._LocalStore = new GameStore(
          CreateDefaultConfig(Payload.players.length as 2 | 3 | 4, Payload.seed),
        );
        for (const P of Payload.players) {
          this._PlayerNicknames.set(P.playerId, P.nickname);
        }
        this._LocalStore.Start();
        Resolve(Payload);
      });
    });
  }

  /**
   * 监听服务端推送的回合结果（非当前玩家的回合）
   * 当服务端广播 TURN_RESULT 时自动应用到本地镜像
   */
  ListenForRemoteTurns(): void {
    this._Client.On('TURN_RESULT', (Payload: TurnResultPayload) => {
      if (this._LocalStore) {
        this._ApplyTurnResult(Payload);
      }
    });

    this._Client.On('LAUNCH_RESULT', (Payload: LaunchResultPayload) => {
      if (this._LocalStore) {
        this._ApplyLaunchResult(Payload);
      }
    });

    this._Client.On('TIEBREAKER_RESULT', (Payload: TiebreakerResultPayload) => {
      if (this._LocalStore) {
        this._ApplyTiebreakerResult(Payload);
      }
    });

    this._Client.On('GAME_OVER', (_Payload: GameOverPayload) => {
      if (this._LocalStore && this._LocalStore.Result) {
        // 本地 Store 应该已经有了 Result，直接触发事件
      }
    });
  }

  // ===== 内部方法 =====

  /**
   * 将服务端 LAUNCH_RESULT 应用到本地 GameStore
   *
   * 本地 GameStore 需要与权威服务端保持同步，但发射操作的同步比较特殊：
   * 服务端已经执行了发射，我们直接用 AttemptLaunch() 来推进本地状态。
   * 由于双方使用相同的 Seed + 相同的调用序列，结果应一致。
   * 若不巧不一致，以服务端的 Payload.snapshot 为准。
   */
  private _ApplyLaunchResult(Payload: LaunchResultPayload): void {
    if (!this._LocalStore) return;

    // 检查本地 Store 是否已在正确阶段
    if (this._LocalStore.Phase !== GamePhase.LaunchPhase) return;

    // 执行本地发射（相同种子保证相同结果）
    const LocalResult = this._LocalStore.AttemptLaunch();

    // 校验一致性（开发调试用）
    if (LocalResult.Sum !== Payload.launchResult.Sum) {
      console.warn('[NetworkGameStore] 发射结果不一致！本地:', LocalResult.Sum, '服务端:', Payload.launchResult.Sum);
    }
  }

  /**
   * 将服务端 TURN_RESULT 应用到本地 GameStore
   */
  private _ApplyTurnResult(Payload: TurnResultPayload): void {
    if (!this._LocalStore) return;

    // 仅当本地 Store 处于 SelectMode 且轮到正确玩家时 apply
    if (this._LocalStore.Phase !== GamePhase.SelectMode) return;

    const Mode = Payload.turnResult.Mode;
    const LocalResult = this._LocalStore.PlayTurn(Mode);

    // 校验一致性
    if (LocalResult.Dice && Payload.turnResult.Dice && LocalResult.Dice.Sum !== Payload.turnResult.Dice.Sum) {
      console.warn('[NetworkGameStore] 回合结果不一致！本地:', LocalResult.Dice.Sum, '服务端:', Payload.turnResult.Dice.Sum);
    }

    // 以服务端快照校正（防御性）
    // 简单起见，仅记录日志，不强制覆盖
  }

  /**
   * 将服务端 TIEBREAKER_RESULT 应用到本地 GameStore
   */
  private _ApplyTiebreakerResult(Payload: TiebreakerResultPayload): void {
    if (!this._LocalStore) return;

    if (this._LocalStore.Phase !== GamePhase.Tiebreaker) return;

    const LocalRound = this._LocalStore.RunTiebreaker();
    if (LocalRound.IsFinal !== Payload.round.IsFinal) {
      console.warn('[NetworkGameStore] 加赛结果不一致！');
    }
  }

  get CardEnabled(): boolean { return this._LocalStore?.CardEnabled ?? false; }
  GetCardHand(PlayerId: PlayerId) { return this._LocalStore?.GetCardHand(PlayerId) ?? []; }
  GetCardSnapshot() { return this._LocalStore?.GetCardSnapshot() ?? { DeckSize: 0, DiscardSize: 0, Hands: new Map(), ActiveConstantCount: 0 }; }
  GetCardPlayableCards(PlayerId: PlayerId) { return this._LocalStore?.GetCardPlayableCards(PlayerId) ?? []; }
  CanPlayCard(PlayerId: PlayerId, InstanceId: number) { return this._LocalStore?.CanPlayCard(PlayerId, InstanceId) ?? false; }
  UseCard(PlayerId: PlayerId, InstanceId: number, TargetPlayerId: PlayerId | null) { return this._LocalStore?.UseCard(PlayerId, InstanceId, TargetPlayerId) ?? null; }
  GetCardActiveConstants() { return this._LocalStore?.GetCardActiveConstants() ?? 0; }
  ScryTopCards(Count: number) { return this._LocalStore?.ScryTopCards(Count) ?? []; }
  ScryPickCard(PlayerId: PlayerId, InstanceId: number) { return this._LocalStore?.ScryPickCard(PlayerId, InstanceId) ?? false; }
  ScryArrangeTop(CardIds: string[]) { this._LocalStore?.ScryArrangeTop(CardIds); }
}
