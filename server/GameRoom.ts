/**
 * server/GameRoom.ts
 * 操作类型：新建
 *
 * 权威游戏房间——服务端运行权威 GameState，处理玩家操作、验证、广播。
 * 关联：联机架构方案 §3 阶段 4
 *
 * 设计要点：
 * 1. 封装 GameStore，所有游戏逻辑由服务端独占执行（权威模型）
 * 2. 验证消息来源合法性（PlayerId 匹配、Phase 匹配）
 * 3. 广播结果给房间内所有玩家和观战者
 * 4. AI 接管：断线玩家轮到时自动执行 AI 决策
 * 5. 游戏结束后广播 GameOver，房间进入 Finished 状态
 */
import type WebSocket from 'ws';
import type { Room } from './RoomManager';
import type {
  LaunchResult,
  TurnResult,
  TiebreakerRound,
  TerritorySnapshot,
  GameResult,
  PlayerId,
  DiceMode,
  GameConfig,
} from './Types';
import { GameStore, CreateDefaultConfig, GamePhase } from './Types';
import { AIController, type IAIController } from './AIController';
import { SerializeMessage } from './Types';

/** AI 操作延迟（毫秒），给其他玩家看到"AI 在思考"的效果 */
const AI_ACTION_DELAY_MS = 800;

export class GameRoom {
  readonly Room: Room;
  private _Store: GameStore | null = null;
  private readonly _AI: IAIController;

  constructor(Room: Room, AI?: IAIController) {
    this.Room = Room;
    this._AI = AI ?? new AIController();
  }

  // ===== 只读属性 =====

  get Phase(): 'Lobby' | 'Playing' | 'Finished' {
    return this.Room.Phase;
  }

  get Store(): GameStore | null {
    return this._Store;
  }

  get CurrentPlayer(): PlayerId | null {
    return this._Store?.CurrentPlayer ?? null;
  }

  get GamePhase(): GamePhase | null {
    return this._Store?.Phase ?? null;
  }

  // ===== 游戏生命周期 =====

  /**
   * 开始游戏（房主调用）
   *
   * 生成共享种子，创建 GameStore，广播 GAME_STARTING 给全体玩家。
   * 随后检查首位玩家是否 AI，若是则自动执行。
   */
  StartGame(HostPlayerId: PlayerId): { Seed: number; PlayerOrder: PlayerId[]; PlayerCount: number } | { Error: string } {
    if (this.Room.Phase !== 'Lobby') {
      return { Error: 'GAME_ALREADY_STARTED' };
    }
    if (HostPlayerId !== this.Room.HostId) {
      return { Error: 'NOT_HOST' };
    }
    if (this.Room.Players.length < 2) {
      return { Error: 'PLAYER_NOT_READY' };
    }

    const Seed = Math.floor(Math.random() * 2147483647);
    this.Room.Seed = Seed;
    this.Room.Phase = 'Playing';

    const Config: GameConfig = {
      ...CreateDefaultConfig(this.Room.Players.length as 2 | 3 | 4, Seed),
    };

    this._Store = new GameStore(Config);
    this._Store.Start();

    const PlayerOrder = this.Room.Players.map((_, I) => I as PlayerId);

    // 广播 GAME_STARTING
    this.Broadcast({
      type: 'GAME_STARTING',
      payload: {
        seed: Seed,
        playerOrder: PlayerOrder,
        players: this.Room.Players.map((P) => ({
          playerId: P.PlayerId,
          nickname: P.Nickname,
          color: '', // 客户端自行通过 PlayerPalette 映射颜色
        })),
      },
    });

    // 如果首位玩家是 AI，自动开始其回合
    this._ScheduleAIAdvanceIfNeeded();

    return { Seed, PlayerOrder, PlayerCount: this.Room.Players.length };
  }

  // ===== 玩家操作 =====

  /**
   * 处理发射尝试
   */
  HandleAttemptLaunch(PlayerId: PlayerId): LaunchResult | { Error: string } {
    if (!this._Store) return { Error: 'GAME_NOT_STARTED' };
    if (this._Store.Phase !== GamePhase.LaunchPhase) return { Error: 'NOT_YOUR_TURN' };
    if (PlayerId !== this._Store.CurrentPlayer) return { Error: 'NOT_YOUR_TURN' };

    const Result = this._Store.AttemptLaunch();

    // 广播发射结果
    this.Broadcast({
      type: 'LAUNCH_RESULT',
      payload: {
        launchResult: Result,
        currentPlayer: this._Store.CurrentPlayer,
        snapshot: this._Store.Snapshot,
      },
    });

    // 检查终局
    if (this._Store.IsOver && this._Store.Result) {
      this._HandleGameOver(this._Store.Result);
    } else {
      this._ScheduleAIAdvanceIfNeeded();
    }

    return Result;
  }

