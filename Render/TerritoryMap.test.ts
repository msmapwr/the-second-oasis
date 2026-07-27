/**
 * src/Render/TerritoryMap.test.ts
 * 操作类型：新建
 *
 * 覆盖 TerritoryMap（持久领土归属地图）的核心不变量与三条变更规则：
 *  - 播种/稳定：同快照重复 Sync 不重排，已生长格子除非事件否则不动。
 *  - 生长：从角落向外一圈圈扩散；增长时旧格保留。
 *  - 公共扣除：从外向内（移除最远离角落者）。
 *  - 荒地：随机若干格变荒地（确定性可复现）。
 *  - 抢夺：被抢格尽量靠近抢夺者（胜者）领土；随机回归部分从外向内归公共。
 *  - 集成：真实 GameState 跑若干回合，每回合 ApplyEvent+Sync 后地图计数与快照一致。
 */
import { describe, it, expect } from 'vitest';
import {
  TerritoryMap,
  OWNER_PUBLIC,
  OWNER_WASTELAND,
  GRID,
  CELL_COUNT,
  CORNER_CELLS,
} from './TerritoryMap';
import type { TerritorySnapshot } from '@/Types/Territory';
import type { PlayerSnapshot } from '@/Types/Player';
import type { TurnResult } from '@/Types/Turn';
import { RobberyRole } from '@/Types/Robbery';
import { GameState } from '@/Core/GameState';
import { CreateDefaultConfig } from '@/Types/GameConfig';
import { GamePhase } from '@/Types/GamePhase';
import { DiceMode } from '@/Types/Dice';

// ===== 测试辅助 =====

function MakePlayer(Id: number, PrivateTerritory: number, IsWasteland = false): PlayerSnapshot {
  return {
    Id,
    PrivateTerritory,
    ConsecutiveDoubles: 0,
    Status: 'Active' as never,
    IsLaunched: true,
    IsWasteland,
    RevengeToken: false,
  };
}

function MakeSnap(PublicTerritory: number, Players: PlayerSnapshot[]): TerritorySnapshot {
  return { PublicTerritory, Players };
}

function Manhattan(Cell: number, Corner: number): number {
  const ar = Math.floor(Cell / GRID);
  const ac = Cell % GRID;
  const br = Math.floor(Corner / GRID);
  const bc = Corner % GRID;
  return Math.abs(ar - br) + Math.abs(ac - bc);
}

function CountOwner(G: number[], Id: number): number {
  let N = 0;
  for (const C of G) if (C === Id) N++;
  return N;
}

function CellsOf(G: number[], Id: number): number[] {
  const Out: number[] = [];
  for (let I = 0; I < G.length; I++) if (G[I] === Id) Out.push(I);
  return Out;
}

// ===== 播种 / 稳定 =====

describe('TerritoryMap - 播种与稳定', () => {
  it('初始全 0 → 全部公共（100 格）', () => {
    const M = new TerritoryMap();
    const G = M.Sync(MakeSnap(100, [MakePlayer(0, 0), MakePlayer(1, 0)]));
    expect(CountOwner(G, OWNER_PUBLIC)).toBe(100);
    expect(CountOwner(G, 0)).toBe(0);
    expect(CountOwner(G, 1)).toBe(0);
  });

  it('同快照重复 Sync 不重排（已生长格子保持不动）', () => {
    const M = new TerritoryMap(42);
    const Snap = MakeSnap(90, [MakePlayer(0, 10), MakePlayer(1, 0)]);
    const A = M.Sync(Snap);
    const B = M.Sync(Snap);
    const C = M.Sync(Snap);
    expect(B).toEqual(A);
    expect(C).toEqual(A);
    // 玩家 0 的 10 格固定在角落 0 附近
    expect(CountOwner(A, 0)).toBe(10);
  });

  it('不变量：Σ(各玩家) + 公共 + 荒地 = 100', () => {
    const M = new TerritoryMap(7);
    const Snap = MakeSnap(60, [MakePlayer(0, 13), MakePlayer(1, 9), MakePlayer(2, 8), MakePlayer(3, 10)]);
    const G = M.Sync(Snap);
    let Sum = 0;
    for (let I = 0; I < CELL_COUNT; I++) {
      if (G[I] >= 0) Sum++; // 玩家
      else if (G[I] === OWNER_PUBLIC) Sum++;
      else if (G[I] === OWNER_WASTELAND) Sum++;
    }
    expect(Sum).toBe(CELL_COUNT);
  });
});

// ===== 生长：向外扩散 + 旧格保留 =====

