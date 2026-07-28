/**
 * src/Net/WebSocketClient.ts
 * 操作类型：新建
 *
 * WebSocket 客户端封装——连接管理、消息收发、心跳、自动重连。
 * 关联：联机架构方案 §3 阶段 2
 *
 * 设计要点：
 * 1. sendAndWait 模式：发送消息后返回 Promise，等服务端匹配响应后 resolve
 *    ——通过消息 type 的对应关系（PLAY_TURN → TURN_RESULT）匹配
 * 2. 心跳机制：每 15 秒发送 HEARTBEAT，服务端回复 HEARTBEAT_ACK
 * 3. 自动重连：指数退避 1s/2s/4s/8s，最多 3 次
 * 4. 连接状态机：IDLE → CONNECTING → CONNECTED / DISCONNECTED / ERROR
 * 5. on() 按消息 type 注册监听器，返回取消订阅函数
 * 6. 消息队列：连接未就绪时暂存消息，连接成功后批量发送
 */
import type { ClientMessage, ServerMessage, ServerMessageType, ExtractPayload } from './Messages';
import { SerializeMessage, DeserializeMessage } from './Messages';

// ===== 连接状态 =====

export enum ConnectionState {
  /** 未连接 */
  Idle = 'Idle',
  /** 连接中 */
  Connecting = 'Connecting',
  /** 已连接 */
  Connected = 'Connected',
  /** 已断开 */
  Disconnected = 'Disconnected',
  /** 连接错误（重试耗尽后进入此状态） */
  Error = 'Error',
}

// ===== 配置常量 =====

const HEARTBEAT_INTERVAL_MS = 15000;
const HEARTBEAT_TIMEOUT_MS = 5000;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 8000;
const RECONNECT_MAX_ATTEMPTS = 3;
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

// ===== 请求-响应映射 =====

/**
 * 客户端消息 type → 期望的服务端响应 type
 * sendAndWait 根据此映射等待对应的响应消息
 */
const RequestResponseMap: Partial<Record<ClientMessage['type'], ServerMessageType>> = {
  CREATE_ROOM: 'ROOM_CREATED',
  JOIN_ROOM: 'ROOM_JOINED',
  START_GAME: 'GAME_STARTING',
  PLAY_TURN: 'TURN_RESULT',
  ATTEMPT_LAUNCH: 'LAUNCH_RESULT',
  RUN_TIEBREAKER: 'TIEBREAKER_RESULT',
  USE_CARD: 'CARD_RESULT',
  SPECTATE_ROOM: 'SPECTATOR_JOINED',
  GET_ROOM_LIST: 'ROOM_LIST',
};

// ===== 类型定义 =====

/** 消息监听器函数类型 */
type MessageListener<T extends ServerMessageType> = (Payload: ExtractPayload<T>) => void;

/** 待处理的请求（sendAndWait 内部使用） */
interface PendingRequest {
  Resolve: (Payload: unknown) => void;
  Reject: (Error: Error) => void;
  ExpectedType: ServerMessageType;
  Timer: ReturnType<typeof setTimeout>;
}

/**
 * WebSocket 客户端
 *
 * 用法：
 *   const Client = new WebSocketClient('ws://localhost:9528');
 *   await Client.Connect();
 *   Client.On('PLAYER_JOINED', (P) => console.log('新玩家:', P.nickname));
 *   const Result = await Client.SendAndWait(ClientMsg.CreateRoom('玩家1'));
 */
export class WebSocketClient {
  private readonly _Url: string;
  private _Ws: WebSocket | null = null;
  private _State: ConnectionState = ConnectionState.Idle;

  /** 按消息类型注册的监听器 Map */
  private readonly _Listeners: Map<ServerMessageType, Set<MessageListener<ServerMessageType>>> = new Map();

  /** 待处理的 sendAndWait 请求队列 */
  private readonly _PendingRequests: Map<string, PendingRequest> = new Map();

  /** 连接就绪前暂存的消息队列 */
  private readonly _MessageQueue: ClientMessage[] = [];

