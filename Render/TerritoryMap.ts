/**
 * src/Render/TerritoryMap.ts
 * 操作类型：新建
 *
 * 持久领土归属地图——解决「领土每回合重排」BUG 的核心模块。
 *
 * 设计动机：
 *  旧实现每帧用 ComputeGrid(快照) 由「私有领土数量」反推 100 格归属，
 *  数量一变就整盘重算 → 已生长的格子被随机重新分配，表现为「一个回合变一次」。
 *
 * 本模块改为「持久归属」模型：
 *  - 一张 Int8Array(100) 记录每格当前归属（玩家 / 公共 / 荒地），跨回合保留。
 *  - 仅当事件真正改变归属时才动对应格子，且严格遵循三条规则（见下）。
 *  - 每帧 Sync(快照) 仅做「最小增删」校正，使地图与权威快照一致，绝不重排。
 *
 * 三条领土变更规则（用户明确指定）：
 *  1. 变成公共领土：从外向内扣除（移除最远离该玩家角落的格）。
 *  2. 变成荒地：随机挑选若干格变荒地（崩坏 / 开发过度）。
 *  3. 被抢夺：被抢的格尽量靠近抢夺者（胜者）的领土。
 *
 * 生长（占领获得）则始终从玩家角落向外一圈圈扩散，契合「真实领土生长」。
 */
import type { TerritorySnapshot } from '@/Types/Territory';
import type { TurnResult } from '@/Types/Turn';
import type { RobberyResult } from '@/Types/Robbery';
import type { CollapseResult } from '@/Types/Collapse';
import { RobberyRole } from '@/Types/Robbery';

/** 格子归属：-1 公共 / -2 荒地 / 0..3 玩家 */
export type GridOwner = number;
export const OWNER_PUBLIC = -1;
export const OWNER_WASTELAND = -2;

export const GRID = 10;
export const CELL_COUNT = GRID * GRID; // 100

/** 各玩家起始角落（格索引）：0=左上 / 1=右上 / 2=左下 / 3=右下 */
export const CORNER_CELLS = [0, GRID - 1, (GRID - 1) * GRID, CELL_COUNT - 1] as const;

// ===== 几何与随机工具 =====

/** 格索引 → [行, 列] */
function CellRC(Cell: number): [number, number] {
  return [Math.floor(Cell / GRID), Cell % GRID];
}

/** 两格曼哈顿距离（用于「外/内」「靠近」判定） */
function Manhattan(A: number, B: number): number {
  const [ar, ac] = CellRC(A);
  const [br, bc] = CellRC(B);
  return Math.abs(ar - br) + Math.abs(ac - bc);
}

