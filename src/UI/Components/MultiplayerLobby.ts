/**
 * src/UI/Components/MultiplayerLobby.ts
 * 操作类型：新建
 *
 * 联机大厅——从主菜单联机按钮进入，处理创建/加入房间、玩家列表、房主开局。
 * 关联：联机架构方案 §3 阶段 6
 *
 * 设计要点：
 * 1. 飞船控制台风格延续 MainMenu，使用相同 CSS 变量
 * 2. 两步流程：选择模式（创建/加入） → 等待大厅
 * 3. 创建：输入昵称 → CreateRoom → 展示房间码 + 玩家列表 + "开始"按钮（仅房主）
 * 4. 加入：输入昵称 + 房间码 → JoinRoom → 展示玩家列表 + "等待房主开始"提示
 * 5. 游戏开始后由外部 AppController 关闭大厅、进入对局
 * 6. 错误（房间不存在/已满/昵称重复）显示在面板底部，提供"返回菜单"
 */
import { El, On } from '../Dom';
import { Component } from './Component';
import { LobbyClient, type LobbyEvents } from '@/Net/LobbyClient';
import { WebSocketClient, ConnectionState } from '@/Net/WebSocketClient';
import { NetworkGameStore } from '@/Net/NetworkGameStore';
import type { PlayerId } from '@/Types/Player';

/** 大厅结果——交回给 AppController 决定下一步 */
export type LobbyResult =
  | { Kind: 'Started'; Store: NetworkGameStore; PlayerCount: number; Seed: number }
  | { Kind: 'BackToMenu' };

/** 玩家信息（用于列表展示） */
interface PlayerEntry {
  PlayerId: PlayerId;
  Nickname: string;
  IsHost: boolean;
  IsAI: boolean;
  IsLocal: boolean;
}

/** 默认 WebSocket 地址（同机开发） */
const DEFAULT_WS_URL = 'ws://localhost:9528';

export class MultiplayerLobby extends Component {
  private readonly _OnResult: (Result: LobbyResult) => void;

  // 网络层
  private _WsClient: WebSocketClient | null = null;
  private _Lobby: LobbyClient | null = null;

  // 当前状态
  private _Phase: 'Mode' | 'Waiting' = 'Mode';
  private _Players: PlayerEntry[] = [];
  private _IsHost = false;
  private _RoomCode = '';
  private _LocalPlayerId: PlayerId = -1;

  // DOM 引用
  private _Content: HTMLElement | null = null;
  private _StatusEl: HTMLElement | null = null;
  private _CleanupFns: (() => void)[] = [];

  constructor(OnResult: (Result: LobbyResult) => void) {
    super();
    this._OnResult = OnResult;
  }

  Mount(Parent: HTMLElement): void {
    const Root = El({
      Tag: 'div',
      Class: 'cockpit mp-lobby',
      Parent,
      Style: 'position:absolute;inset:0;z-index:100;',
    });
    this.SetRoot(Root);

    // 顶部标题
    const Top = El({ Tag: 'div', Class: 'cockpit-topbar', Parent: Root });
    El({
      Tag: 'div',
      Class: 'cockpit-title font-display',
      Parent: Top,
      Html: '联机大厅<span class="sub">MULTIPLAYER · LINK</span>',
    });
    El({
      Tag: 'div',
      Class: 'telemetry',
      Parent: Top,
      Html: '<span class="led on"></span>NET LINK · ws://localhost:9528',
    });

    // 内容容器（可重渲染）
    this._Content = El({ Tag: 'div', Class: 'mp-content', Parent: Root });

    // 状态栏
    this._StatusEl = El({
      Tag: 'div',
      Class: 'mp-status font-mono',
      Parent: Root,
      Text: '',
    });

    this._RenderModeChoice();
  }

  // ===== 阶段 1：选择模式 =====