  /**
   * 处理回合操作
   */
  HandlePlayTurn(PlayerId: PlayerId, Mode: DiceMode): TurnResult | { Error: string } {
    if (!this._Store) return { Error: 'GAME_NOT_STARTED' };
    if (this._Store.Phase !== GamePhase.SelectMode) return { Error: 'NOT_YOUR_TURN' };
    if (PlayerId !== this._Store.CurrentPlayer) return { Error: 'NOT_YOUR_TURN' };
    if (Mode !== 'Steady' && Mode !== 'Aggressive' && Mode !== 'None') {
      return { Error: 'INVALID_DICE_MODE' };
    }

    const Result = this._Store.PlayTurn(Mode);

    // 广播回合结果
    this.Broadcast({
      type: 'TURN_RESULT',
      payload: {
        turnResult: Result,
        snapshot: this._Store.Snapshot,
        currentPlayer: this._Store.CurrentPlayer,
        nextPlayer: this._Store.CurrentPlayer, // CurrentPlayer 已是下一位
      },
    });

    // 检查终局
    if (this._Store.IsOver && this._Store.Result) {
      this._HandleGameOver(this._Store.Result);
    } else {
      this._ScheduleAIAdvanceIfNeeded();
    }

    return Result;
  }

  HandleUseCard(PlayerId: PlayerId, InstanceId: number, TargetPlayerId: PlayerId | null): { success: boolean; cardId: string; cardType: string } | { Error: string } {
    if (!this._Store) return { Error: 'GAME_NOT_STARTED' };
    if (!this._Store.CardEnabled) return { Error: 'SERVER_ERROR' };
    if (PlayerId !== this._Store.CurrentPlayer) return { Error: 'NOT_YOUR_TURN' };

    const Record = this._Store.UseCard(PlayerId, InstanceId, TargetPlayerId);
    if (!Record) return { Error: 'SERVER_ERROR' };

    this.Broadcast({
      type: 'CARD_RESULT',
      payload: {
        playerId: PlayerId,
        cardId: Record.CardId,
        cardType: Record.CardType,
        snapshot: this._Store.Snapshot,
        currentPlayer: this._Store.CurrentPlayer,
      },
    });

    return { success: true, cardId: Record.CardId, cardType: Record.CardType };
  }

  /**
   * 处理加赛操作
   */
  HandleRunTiebreaker(PlayerId: PlayerId): TiebreakerRound | { Error: string } {
    if (!this._Store) return { Error: 'GAME_NOT_STARTED' };
    if (this._Store.Phase !== GamePhase.Tiebreaker) return { Error: 'NOT_YOUR_TURN' };
    // 加赛时 CurrentPlayer 指向需要操作的玩家（加赛参与者之一）
    if (PlayerId !== this._Store.CurrentPlayer) return { Error: 'NOT_YOUR_TURN' };

    const Round = this._Store.RunTiebreaker();

    this.Broadcast({
      type: 'TIEBREAKER_RESULT',
      payload: {
        round: Round,
        snapshot: this._Store.Snapshot,
      },
    });

    if (this._Store.IsOver && this._Store.Result) {
      this._HandleGameOver(this._Store.Result);
    } else {
      this._ScheduleAIAdvanceIfNeeded();
    }

    return Round;
  }

  // ===== 网络事件处理 =====

  /**
   * 玩家断线标记——设为 AI 接管
   * @returns 被标记为 AI 的 PlayerId，若未找到则 null
   */
  MarkPlayerDisconnected(Ws: WebSocket): PlayerId | null {
    const Player = this.Room.Players.find((P) => P.Ws === Ws);
    if (!Player || Player.IsAI) return null;

    Player.IsAI = true;

    // 广播断线通知
    this.Broadcast({
      type: 'PLAYER_DISCONNECTED',
      payload: {
        playerId: Player.PlayerId,
        nickname: Player.Nickname,
        takenOverByAI: true,
      },
    }, Player.Ws); // 不发给掉线玩家本人

    // 如果正好轮到该玩家，自动执行 AI 操作
    this._ScheduleAIAdvanceIfNeeded();

    return Player.PlayerId;
  }

  /**
   * 玩家重连——取消 AI 接管
   * @returns 被恢复的 PlayerId，若未找到则 null
   */
  MarkPlayerReconnected(Ws: WebSocket, NewWs: WebSocket): PlayerId | null {
    const Player = this.Room.Players.find((P) => P.Ws === Ws || P.PlayerId === this._FindPlayerIdByOldWs(Ws));
    if (!Player || !Player.IsAI) return null;

    Player.IsAI = false;
    Player.Ws = NewWs;
    Player.LastHeartbeat = Date.now();

    this.Broadcast({
      type: 'PLAYER_RECONNECTED',
      payload: {
        playerId: Player.PlayerId,
        nickname: Player.Nickname,
      },
    });

    return Player.PlayerId;
  }