  // 心跳
  private _HeartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _HeartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  // 重连
  private _ReconnectAttempts = 0;
  private _ReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _ShouldReconnect = true;

  // 请求 ID 计数器
  private _RequestIdCounter = 0;

  constructor(Url: string) {
    this._Url = Url;
  }

  // ===== 公开属性 =====

  /** 当前连接状态 */
  get State(): ConnectionState {
    return this._State;
  }

  /** 是否已连接 */
  get IsConnected(): boolean {
    return this._State === ConnectionState.Connected;
  }

  // ===== 连接管理 =====

  /**
   * 建立 WebSocket 连接
   * @returns 连接成功时 resolve，失败时 reject
   */
  Connect(): Promise<void> {
    return new Promise<void>((Resolve, Reject) => {
      if (this._State === ConnectionState.Connected) {
        Resolve();
        return;
      }

      this._SetState(ConnectionState.Connecting);

      try {
        this._Ws = new WebSocket(this._Url);
      } catch (Err) {
        this._SetState(ConnectionState.Error);
        Reject(new Error(`WebSocket 构造失败: ${Err}`));
        return;
      }

      this._Ws.onopen = () => {
        this._SetState(ConnectionState.Connected);
        this._ReconnectAttempts = 0;
        this._StartHeartbeat();
        this._FlushQueue();
        Resolve();
      };

      this._Ws.onmessage = (Event: MessageEvent<string>) => {
        this._HandleMessage(Event.data);
      };

      this._Ws.onclose = (Event: CloseEvent) => {
        this._CleanupHeartbeat();
        this._RejectAllPending(new Error(`连接关闭 (code=${Event.code})`));

        if (this._ShouldReconnect && this._ReconnectAttempts < RECONNECT_MAX_ATTEMPTS) {
          this._ScheduleReconnect();
        } else {
          this._SetState(ConnectionState.Disconnected);
        }
      };

      this._Ws.onerror = () => {
        // onerror 后通常会触发 onclose，这里不额外处理
        // 但如果连接从未成功（onopen 未触发），需要 reject
        if (this._State === ConnectionState.Connecting) {
          this._SetState(ConnectionState.Error);
          Reject(new Error('WebSocket 连接失败'));
        }
      };
    });
  }

  /**
   * 断开连接
   * @param ShouldReconnect 断开后是否自动重连（默认 false）
   */
  Disconnect(ShouldReconnect = false): void {
    this._ShouldReconnect = ShouldReconnect;
    this._CleanupHeartbeat();
    this._CancelReconnect();
    this._RejectAllPending(new Error('主动断开连接'));
    if (this._Ws) {
      this._Ws.onclose = null; // 防止触发重连逻辑
      this._Ws.close();
      this._Ws = null;
    }
    this._SetState(ConnectionState.Disconnected);
  }

  // ===== 消息发送 =====

  /**
   * 发送消息（fire-and-forget，不等待响应）
   * 连接未就绪时消息会暂存队列，连接成功后自动发送
   */
  Send(Msg: ClientMessage): void {
    if (this._State === ConnectionState.Connected && this._Ws?.readyState === WebSocket.OPEN) {
      this._Ws.send(SerializeMessage(Msg));
    } else if (this._State === ConnectionState.Connecting) {
      this._MessageQueue.push(Msg);
    } else {
      console.warn('[WebSocketClient] 未连接，消息丢弃:', Msg.type);
    }
  }