  private _RenderModeChoice(): void {
    if (!this._Content) return;
    this._Content.innerHTML = '';

    El({
      Tag: 'div',
      Class: 'mp-section-label',
      Parent: this._Content,
      Text: '选择操作 · SELECT MODE',
    });

    // 创建房间卡
    const CreateCard = this._Card('创建房间', 'CREATE', '建立新房间，获得 4 位房间码邀请好友加入');
    const CreateBtn = El({
      Tag: 'button',
      Class: 'ignition font-display',
      Parent: CreateCard,
      Text: '创建房间 CREATE',
    }) as HTMLButtonElement;
    this._CleanupFns.push(On(CreateBtn, 'click', () => this._ShowNicknameForm('create')));

    // 加入房间卡
    const JoinCard = this._Card('加入房间', 'JOIN', '输入 4 位房间码加入已存在的房间');
    const JoinBtn = El({
      Tag: 'button',
      Class: 'link-btn font-display',
      Parent: JoinCard,
      Text: '加入房间 JOIN',
    }) as HTMLButtonElement;
    this._CleanupFns.push(On(JoinBtn, 'click', () => this._ShowNicknameForm('join')));

    // 返回菜单
    const Back = El({
      Tag: 'button',
      Class: 'mp-back font-mono',
      Parent: this._Content,
      Text: '← 返回主菜单',
    }) as HTMLButtonElement;
    this._CleanupFns.push(On(Back, 'click', () => this._ReturnToMenu()));
  }

  // ===== 阶段 2：填写信息 =====

  private _ShowNicknameForm(Mode: 'create' | 'join'): void {
    if (!this._Content) return;
    this._Content.innerHTML = '';

    El({
      Tag: 'div',
      Class: 'mp-section-label',
      Parent: this._Content,
      Text: Mode === 'create' ? '创建房间 · CREATE ROOM' : '加入房间 · JOIN ROOM',
    });

    const Form = El({ Tag: 'div', Class: 'mp-form', Parent: this._Content });

    // 昵称输入
    El({ Tag: 'div', Class: 'mp-field-label font-mono', Parent: Form, Text: '呼号 · NICKNAME' });
    const NicknameInput = El({
      Tag: 'input',
      Class: 'cockpit-input font-mono',
      Parent: Form,
    }) as HTMLInputElement;
    NicknameInput.type = 'text';
    NicknameInput.maxLength = 16;
    NicknameInput.placeholder = '1-16 字符';
    NicknameInput.value = `玩家${Math.floor(Math.random() * 9000) + 1000}`;

    // 房间码输入（仅 join）
    let RoomCodeInput: HTMLInputElement | null = null;
    if (Mode === 'join') {
      El({ Tag: 'div', Class: 'mp-field-label font-mono', Parent: Form, Text: '房间码 · ROOM CODE' });
      RoomCodeInput = El({
        Tag: 'input',
        Class: 'cockpit-input font-mono',
        Parent: Form,
      }) as HTMLInputElement;
      RoomCodeInput.type = 'text';
      RoomCodeInput.maxLength = 4;
      RoomCodeInput.placeholder = '4 位数字';
      RoomCodeInput.inputMode = 'numeric';
      RoomCodeInput.pattern = '[0-9]{4}';
    }

    // 操作按钮
    const ActionRow = El({ Tag: 'div', Class: 'mp-action-row', Parent: Form });
    const SubmitBtn = El({
      Tag: 'button',
      Class: Mode === 'create' ? 'ignition font-display' : 'link-btn font-display',
      Parent: ActionRow,
      Text: Mode === 'create' ? '创建 CREATE' : '加入 JOIN',
    }) as HTMLButtonElement;

    const CancelBtn = El({
      Tag: 'button',
      Class: 'mp-back font-mono',
      Parent: ActionRow,
      Text: '← 返回',
    }) as HTMLButtonElement;

    this._CleanupFns.push(On(SubmitBtn, 'click', async () => {
      const Nickname = NicknameInput.value.trim();
      if (!Nickname) {
        this._ShowError('呼号不能为空');
        return;
      }
      if (Mode === 'join' && RoomCodeInput) {
        const Code = RoomCodeInput.value.trim();
        if (!/^\d{4}$/.test(Code)) {
          this._ShowError('房间码必须为 4 位数字');
          return;
        }
        await this._DoJoin(Nickname, Code);
      } else {
        await this._DoCreate(Nickname);
      }
    }));
    this._CleanupFns.push(On(CancelBtn, 'click', () => this._RenderModeChoice()));
  }

