/**
 * server/RoomManager.ts
 * 操作类型：新建
 *
 * 房间管理器——房间的创建、加入、离开、过期清理。
 * 关联：联机架构方案 §3 阶段 3
 *
 * 设计要点：
 * 1. 纯内存 Map 存储，服务端重启全丢
 * 2. 4 位数字房间码（0000~9999），碰撞时重新生成
 * 3. 房间生命周期：空闲 → 等待中 → 游戏中 → 结束（自动清理）
 * 4. 30 分钟无活动自动销毁房间
 * 5. 每个房间最多 4 名玩家 + 不限观战者
 */
import type WebSocket from 'ws';

/** 单个玩家的连接信息 */
export interface PlayerConnection {
  /** WebSocket 连接 */
  Ws: WebSocket;
  /** 玩家 ID（0..3，在房间内唯一） */
  PlayerId: number;
  /** 昵称 */
  Nickname: string;
  /** 是否为房主 */
  IsHost: boolean;
  /** 是否被 AI 接管（断线后） */
  IsAI: boolean;
  /** 最后心跳时间戳 */
  LastHeartbeat: number;
}

/** 房间阶段 */
export type RoomPhase = 'Lobby' | 'Playing' | 'Finished';

/** 房间 */
export interface Room {
  /** 房间码（4 位数字字符串） */
  Code: string;
  /** 当前阶段 */
  Phase: RoomPhase;
  /** 房主 PlayerId */
  HostId: number;
  /** 玩家列表（按加入顺序，PlayerId 即索引顺序 0..N-1） */
  Players: PlayerConnection[];
  /** 观战者连接列表 */
  Spectators: WebSocket[];
  /** 创建时间戳 */
  CreatedAt: number;
  /** 最后活动时间戳 */
  LastActivity: number;
  /** 游戏种子（游戏开始时生成） */
  Seed: number;
  /** 最大玩家数（2/3/4，由房主在创建时指定） */
  MaxPlayers: number;
}

/** 加入房间的结果 */
export type JoinResult =
  | { Success: true; PlayerId: number; RoomCode: string; Players: Array<{ PlayerId: number; Nickname: string; IsHost: boolean }> }
  | { Success: false; Error: string };

/** 房间过期时间（30 分钟无活动自动销毁，单位 ms） */
const ROOM_EXPIRE_MS = 30 * 60 * 1000;

/** 清理检查间隔（5 分钟） */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