  // ===== 广播 =====

  /**
   * 广播消息给房间内所有玩家和观战者
   * @param Message 服务端消息
   * @param ExcludeWs 可选，排除某个 WebSocket（如断线玩家本人）
   */
  Broadcast(Message: Record<string, unknown>, ExcludeWs?: WebSocket): void {
    const Raw = JSON.stringify(Message);

    for (const Player of this.Room.Players) {
      if (Player.Ws === ExcludeWs) continue;
      if (Player.Ws.readyState === Player.Ws.OPEN) {
        try {
          Player.Ws.send(Raw);
        } catch {
          // 发送失败忽略（由心跳机制处理断线）
        }
      }
    }

    // 广播给观战者
    for (const SpecWs of this.Room.Spectators) {
      if (SpecWs.readyState === SpecWs.OPEN) {
        try {
          SpecWs.send(Raw);
        } catch {
          // 忽略
        }
      }
    }
  }

  /**
   * 发送消息给指定玩家
   */
  SendToPlayer(PlayerId: PlayerId, Message: Record<string, unknown>): void {
    const Player = this.Room.Players.find((P) => P.PlayerId === PlayerId);
    if (!Player || Player.Ws.readyState !== Player.Ws.OPEN) return;

    try {
      Player.Ws.send(JSON.stringify(Message));
    } catch {
      // 忽略
    }
  }

  /**
   * 获取当前快照（供观战者加入时使用）
   */
  GetSnapshot(): TerritorySnapshot | null {
    return this._Store?.Snapshot ?? null;
  }

  // ===== 内部方法 =====

  /** 游戏结束处理 */
  private _HandleGameOver(Result: GameResult): void {
    this.Room.Phase = 'Finished';

    const WinnerId = Result.Winners[0]?.Id ?? -1;
    const WinnerNickname = this.Room.Players.find((P) => P.PlayerId === WinnerId)?.Nickname ?? '未知';

    this.Broadcast({
      type: 'GAME_OVER',
      payload: {
        result: Result,
        winnerId: WinnerId,
        winnerNickname: WinnerNickname,
      },
    });
  }

  /**
   * 检查当前玩家是否被 AI 接管，若是则自动推进
   * 会循环执行直到遇到人类玩家或游戏结束
   */
  private _ScheduleAIAdvanceIfNeeded(): void {
    if (!this._Store || this._Store.IsOver) return;

    const CurrentPlayer = this._Store.CurrentPlayer;
    const Player = this.Room.Players[CurrentPlayer];
    if (!Player || !Player.IsAI) return;

    // 延迟执行 AI 操作（给其他玩家看到"AI 思考中"的效果）
    setTimeout(() => {
      this._ExecuteAITurn(CurrentPlayer);
    }, AI_ACTION_DELAY_MS);
  }

  /** 执行 AI 回合 */
  private _ExecuteAITurn(PlayerId: PlayerId): void {
    if (!this._Store || this._Store.IsOver) return;

    const Phase = this._Store.Phase;
    const Player = this.Room.Players[PlayerId];
    if (!Player || !Player.IsAI) return;

    if (Phase === GamePhase.LaunchPhase) {
      if (this._AI.ShouldAttemptLaunch(this._Store as unknown as Parameters<IAIController['ShouldAttemptLaunch']>[0], PlayerId)) {
        this.HandleAttemptLaunch(PlayerId);
      }
    } else if (Phase === GamePhase.SelectMode) {
      const CardDecisions = this._AI.GetCardDecisions(
        this._Store as unknown as Parameters<IAIController['GetCardDecisions']>[0],
        PlayerId,
      );
      for (const D of CardDecisions) {
        this.HandleUseCard(PlayerId, D.InstanceId, D.TargetId);
      }
      const Mode = this._AI.SelectDiceMode(
        this._Store as unknown as Parameters<IAIController['SelectDiceMode']>[0],
        PlayerId,
      );
      this.HandlePlayTurn(PlayerId, Mode);
    } else if (Phase === GamePhase.Tiebreaker) {
      if (this._AI.ShouldRunTiebreaker(
        this._Store as unknown as Parameters<IAIController['ShouldRunTiebreaker']>[0],
        PlayerId,
      )) {
        this.HandleRunTiebreaker(PlayerId);
      }
    }
  }

  /** 通过旧 WS 查找 PlayerId（重连场景） */
  private _FindPlayerIdByOldWs(Ws: WebSocket): PlayerId {
    // 重连时 WS 对象不同，通过遍历查找
    // 实际上 MarkPlayerReconnected 应该由调用方提供 PlayerId
    return -1;
  }
}