  // ===== 创建房间 =====

  private async _DoCreate(Nickname: string): Promise<void> {
    this._ShowBusy('正在创建房间...');
    try {
      await this._EnsureClient();
      if (!this._Lobby) return;
      const RoomCode = await this._Lobby.CreateRoom(Nickname);
      this._IsHost = true;
      this._LocalPlayerId = this._Lobby.MyPlayerId;
      this._RoomCode = RoomCode;
      this._Players = [{
        PlayerId: this._LocalPlayerId,
        Nickname,
        IsHost: true,
        IsAI: false,
        IsLocal: true,
      }];
      this._RenderWaitingRoom();
    } catch (Err) {
      this._ShowError(`创建失败: ${(Err as Error).message}`);
    }
  }

  // ===== 加入房间 =====

  private async _DoJoin(Nickname: string, RoomCode: string): Promise<void> {
    this._ShowBusy('正在加入房间...');
    try {
      await this._EnsureClient();
      if (!this._Lobby) return;
      await this._Lobby.JoinRoom(RoomCode, Nickname);
      this._IsHost = this._Lobby.IsHost;
      this._LocalPlayerId = this._Lobby.MyPlayerId;
      this._RoomCode = RoomCode;
      // 初始玩家列表会通过 ROOM_JOINED 的 payload 填充，但 LobbyClient 已把详情交给我们
      // 这里手动构造列表占位，后续 PLAYER_JOINED/LEFT 会更新
      this._Players = [{
        PlayerId: this._LocalPlayerId,
        Nickname,
        IsHost: this._IsHost,
        IsAI: false,
        IsLocal: true,
      }];
      this._RenderWaitingRoom();
    } catch (Err) {
      this._ShowError(`加入失败: ${(Err as Error).message}`);
    }
  }

  // ===== 等待大厅 =====

  private _RenderWaitingRoom(): void {
    if (!this._Content) return;
    this._Content.innerHTML = '';
    this._Phase = 'Waiting';

    El({
      Tag: 'div',
      Class: 'mp-section-label',
      Parent: this._Content,
      Text: '等待大厅 · WAITING ROOM',
    });

    // 房间码卡片
    const CodeCard = El({ Tag: 'div', Class: 'mp-code-card', Parent: this._Content });
    El({ Tag: 'div', Class: 'mp-field-label font-mono', Parent: CodeCard, Text: '房间码 · ROOM CODE' });
    El({
      Tag: 'div',
      Class: 'mp-room-code font-display',
      Parent: CodeCard,
      Text: this._RoomCode,
    });
    El({
      Tag: 'div',
      Class: 'mp-hint font-mono',
      Parent: CodeCard,
      Text: this._IsHost
        ? '将此房间码分享给好友，等待他们加入。最少 2 人可开局。'
        : '等待房主开始游戏...',
    });

    // 玩家列表
    const PlayerList = El({ Tag: 'div', Class: 'mp-player-list', Parent: this._Content });
    El({ Tag: 'div', Class: 'mp-field-label font-mono', Parent: PlayerList, Text: '已就位 · PLAYERS' });
    const List = El({ Tag: 'div', Class: 'mp-player-grid', Parent: PlayerList });
    this._RenderPlayerEntries(List);

    // 操作按钮
    const ActionRow = El({ Tag: 'div', Class: 'mp-action-row', Parent: this._Content });
    if (this._IsHost) {
      const StartBtn = El({
        Tag: 'button',
        Class: 'ignition font-display',
        Parent: ActionRow,
        Text: '开始游戏 START',
      }) as HTMLButtonElement;
      this._CleanupFns.push(On(StartBtn, 'click', () => this._StartGame()));
    } else {
      El({
        Tag: 'div',
        Class: 'mp-waiting font-mono',
        Parent: ActionRow,
        Html: '<span class="led on"></span>等待房主开局...',
      });
    }

    const LeaveBtn = El({
      Tag: 'button',
      Class: 'mp-back font-mono',
      Parent: ActionRow,
      Text: '← 离开房间',
    }) as HTMLButtonElement;
    this._CleanupFns.push(On(LeaveBtn, 'click', () => this._LeaveRoom()));
  }