export class RoomManager {
  private readonly _Rooms: Map<string, Room> = new Map();
  private readonly _PlayerRoomMap: Map<WebSocket, string> = new Map();
  private _CleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this._StartCleanup();
  }

  // ===== 房间操作 =====

  /**
   * 创建房间
   * @param HostWs 房主 WebSocket
   * @param HostNickname 房主昵称
   * @param MaxPlayers 最大玩家数（默认 4）
   * @returns 房间码和房主 PlayerId
   */
  CreateRoom(HostWs: WebSocket, HostNickname: string, MaxPlayers = 4): { RoomCode: string; PlayerId: number } {
    const RoomCode = this._GenerateRoomCode();
    const Now = Date.now();

    const PlayerConn: PlayerConnection = {
      Ws: HostWs,
      PlayerId: 0,
      Nickname: HostNickname,
      IsHost: true,
      IsAI: false,
      LastHeartbeat: Now,
    };

    const Room: Room = {
      Code: RoomCode,
      Phase: 'Lobby',
      HostId: 0,
      Players: [PlayerConn],
      Spectators: [],
      CreatedAt: Now,
      LastActivity: Now,
      Seed: 0,
      MaxPlayers,
    };

    this._Rooms.set(RoomCode, Room);
    this._PlayerRoomMap.set(HostWs, RoomCode);

    return { RoomCode, PlayerId: 0 };
  }

  /**
   * 加入房间
   * @param RoomCode 房间码
   * @param Ws 玩家 WebSocket
   * @param Nickname 昵称
   * @returns 加入结果
   */
  JoinRoom(RoomCode: string, Ws: WebSocket, Nickname: string): JoinResult {
    const Room = this._Rooms.get(RoomCode);

    // 验证房间
    if (!Room) {
      return { Success: false, Error: 'ROOM_NOT_FOUND' };
    }
    if (Room.Phase !== 'Lobby') {
      return { Success: false, Error: 'GAME_IN_PROGRESS' };
    }
    if (Room.Players.length >= Room.MaxPlayers) {
      return { Success: false, Error: 'ROOM_FULL' };
    }

    // 验证昵称唯一性
    if (Room.Players.some((P) => P.Nickname === Nickname)) {
      return { Success: false, Error: 'NICKNAME_TAKEN' };
    }

    const Now = Date.now();
    const PlayerId = Room.Players.length;

    const PlayerConn: PlayerConnection = {
      Ws,
      PlayerId,
      Nickname,
      IsHost: false,
      IsAI: false,
      LastHeartbeat: Now,
    };

    Room.Players.push(PlayerConn);
    Room.LastActivity = Now;
    this._PlayerRoomMap.set(Ws, RoomCode);

    return {
      Success: true,
      PlayerId,
      RoomCode,
      Players: Room.Players.map((P) => ({
        PlayerId: P.PlayerId,
        Nickname: P.Nickname,
        IsHost: P.IsHost,
      })),
    };
  }

  /**
   * 离开房间
   * @param Ws 玩家 WebSocket
   * @returns 离开的玩家信息和房间（若存在），否则 null
   */
  LeaveRoom(Ws: WebSocket): { Room: Room; PlayerId: number; Nickname: string; WasHost: boolean } | null {
    const RoomCode = this._PlayerRoomMap.get(Ws);
    if (!RoomCode) return null;

    const Room = this._Rooms.get(RoomCode);
    if (!Room) {
      this._PlayerRoomMap.delete(Ws);
      return null;
    }

    const PlayerIndex = Room.Players.findIndex((P) => P.Ws === Ws);
    if (PlayerIndex === -1) {
      // 可能是观战者
      const SpecIndex = Room.Spectators.indexOf(Ws);
      if (SpecIndex !== -1) {
        Room.Spectators.splice(SpecIndex, 1);
      }
      this._PlayerRoomMap.delete(Ws);
      return null;
    }

    const Player = Room.Players[PlayerIndex];
    const WasHost = Player.IsHost;

    Room.Players.splice(PlayerIndex, 1);
    Room.LastActivity = Date.now();
    this._PlayerRoomMap.delete(Ws);

    // 重新分配 PlayerId（保持 0..N-1 连续）
    for (let I = 0; I < Room.Players.length; I++) {
      Room.Players[I].PlayerId = I;
    }

    // 房主转移
    if (WasHost && Room.Players.length > 0) {
      Room.Players[0].IsHost = true;
      Room.HostId = 0;
    }

    // 空房间清理
    if (Room.Players.length === 0) {
      this._Rooms.delete(RoomCode);
    }

    return { Room, PlayerId: Player.PlayerId, Nickname: Player.Nickname, WasHost };
  }

  /**
   * 获取玩家所在的房间
   */
  GetRoomByWs(Ws: WebSocket): { Room: Room; PlayerId: number } | null {
    const RoomCode = this._PlayerRoomMap.get(Ws);
    if (!RoomCode) return null;

    const Room = this._Rooms.get(RoomCode);
    if (!Room) return null;

    const Player = Room.Players.find((P) => P.Ws === Ws);
    if (!Player) {
      // 可能是观战者
      if (Room.Spectators.includes(Ws)) {
        return { Room, PlayerId: -1 }; // -1 表示观战者
      }
      return null;
    }

    return { Room, PlayerId: Player.PlayerId };
  }

  /**
   * 通过房间码和 PlayerId 获取房间
   */
  GetRoom(RoomCode: string): Room | undefined {
    return this._Rooms.get(RoomCode);
  }

  /**
   * 更新玩家心跳
   */
  UpdateHeartbeat(Ws: WebSocket): void {
    const Info = this.GetRoomByWs(Ws);
    if (Info && Info.PlayerId >= 0) {
      const Player = Info.Room.Players.find((P) => P.Ws === Ws);
      if (Player) {
        Player.LastHeartbeat = Date.now();
      }
    }
  }

  /**
   * 添加观战者到房间
   */
  AddSpectator(RoomCode: string, Ws: WebSocket): boolean {
    const Room = this._Rooms.get(RoomCode);
    if (!Room) return false;
    if (Room.Phase !== 'Playing') return false;

    Room.Spectators.push(Ws);
    this._PlayerRoomMap.set(Ws, RoomCode);
    return true;
  }

  /**
   * 获取所有 Playing 阶段的房间列表（供大厅展示观战入口）
   */
  GetPlayingRooms(): Array<{ roomCode: string; phase: string; playerCount: number; maxPlayers: number; hostNickname: string; spectatorCount: number }> {
    const Result: Array<{ roomCode: string; phase: string; playerCount: number; maxPlayers: number; hostNickname: string; spectatorCount: number }> = [];
    for (const [Code, Room] of this._Rooms) {
      if (Room.Phase === 'Playing') {
        const Host = Room.Players.find((P) => P.IsHost);
        Result.push({
          roomCode: Code,
          phase: Room.Phase,
          playerCount: Room.Players.length,
          maxPlayers: Room.MaxPlayers,
          hostNickname: Host?.Nickname ?? '未知',
          spectatorCount: Room.Spectators.length,
        });
      }
    }
    return Result;
  }

  /**
   * 销毁房间管理器（停止清理定时器）
   */
  Dispose(): void {
    if (this._CleanupTimer !== null) {
      clearInterval(this._CleanupTimer);
      this._CleanupTimer = null;
    }
  }

  // ===== 内部方法 =====

  /** 生成唯一的 4 位房间码 */
  private _GenerateRoomCode(): string {
    let Attempts = 0;
    const MaxAttempts = 100;

    while (Attempts < MaxAttempts) {
      const Code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      if (!this._Rooms.has(Code)) {
        return Code;
      }
      Attempts += 1;
    }

    // 极端情况：4 位全部碰撞，升级到 5 位（防御性，<10 并发几乎不会触发）
    while (true) {
      const Code = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
      if (!this._Rooms.has(Code)) {
        return Code;
      }
    }
  }

  /** 启动定期清理 */
  private _StartCleanup(): void {
    this._CleanupTimer = setInterval(() => {
      this._CleanupExpiredRooms();
    }, CLEANUP_INTERVAL_MS);
  }

  /** 清理过期房间 */
  private _CleanupExpiredRooms(): void {
    const Now = Date.now();
    for (const [Code, Room] of this._Rooms) {
      if (Now - Room.LastActivity > ROOM_EXPIRE_MS) {
        // 通知所有玩家房间已过期
        for (const Player of Room.Players) {
          try {
            Player.Ws.send(JSON.stringify({
              type: 'ERROR',
              payload: { code: 'SERVER_ERROR', message: '房间已过期' },
            }));
            Player.Ws.close();
          } catch {
            // 忽略发送/关闭失败
          }
        }
        // 删除房间映射
        for (const Player of Room.Players) {
          this._PlayerRoomMap.delete(Player.Ws);
        }
        for (const Spec of Room.Spectators) {
          this._PlayerRoomMap.delete(Spec);
        }
        this._Rooms.delete(Code);
      }
    }
  }
}