  /**
   * 发送消息并等待服务端匹配的响应
   *
   * 通过 RequestResponseMap 确定期望的响应 type。
   * 若服务端返回 ERROR 消息，则 reject。
   *
   * @param Msg 客户端消息
   * @param TimeoutMs 超时（毫秒），默认 10 秒
   * @returns 服务端响应 payload
   */
  SendAndWait<T>(Msg: ClientMessage, TimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): Promise<T> {
    const ExpectedType = RequestResponseMap[Msg.type];
    if (ExpectedType === undefined) {
      return Promise.reject(new Error(`消息类型 ${Msg.type} 不支持请求-响应模式`));
    }

    // 若未连接，先尝试连接
    if (this._State !== ConnectionState.Connected) {
      return this.Connect().then(() => this.SendAndWait<T>(Msg, TimeoutMs));
    }

    return new Promise<T>((Resolve, Reject) => {
      const RequestId = `${Msg.type}_${++this._RequestIdCounter}_${Date.now()}`;

      const Timer = setTimeout(() => {
        this._PendingRequests.delete(RequestId);
        Reject(new Error(`请求超时: ${Msg.type}（${TimeoutMs}ms）`));
      }, TimeoutMs);

      this._PendingRequests.set(RequestId, {
        Resolve: Resolve as (Payload: unknown) => void,
        Reject,
        ExpectedType,
        Timer,
      });

      // 发送消息
      if (this._Ws?.readyState === WebSocket.OPEN) {
        this._Ws.send(SerializeMessage(Msg));
      } else {
        clearTimeout(Timer);
        this._PendingRequests.delete(RequestId);
        Reject(new Error('WebSocket 不在 OPEN 状态'));
      }
    });
  }

  // ===== 事件监听 =====

  /**
   * 注册消息监听器
   *
   * @param Type 服务端消息类型
   * @param Handler 回调函数
   * @returns 取消订阅函数
   */
  On<T extends ServerMessageType>(Type: T, Handler: MessageListener<T>): () => void {
    if (!this._Listeners.has(Type)) {
      this._Listeners.set(Type, new globalThis.Set());
    }
    const ListenerSet = this._Listeners.get(Type)!;
    // 运行时类型安全：Handler 接收的 payload 类型由 Type 参数保证
    // 存储时转为宽类型以兼容 Map 的泛型约束
    ListenerSet.add(Handler as unknown as MessageListener<ServerMessageType>);

    return () => {
      ListenerSet.delete(Handler as unknown as MessageListener<ServerMessageType>);
      if (ListenerSet.size === 0) {
        this._Listeners.delete(Type);
      }
    };
  }

  /**
   * 一次性监听（收到一次后自动取消订阅）
   */
  Once<T extends ServerMessageType>(Type: T, Handler: MessageListener<T>): () => void {
    const Unsub = this.On(Type, (Payload) => {
      Unsub();
      Handler(Payload);
    });
    return Unsub;
  }

  // ===== 内部方法 =====

  /** 设置连接状态 */
  private _SetState(State: ConnectionState): void {
    this._State = State;
  }

  /** 处理收到的消息 */
  private _HandleMessage(Raw: string): void {
    let Msg: ClientMessage | ServerMessage;
    try {
      Msg = DeserializeMessage(Raw);
    } catch {
      console.warn('[WebSocketClient] 消息解析失败:', Raw.slice(0, 100));
      return;
    }

    const Type = Msg.type as ServerMessageType;

    // 心跳确认：重置心跳超时
    if (Type === 'HEARTBEAT_ACK') {
      this._ResetHeartbeatTimeout();
      return;
    }

    // 错误消息：拒绝匹配的待处理请求
    if (Type === 'ERROR') {
      const ErrorPayload = Msg.payload as { code: string; message: string };
      this._RejectPendingByError(ErrorPayload);
      // 同时广播给 ERROR 监听器
      this._EmitToListeners(Type, Msg.payload);
      return;
    }

    // 尝试匹配待处理的 sendAndWait 请求
    this._ResolvePending(Type, Msg.payload);

    // 广播给注册的监听器
    this._EmitToListeners(Type, Msg.payload);
  }

  /** 将消息广播给对应 type 的监听器 */
  private _EmitToListeners(Type: ServerMessageType, Payload: unknown): void {
    const Listeners = this._Listeners.get(Type);
    if (Listeners && Listeners.size > 0) {
      for (const Fn of Listeners) {
        try {
          // 监听器存储时已擦除具体类型，运行时 payload 类型由 Type 保证
          (Fn as (P: unknown) => void)(Payload);
        } catch (Err) {
          console.error(`[WebSocketClient] 监听器异常 (type=${Type}):`, Err);
        }
      }
    }
  }