  /** 渲染玩家列表项 */
  private _RenderPlayerEntries(Container: HTMLElement): void {
    Container.innerHTML = '';
    for (const P of this._Players) {
      const Tags: string[] = [];
      if (P.IsLocal) Tags.push('YOU');
      if (P.IsHost) Tags.push('HOST');
      if (P.IsAI) Tags.push('AI');
      const TagHtml = Tags.length > 0
        ? Tags.map((T) => `<span class="mp-tag">${T}</span>`).join('')
        : '';
      El({
        Tag: 'div',
        Class: 'mp-player-row' + (P.IsLocal ? ' local' : ''),
        Parent: Container,
        Html: `<span class="mp-player-name">${this._Escape(P.Nickname)}</span><span class="mp-player-tags">${TagHtml}</span>`,
      });
    }
  }

  // ===== 开始游戏（房主） =====

  private async _StartGame(): Promise<void> {
    if (!this._IsHost || !this._Lobby) {
      this._ShowError('只有房主可以开始游戏');
      return;
    }
    if (this._Players.length < 2) {
      this._ShowError('至少需要 2 名玩家');
      return;
    }
    this._ShowBusy('正在初始化对局...');
    try {
      // 房主调用 StartGame —— 服务端会广播 GAME_STARTING 给所有人（包括房主自己）
      await this._Lobby.StartGame();
      // NetworkGameStore.StartAsync 已被 LobbyClient 触发？
      // 不，LobbyClient.StartGame 只是发了消息并等待响应。
      // 真正的 NetworkGameStore 初始化在 AppController 端进行。
      // 这里改为：直接交回 AppController，由它接管 NetworkGameStore
      this._NotifyStarted();
    } catch (Err) {
      this._ShowError(`开始失败: ${(Err as Error).message}`);
    }
  }

  /**
   * 通知外部 AppController：联机对局可以开始了
   * 实际 NetworkGameStore 由 AppController 创建并管理。
   * 这里只回传必要的连接信息。
   */
  private _NotifyStarted(): void {
    // 不直接返回，等所有玩家收到 GAME_STARTING
    // LobbyClient 应监听 GAME_STARTING 事件并通知 UI
    // 简化：通过 LobbyEvents 的扩展实现
    // 实际方案：监听 GAME_STARTING 后调用 _OnResult
    this._ShowBusy('等待所有玩家同步...');
  }

  // ===== 网络层初始化 =====

  private async _EnsureClient(): Promise<void> {
    if (this._WsClient && this._WsClient.IsConnected) return;

    this._WsClient = new WebSocketClient(DEFAULT_WS_URL);
    await this._WsClient.Connect();

    // 创建 LobbyClient 并绑定事件
    const Events: LobbyEvents = {
      OnRoomCreated: (_Code, _PlayerId) => { /* 内部已处理 */ },
      OnRoomJoined: (_Code, _PlayerId, Players) => {
        // 完整的玩家列表
        this._Players = Players.map((P) => ({
          PlayerId: P.PlayerId,
          Nickname: P.Nickname,
          IsHost: P.IsHost,
          IsAI: false,
          IsLocal: P.PlayerId === this._LocalPlayerId,
        }));
        this._RefreshWaitingRoom();
      },
      OnPlayerJoined: (PlayerId, Nickname, _Count) => {
        // 避免重复
        if (!this._Players.some((P) => P.PlayerId === PlayerId)) {
          this._Players.push({
            PlayerId,
            Nickname,
            IsHost: false,
            IsAI: false,
            IsLocal: false,
          });
        }
        this._RefreshWaitingRoom();
      },
      OnPlayerLeft: (PlayerId, _Nickname, _Reason, _Count) => {
        this._Players = this._Players.filter((P) => P.PlayerId !== PlayerId);
        this._RefreshWaitingRoom();
      },
      OnPlayerDisconnected: (PlayerId, _Nickname) => {
        const P = this._Players.find((X) => X.PlayerId === PlayerId);
        if (P) P.IsAI = true;
        this._RefreshWaitingRoom();
      },
      OnError: (Code, Message) => {
        this._ShowError(`[${Code}] ${Message}`);
      },
      OnConnectionChange: (_State) => { /* 暂不处理 */ },
    };

    this._Lobby = new LobbyClient(this._WsClient, Events);

    // 监听 GAME_STARTING —— 所有客户端在此触发后进入对局
    this._CleanupFns.push(
      this._WsClient.On('GAME_STARTING', (Payload) => {
        // 房主点开始 → 服务端广播 GAME_STARTING → 所有客户端收到
        // 交回 AppController，由它创建 NetworkGameStore 并进入 _PlayGame
        const PlayerCount = Payload.players.length;
        const Seed = Payload.seed;
        // 构造 NetworkGameStore 并用 payload 初始化本地镜像
        const Store = this._BuildStoreForGame();
        Store.InitFromGameStarting(Payload);
        Store.ListenForRemoteTurns();
        this._OnResult({
          Kind: 'Started',
          Store,
          PlayerCount: PlayerCount as 2 | 3 | 4,
          Seed,
        });
      }),
    );
  }