describe('TerritoryMap - 生长向外扩散', () => {
  it('增长时旧格保留，新增格向外（靠近角落）', () => {
    const M = new TerritoryMap(99);
    const Before = M.Sync(MakeSnap(95, [MakePlayer(0, 4)]));
    const Old = CellsOf(Before, 0);
    expect(Old.length).toBe(4);

    const After = M.Sync(MakeSnap(92, [MakePlayer(0, 7)]));
    const New = CellsOf(After, 0);
    expect(New.length).toBe(7);
    // 旧 4 格全部保留
    for (const C of Old) expect(New).toContain(C);
  });

  it('四角落各自从自己角落生长，互不串格', () => {
    const M = new TerritoryMap(1);
    const Snap = MakeSnap(60, [
      MakePlayer(0, 10),
      MakePlayer(1, 10),
      MakePlayer(2, 10),
      MakePlayer(3, 10),
    ]);
    const G = M.Sync(Snap);
    for (let P = 0; P < 4; P++) {
      const Cells = CellsOf(G, P);
      expect(Cells.length).toBe(10);
      // 该玩家所有格都更靠近自己的角落（而非其他角落）
      const MyCorner = CORNER_CELLS[P];
      for (const C of Cells) {
        const DMe = Manhattan(C, MyCorner);
        let CloserToOther = false;
        for (let Q = 0; Q < 4; Q++) {
          if (Q === P) continue;
          if (Manhattan(C, CORNER_CELLS[Q]) < DMe) CloserToOther = true;
        }
        expect(CloserToOther).toBe(false);
      }
    }
  });
});

// ===== 公共扣除：从外向内 =====

describe('TerritoryMap - 公共扣除从外向内', () => {
  it('减少时移除最远离角落的格（外→内）', () => {
    const M = new TerritoryMap(5);
    const Before = M.Sync(MakeSnap(85, [MakePlayer(0, 12)]));
    const Old = CellsOf(Before, 0);
    // 取距离角落最远的「恰好 3 格」（玩家 12→9，移除 3）
    const Order = Old
      .map((C) => ({ C, D: Manhattan(C, CORNER_CELLS[0]) }))
      .sort((A, B) => B.D - A.D); // 远→近
    const ToRemove = Order.slice(0, 3).map((X) => X.C);

    const After = M.Sync(MakeSnap(88, [MakePlayer(0, 9)]));
    const Remaining = CellsOf(After, 0);
    expect(Remaining.length).toBe(9);
    // 被移除的恰好是原本最外层的 3 格
    for (const C of ToRemove) expect(Remaining).not.toContain(C);
    // 剩余 9 格都应是原本较内层的（未被移除者）
    for (const C of Remaining) expect(Old).toContain(C);
  });
});

// ===== 荒地：随机若干格 =====

describe('TerritoryMap - 荒地随机', () => {
  it('开发过度：该玩家全部领土变荒地', () => {
    const M = new TerritoryMap(3);
    M.Sync(MakeSnap(85, [MakePlayer(0, 10)]));
    const Overload: TurnResult = {
      PlayerId: 0,
      Mode: DiceMode.Steady,
      Dice: null,
      DevOutcome: null,
      OccupationDelta: null,
      Robbery: null,
      Collapse: null,
      IsOverload: true,
      NeedsRelaunchNext: true,
      RoundIndex: 0,
      FirstPlayerIndex: 0,
      LeaderTax: null,
      SprintBonus: 0,
      Revenge: null,
    };
    M.ApplyEvent(Overload);
    const G = M.Sync(MakeSnap(85, [MakePlayer(0, 0, true)]));
    expect(CountOwner(G, 0)).toBe(0);
    expect(G.filter((C) => C === OWNER_WASTELAND).length).toBe(10);
  });

  it('崩坏：每位受损玩家随机若干格变荒地（确定性可复现）', () => {
    const MakeCollapse = (): TurnResult => ({
      PlayerId: 0,
      Mode: DiceMode.Aggressive,
      Dice: null,
      DevOutcome: null,
      OccupationDelta: null,
      Robbery: null,
      Collapse: {
        CoefficientX: 2,
        TotalLoss: 5,
        IsConserved: true,
        PlayerLosses: [
          { Id: 0, RandomLoss: 3, ActualLoss: 3, BeforePrivate: 10, AfterPrivate: 7 },
          { Id: 1, RandomLoss: 2, ActualLoss: 2, BeforePrivate: 10, AfterPrivate: 8 },
        ],
        InitiatorId: 0,
        PublicDelta: -2,
        NextX: 3,
      },
      IsOverload: false,
      NeedsRelaunchNext: false,
      RoundIndex: 0,
      FirstPlayerIndex: 0,
      LeaderTax: null,
      SprintBonus: 0,
      Revenge: null,
    });

    const A = new TerritoryMap(123);
    A.Sync(MakeSnap(80, [MakePlayer(0, 10), MakePlayer(1, 10)]));
    A.ApplyEvent(MakeCollapse());

    const B = new TerritoryMap(123);
    B.Sync(MakeSnap(80, [MakePlayer(0, 10), MakePlayer(1, 10)]));
    B.ApplyEvent(MakeCollapse());

    // 确定性：同种子同序列 → 相同荒地格
    expect(A.GetCells()).toEqual(B.GetCells());
    // 玩家 0/1 各减少 3/2 格（转荒地），总数守恒
    const GA = A.GetCells();
    expect(CountOwner(GA, 0)).toBe(7);
    expect(CountOwner(GA, 1)).toBe(8);
    expect(GA.filter((C) => C === OWNER_WASTELAND).length).toBe(5);
  });
});