/** 确定性随机（mulberry32，零运行时依赖），保证测试可复现 */
function MakeRng(Seed: number): () => number {
  let A = Seed >>> 0;
  return function (): number {
    A |= 0;
    A = (A + 0x6d2b79f5) | 0;
    let T = Math.imul(A ^ (A >>> 15), 1 | A);
    T = (T + Math.imul(T ^ (T >>> 7), 61 | T)) ^ T;
    return ((T ^ (T >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 持久领土归属地图
 */
export class TerritoryMap {
  private _Cells: Int8Array;
  private readonly _Rng: () => number;

  constructor(Seed = 0xc0ffee) {
    this._Cells = new Int8Array(CELL_COUNT).fill(OWNER_PUBLIC);
    this._Rng = MakeRng(Seed);
  }

  /** 重置为全新一局（全部公共，未播种） */
  Reset(): void {
    this._Cells.fill(OWNER_PUBLIC);
  }

  /** 取当前归属（副本，避免外部篡改） */
  GetCells(): GridOwner[] {
    return Array.from(this._Cells);
  }

  /**
   * 每帧/快照变化时调用：保证地图与权威快照一致（最小改动，绝不重排）。
   * 核心已保证 Σ(私有)+公共 ≤ 100（发射从公共池拨地，零和守恒），故各玩家私有
   * 直接等于应显示格数，无需缩放；仅做最小增删：增=从角落向外生长，减=从外向内收回公共。
   * 返回当前归属数组。
   */
  Sync(Snap: TerritorySnapshot): GridOwner[] {
    this._Reconcile(Snap);
    return Array.from(this._Cells);
  }

  /**
   * 一回合结算后调用一次：应用「有味道」的归属变更。
   * 严格按用户指定的三条规则挑选「具体哪些格」变动；
   * 其余（纯占领增减）交给 Sync 的默认最小增删即可。
   *  - 开发过度 → 该玩家全部领土变荒地。
   *  - 抢夺 → 被抢格中最靠近抢夺者（胜者）者归胜者；其余随机回归部分从外向内归公共。
   *  - 崩坏 → 每位受损玩家随机若干格变荒地。
   * 事件 delta 与核心快照单位一致（已守恒），直接按格落实，无需缩放。
   */
  ApplyEvent(Result: TurnResult): void {
    if (Result.IsOverload) {
      this._Overload(Result.PlayerId);
    }
    if (Result.Robbery) {
      this._Robbery(Result.Robbery, Result.PlayerId);
    }
    if (Result.Collapse) {
      this._Collapse(Result.Collapse);
    }
  }

  // ===== 内部：校正 =====

  /**
   * 按快照校正各玩家计数（最小增删，保持已有格子不动）。
   * 采用「先全局释放超额 → 再全局就近认领」两遍法，杜绝后来玩家被先来玩家
   * 抢占格子导致的计数不足（饿死）。由核心守恒可证：释放后公共/荒地池必≥总缺口。
   */
  private _Reconcile(Snap: TerritorySnapshot): void {
    // 第一遍：所有超额玩家把最外层格（从外向内）收回公共，使每人 Have≤Want
    for (const P of Snap.Players) {
      if (P.IsWasteland) continue;
      const Have = this._CountOwned(P.Id);
      if (Have > P.PrivateTerritory) {
        this._ReleaseOutermost(P.Id, Have - P.PrivateTerritory);
      }
    }
    // 第二遍：缺口玩家从全局「公共优先、次之荒地」池中就近（靠自己角落）认领
    for (const P of Snap.Players) {
      if (P.IsWasteland) {
        // 荒地玩家：其名下不应残留玩家格（过载时已转荒地），保底转换
        for (let I = 0; I < CELL_COUNT; I++) {
          if (this._Cells[I] === P.Id) this._Cells[I] = OWNER_WASTELAND;
        }
        continue;
      }
      const Have = this._CountOwned(P.Id);
      if (Have < P.PrivateTerritory) {
        this._ClaimNearest(P.Id, P.PrivateTerritory - Have);
      }
    }
  }

  private _CountOwned(Id: number): number {
    let N = 0;
    for (let I = 0; I < CELL_COUNT; I++) {
      if (this._Cells[I] === Id) N++;
    }
    return N;
  }

  // ===== 内部：四种单元格操作 =====

  /**
   * 为 Owner 认领 n 格：从全局「公共优先、次之荒地」池中，按到 Owner 角落的
   * 曼哈顿距离升序认领最近者。就近保证「从角落向外一圈圈扩散」的紧凑生长，
   * 且因采用全池认领，配合 _Reconcile 的两遍法可保证计数精确（不饿死）。
   */
  private _ClaimNearest(Owner: number, N: number): void {
    if (N <= 0) return;
    const Corner = CORNER_CELLS[Owner];
    const Pub: { Cell: number; D: number }[] = [];
    const Waste: { Cell: number; D: number }[] = [];
    for (let I = 0; I < CELL_COUNT; I++) {
      const O = this._Cells[I];
      if (O === OWNER_PUBLIC) Pub.push({ Cell: I, D: Manhattan(I, Corner) });
      else if (O === OWNER_WASTELAND) Waste.push({ Cell: I, D: Manhattan(I, Corner) });
    }
    Pub.sort((A, B) => A.D - B.D);
    Waste.sort((A, B) => A.D - B.D);
    const Pool = [...Pub, ...Waste]; // 优先公共，不足再动荒地（尽量不抢占他人废墟）
    for (let K = 0; K < N && K < Pool.length; K++) {
      this._Cells[Pool[K].Cell] = Owner;
    }
  }

  /**
   * 移除 Owner 的 n 格（最远离其角落者优先）→ 公共。
   * 即「变成公共领土时，从外到内扣除」。
   */
  private _ReleaseOutermost(Owner: number, N: number): void {
    if (N <= 0) return;
    const Corner = CORNER_CELLS[Owner];
    const Mine: { Cell: number; D: number }[] = [];
    for (let I = 0; I < CELL_COUNT; I++) {
      if (this._Cells[I] === Owner) Mine.push({ Cell: I, D: Manhattan(I, Corner) });
    }
    Mine.sort((A, B) => B.D - A.D); // 最远（最外）优先
    for (let K = 0; K < N && K < Mine.length; K++) {
      this._Cells[Mine[K].Cell] = OWNER_PUBLIC;
    }
  }

  /**
   * 把 Owner 的 n 格随机转为荒地（确定性随机打乱后取前 n）。
   * 即「变成荒地时，是随机的」。
   */
  private _ToWasteland(Owner: number, N: number): void {
    if (N <= 0) return;
    const Mine: number[] = [];
    for (let I = 0; I < CELL_COUNT; I++) {
      if (this._Cells[I] === Owner) Mine.push(I);
    }
    // Fisher-Yates 确定性打乱
    for (let I = Mine.length - 1; I > 0; I--) {
      const J = Math.floor(this._Rng() * (I + 1));
      const T = Mine[I];
      Mine[I] = Mine[J];
      Mine[J] = T;
    }
    for (let K = 0; K < N && K < Mine.length; K++) {
      this._Cells[Mine[K]] = OWNER_WASTELAND;
    }
  }

  /**
   * 抢夺：从 Loser 取 n 格「最靠近 Winner 领土」者，转归 Winner。
   * 即「被抢夺的领土应尽量靠近抢夺者的领土」。
   */
  private _Seize(Loser: number, Winner: number, N: number): void {
    if (N <= 0) return;
    const WinnerCells: number[] = [];
    for (let I = 0; I < CELL_COUNT; I++) {
      if (this._Cells[I] === Winner) WinnerCells.push(I);
    }
    const LoserCells: number[] = [];
    for (let I = 0; I < CELL_COUNT; I++) {
      if (this._Cells[I] === Loser) LoserCells.push(I);
    }
    if (LoserCells.length === 0) return;

    const Scored = LoserCells.map((Cell) => ({
      Cell,
      D: WinnerCells.length > 0
        ? Math.min(...WinnerCells.map((W) => Manhattan(Cell, W)))
        : Manhattan(Cell, CORNER_CELLS[Winner]),
    }));
    Scored.sort((A, B) => A.D - B.D); // 最近优先被抢
    for (let K = 0; K < N && K < Scored.length; K++) {
      this._Cells[Scored[K].Cell] = Winner;
    }
  }

  // ===== 内部：三类事件 =====

  /** 开发过度：该玩家全部领土 → 荒地 */
  private _Overload(PlayerId: number): void {
    for (let I = 0; I < CELL_COUNT; I++) {
      if (this._Cells[I] === PlayerId) this._Cells[I] = OWNER_WASTELAND;
    }
  }

  /** 抢夺结算：被抢格近距归胜者；随机回归部分从外向内归公共 */
  private _Robbery(Rb: RobberyResult, InitiatorId: number): void {
    const DefenderId = Rb.Defender;
    const WinnerId =
      Rb.Winner === RobberyRole.Initiator ? InitiatorId : DefenderId;
    const LoserId =
      Rb.Winner === RobberyRole.Initiator ? DefenderId : InitiatorId;

    const Seize = Rb.Transfer - Rb.RandomReturn; // 归胜者
    const ToPublic = Rb.RandomReturn; // 回归公共

    if (Seize > 0) this._Seize(LoserId, WinnerId, Seize);
    if (ToPublic > 0) this._ReleaseOutermost(LoserId, ToPublic);
  }

  /** 崩坏结算：每位受损玩家随机若干格 → 荒地 */
  private _Collapse(C: CollapseResult): void {
    for (const Loss of C.PlayerLosses) {
      if (Loss.ActualLoss > 0) this._ToWasteland(Loss.Id, Loss.ActualLoss);
    }
  }
}