  /**
   * 构造一个 NetworkGameStore 实例交给 AppController
   * 该 Store 复用当前大厅的 WebSocketClient，避免重建连接
   */
  private _BuildStoreForGame(): NetworkGameStore {
    if (!this._WsClient) {
      throw new Error('WebSocket 未连接');
    }
    // NetworkGameStore 不立即连接；InitFromGameStarting 后才监听远程回合
    const Store = new NetworkGameStore(this._WsClient);
    return Store;
  }

  // ===== UI 辅助 =====

  private _Card(Title: string, Badge: string, Desc: string): HTMLElement {
    if (!this._Content) return this._Content ?? document.body;
    const Card = El({ Tag: 'div', Class: 'mp-card', Parent: this._Content });
    El({
      Tag: 'div',
      Class: 'mp-card-head',
      Parent: Card,
      Html: `<span class="mp-badge">${Badge}</span><span class="mp-card-title font-display">${Title}</span>`,
    });
    El({ Tag: 'div', Class: 'mp-card-desc font-mono', Parent: Card, Text: Desc });
    return Card;
  }

  private _RefreshWaitingRoom(): void {
    if (this._Phase === 'Waiting') {
      this._RenderWaitingRoom();
    }
  }

  private _ShowBusy(Message: string): void {
    if (this._StatusEl) {
      this._StatusEl.textContent = Message;
      this._StatusEl.classList.add('busy');
    }
  }

  private _ShowError(Message: string): void {
    if (this._StatusEl) {
      this._StatusEl.textContent = `⚠ ${Message}`;
      this._StatusEl.classList.add('error');
      this._StatusEl.classList.remove('busy');
      setTimeout(() => {
        if (this._StatusEl) {
          this._StatusEl.classList.remove('error');
        }
      }, 4000);
    }
  }

  private _Escape(S: string): string {
    return S.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private _LeaveRoom(): void {
    this._Lobby?.LeaveRoom();
    this._ReturnToMenu();
  }

  private _ReturnToMenu(): void {
    this._OnResult({ Kind: 'BackToMenu' });
  }

  // ===== 生命周期 =====

  protected _OnUnmount(): void {
    this._CleanupFns.forEach((Fn) => Fn());
    this._CleanupFns = [];
    // 注意：WebSocket 连接由 AppController 在对局结束时统一清理
    // 这里不主动断开，避免影响后续对局的 NetworkGameStore
    this._Content = null;
    this._StatusEl = null;
  }

  /** 暴露底层 WS Client 给 AppController（联机对局后由它接管清理） */
  get WebSocketClient(): WebSocketClient | null {
    return this._WsClient;
  }

  get ConnectionState(): ConnectionState {
    return this._WsClient?.State ?? ConnectionState.Idle;
  }
}