// ===== 抢夺：被抢格靠近抢夺者 =====

describe('TerritoryMap - 抢夺近距归胜者', () => {
  it('胜者抢得的格是败者中最靠近胜者领土者', () => {
    const M = new TerritoryMap(77);
    // 玩家 0（左上）与玩家 1（右上）各 6 格
    M.Sync(MakeSnap(88, [MakePlayer(0, 6), MakePlayer(1, 6)]));
    const Before = M.GetCells();
    const P0 = CellsOf(Before, 0);
    const P1 = CellsOf(Before, 1);

    // 预期：败者(玩家1)中，到玩家0领土最小距离者最优先被抢
    const Scored = P1.map((Cell) => ({
      Cell,
      D: Math.min(...P0.map((W) => Manhattan(Cell, W))),
    })).sort((A, B) => A.D - B.D);
    const ExpectedSeized = Scored.slice(0, 2).map((S) => S.Cell);
    // 回归公共的 1 格是「被抢后剩余的玩家1格」中最外层者（从外向内）
    const RemainingP1 = P1.filter((C) => !ExpectedSeized.includes(C));
    const ExpectedPublic = RemainingP1
      .slice()
      .sort((A, B) => Manhattan(B, CORNER_CELLS[1]) - Manhattan(A, CORNER_CELLS[1]))
      .slice(0, 1);

    const Robbery: TurnResult = {
      PlayerId: 0,
      Mode: DiceMode.Aggressive,
      Dice: null,
      DevOutcome: null,
      OccupationDelta: null,
      Robbery: {
        OverflowM2: 5,
        Defender: 1,
        RollHistory: [{ InitiatorRoll: 6, DefenderRoll: 1, IsTie: false }],
        Winner: RobberyRole.Initiator,
        RandomReturn: 1,
        Transfer: 3,
        InitiatorDelta: 2,
        DefenderDelta: -3,
        PublicDelta: 1,
      },
      Collapse: null,
      IsOverload: false,
      NeedsRelaunchNext: false,
      RoundIndex: 0,
      FirstPlayerIndex: 0,
      LeaderTax: null,
      SprintBonus: 0,
      Revenge: null,
    };
    M.ApplyEvent(Robbery);
    const After = M.GetCells();

    // 玩家 0 净增 2（抢得），玩家 1 净减 3
    expect(CountOwner(After, 0)).toBe(8);
    expect(CountOwner(After, 1)).toBe(3);
    // 抢得的 2 格恰好是最靠近玩家 0 的败者格
    for (const C of ExpectedSeized) expect(After[C]).toBe(0);
    // 回归公共的 1 格是败者最外层
    for (const C of ExpectedPublic) expect(After[C]).toBe(OWNER_PUBLIC);
  });
});

// ===== 集成：真实对局一致性 =====

describe('TerritoryMap - 真实对局集成', () => {
  it('跑若干回合，ApplyEvent+Sync 后地图计数始终与快照一致', () => {
    const M = new TerritoryMap(2024);
    const Store = new GameState(CreateDefaultConfig(4, 2024));
    Store.Start();

    const Modes = [DiceMode.Steady, DiceMode.Aggressive, DiceMode.None, DiceMode.Steady];
    let Turn = 0;
    let Guard = 0;
    // 发射阶段 per-player：成功玩家立即进入 SelectMode 正常回合，失败/未发射玩家继续 LaunchPhase
    while (!Store.IsOver && Guard++ < 800) {
      if (Store.Phase === GamePhase.LaunchPhase) {
        Store.AttemptLaunch();
        M.Sync(Store.Snapshot);
        continue;
      }
      if (Store.Phase !== GamePhase.SelectMode) break;

      const Mode = Modes[Turn % Modes.length];
      const Result = Store.PlayTurn(Mode);
      M.ApplyEvent(Result);
      M.Sync(Store.Snapshot);

      // 不变量校验：核心守恒 ⇒ 各玩家地图格数 == 快照私有领土
      const Snap = Store.Snapshot;
      for (const P of Snap.Players) {
        const Owned = CountOwner(M.GetCells(), P.Id);
        if (P.IsWasteland) {
          expect(Owned).toBe(0); // 荒地玩家名下不应有玩家格
        } else {
          expect(Owned).toBe(P.PrivateTerritory); // 计数的强一致
        }
      }
      // 地图始终是 100 格（领地模型的硬不变量）
      expect(M.GetCells().length).toBe(CELL_COUNT);
      Turn++;
    }
    expect(Turn).toBeGreaterThan(1); // 确实跑了多个回合
  });
});