  /** 根据消息类型匹配并 resolve 待处理请求 */
  private _ResolvePending(Type: ServerMessageType, Payload: unknown): void {
    for (const [Id, Req] of this._PendingRequests) {
      if (Req.ExpectedType === Type) {
        clearTimeout(Req.Timer);
        this._PendingRequests.delete(Id);
        Req.Resolve(Payload);
        return; // 只匹配第一个
      }
    }
  }

  /** ERROR 消息拒绝所有匹配的待处理请求 */
  private _RejectPendingByError(ErrorPayload: { code: string; message: string }): void {
    for (const [Id, Req] of this._PendingRequests) {
      clearTimeout(Req.Timer);
      this._PendingRequests.delete(Id);
      Req.Reject(new Error(`[${ErrorPayload.code}] ${ErrorPayload.message}`));
    }
  }

  /** 拒绝所有待处理请求（断开连接时调用） */
  private _RejectAllPending(Reason: Error): void {
    for (const [Id, Req] of this._PendingRequests) {
      clearTimeout(Req.Timer);
      this._PendingRequests.delete(Id);
      Req.Reject(Reason);
    }
  }

  /** 发送暂存队列中的消息 */
  private _FlushQueue(): void {
    while (this._MessageQueue.length > 0) {
      const Msg = this._MessageQueue.shift()!;
      this.Send(Msg);
    }
  }

  // ===== 心跳 =====

  /** 启动心跳 */
  private _StartHeartbeat(): void {
    this._StopHeartbeat();

    this._HeartbeatTimer = setInterval(() => {
      if (this._Ws?.readyState === WebSocket.OPEN) {
        this._Ws.send(SerializeMessage({ type: 'HEARTBEAT', payload: {} }));
      }
    }, HEARTBEAT_INTERVAL_MS);

    this._ResetHeartbeatTimeout();
  }

  /** 停止心跳 */
  private _StopHeartbeat(): void {
    if (this._HeartbeatTimer !== null) {
      clearInterval(this._HeartbeatTimer);
      this._HeartbeatTimer = null;
    }
  }

  /** 重置心跳超时计时器 */
  private _ResetHeartbeatTimeout(): void {
    if (this._HeartbeatTimeoutTimer !== null) {
      clearTimeout(this._HeartbeatTimeoutTimer);
    }
    this._HeartbeatTimeoutTimer = setTimeout(() => {
      console.warn('[WebSocketClient] 心跳超时，断开连接');
      this.Disconnect(true); // 触发重连
    }, HEARTBEAT_TIMEOUT_MS);
  }

  /** 清理心跳资源 */
  private _CleanupHeartbeat(): void {
    this._StopHeartbeat();
    if (this._HeartbeatTimeoutTimer !== null) {
      clearTimeout(this._HeartbeatTimeoutTimer);
      this._HeartbeatTimeoutTimer = null;
    }
  }

  // ===== 重连 =====

  /** 安排重连（指数退避） */
  private _ScheduleReconnect(): void {
    this._CancelReconnect();

    const Delay = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(2, this._ReconnectAttempts),
      RECONNECT_MAX_DELAY_MS,
    );

    this._ReconnectAttempts += 1;
    this._SetState(ConnectionState.Disconnected);

    console.log(`[WebSocketClient] ${Delay}ms 后第 ${this._ReconnectAttempts} 次重连...`);

    this._ReconnectTimer = setTimeout(() => {
      this.Connect().catch(() => {
        // Connect 内部会处理重试逻辑
      });
    }, Delay);
  }

  /** 取消重连 */
  private _CancelReconnect(): void {
    if (this._ReconnectTimer !== null) {
      clearTimeout(this._ReconnectTimer);
      this._ReconnectTimer = null;
    }
  }
}
