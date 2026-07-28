/**
 * src/Render/OasisBoardRenderer.ts
 * 操作类型：修改
 *
 * 月球作战沙盘渲染器（A 方案核心）：在 board 层 Canvas 绘制 10×10 领土格看板。
 *
 * 本轮改动（修复「领土每回合重排」BUG）：
 *  - 移除每帧由数量反推整盘归属的 ComputeGrid（数量一变就整盘重算→格子乱跳）。
 *  - 改为持有持久 TerritoryMap：每帧 Sync 仅做最小增删校正，格子「除非事件改变否则不动」。
 *  - 冻结门控：状态推进前冻结看板（拷贝归属网格），骰子动画播完后再解冻，
 *    领土结果才随过渡生长显现，避免与动画同时出现。
 *  - 角落生长 + 三条变更规则（公共外内收 / 荒地随机 / 抢夺近距）全部下沉到 TerritoryMap。
 *
 * 设计要点：
 *  - 看板过渡：格子颜色 lerp + 归属变化脉冲高亮，营造「生长」动效。
 *  - 冻结态：棋盘保持上一回合静态绘制，不重算、不过渡，解耦动画与结果。
 */
import { RenderContext } from './RenderContext';
import { CanvasPalette, type CanvasPalette as CanvasPaletteType } from '@/UI/CanvasTheme';
import { PRIMARY_FONT } from '@/Config/UiConstants';
import type { IGameStore } from '@/Store/GameStore';
import type { TurnResult } from '@/Types/Turn';
import { PlayerPalette } from '@/Store/PlayerPalette';
import {
  TerritoryMap,
  GridOwner,
  OWNER_PUBLIC,
  OWNER_WASTELAND,
  GRID,
  CELL_COUNT,
} from './TerritoryMap';

interface BoardCell {
  Owner: GridOwner;
  /** 当前显示 RGB（用于过渡） */
  R: number;
  G: number;
  B: number;
  /** 目标 RGB */
  Tr: number;
  Tg: number;
  Tb: number;
  /** 变化脉冲剩余 ms（>0 时格子提亮） */
  Pulse: number;
}

const PULSE_MS = 700;

/** 骰子点数结果展示（在对应玩家角落短暂浮现） */
interface DiceResultMark {
  PlayerId: number;
  Values: number[];
  Color: string;
  Until: number;
  Duration: number;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function HexToRgb(Hex: string): Rgb {
  const H = Hex.replace('#', '');
  const Full = H.length === 3 ? H.split('').map((C) => C + C).join('') : H;
  const N = parseInt(Full, 16);
  return { r: (N >> 16) & 255, g: (N >> 8) & 255, b: N & 255 };
}

function OwnerRgb(Owner: GridOwner): Rgb {
  const P = CanvasPalette();
  if (Owner === OWNER_PUBLIC) return HexToRgb(P.BoardPublic);
  if (Owner === OWNER_WASTELAND) return HexToRgb(P.BoardWasteland);
  // 玩家格颜色使用 PlayerPalette 的自定义主题色，支持开局前自定义名字/颜色
  return HexToRgb(PlayerPalette.Color(Owner) ?? P.BoardPublic);
}

/**
 * 月球看板渲染器
 */
export class OasisBoardRenderer {
  private readonly _Ctx: RenderContext;
  private _Store: IGameStore | null = null;
  private _Cells: BoardCell[] = [];

  /** 持久领土归属地图（本模块的唯一数据来源） */
  private readonly _Map: TerritoryMap;

  // 冻结门控（任务2）：动画期间保持上一回合快照
  private _Frozen = false;
  private _FrozenGrid: GridOwner[] = [];
  private _FrozenCurrent = 0;
  private _FrozenPublic = 0;

  // 骰子点数结果标记（在对应玩家角落浮现）
  private _Results: DiceResultMark[] = [];

  constructor(Ctx: RenderContext) {
    this._Ctx = Ctx;
    this._Map = new TerritoryMap();
    this._InitCells();
  }

  /**
   * 设置数据源（菜单/终局时传 null 停画并重置地图）
   */
  SetSource(Store: IGameStore | null): void {
    this._Store = Store;
    this._Map.Reset(); // 新一局：清空归属，首次 Sync 会重新播种
    this._Frozen = false;
    this._FrozenGrid = [];
    this._Results = [];
    this._InitCells();
  }

  /**
   * 冻结看板：动画播放前调用，保持当前（上一回合）棋盘不动。
   * 必须在状态推进（PlayTurn 等）之前调用。
   */
  Freeze(): void {
    if (!this._Store) return;
    this._FrozenGrid = this._Map.GetCells();
    this._FrozenCurrent = this._Store.CurrentPlayer;
    this._FrozenPublic = this._Store.Snapshot.PublicTerritory;
    this._Frozen = true;
  }

  /**
   * 解冻看板：骰子动画完整结束后调用，领土结果随即随过渡生长显现。
   */
  Unfreeze(): void {
    if (!this._Frozen) return;
    this._Frozen = false;
    this._FrozenGrid = [];
  }

  /**
   * 应用一回合的「有味道」归属变更（开发过度/抢夺/崩坏）。
   * 须在骰子动画结束后、Unfreeze 之后调用，使结果在地图上显现。
   */
  ApplyEvent(Result: TurnResult): void {
    this._Map.ApplyEvent(Result);
  }

  /**
   * 在对应玩家角落短暂展示骰子点数结果（动画结束后调用，不与动画同时出现）
   */
  ShowDiceResult(PlayerId: number, Values: number[], Color: string, DurationMs = 1500): void {
    if (!Values || Values.length === 0) return;
    this._Results.push({
      PlayerId,
      Values: Values.slice(),
      Color,
      Until: performance.now() + DurationMs,
      Duration: DurationMs,
    });
    if (this._Results.length > 8) {
      this._Results.splice(0, this._Results.length - 8);
    }
  }

  private _InitCells(): void {
    const Init = OwnerRgb(OWNER_PUBLIC);
    this._Cells = [];
    for (let I = 0; I < CELL_COUNT; I++) {
      this._Cells.push({
        Owner: OWNER_PUBLIC,
        R: Init.r,
        G: Init.g,
        B: Init.b,
        Tr: Init.r,
        Tg: Init.g,
        Tb: Init.b,
        Pulse: 0,
      });
    }
  }

  /**
   * 每帧绘制（由 LayeredCanvas board 层驱动）
   */
  Render(_Ts: number, Dt: number): void {
    const Ctx = this._Ctx;
    Ctx.Clear();
    const Store = this._Store;
    if (!Store) return;

    // 冻结态：仅静态绘制上一回合归属，不重算、不过渡
    if (this._Frozen) {
      this._Draw(this._FrozenGrid, this._FrozenCurrent, this._FrozenPublic);
      return;
    }

    const Snap = Store.Snapshot;
    const Owners = this._Map.Sync(Snap);
    const Current = Store.CurrentPlayer;

    // 更新目标色 + 检测归属变化触发脉冲
    // 每帧重算目标色：主题切换时格子平滑过渡到新主题配色
    for (let I = 0; I < CELL_COUNT; I++) {
      const Cell = this._Cells[I];
      if (Cell.Owner !== Owners[I]) {
        Cell.Owner = Owners[I];
        if (Cell.Pulse <= 0) Cell.Pulse = PULSE_MS;
      }
      const Rgb = OwnerRgb(Owners[I]);
      Cell.Tr = Rgb.r;
      Cell.Tg = Rgb.g;
      Cell.Tb = Rgb.b;
    }

    // 颜色过渡
    const K = Math.min(1, Dt * 0.012);
    for (const Cell of this._Cells) {
      Cell.R += (Cell.Tr - Cell.R) * K;
      Cell.G += (Cell.Tg - Cell.G) * K;
      Cell.B += (Cell.Tb - Cell.B) * K;
      if (Cell.Pulse > 0) Cell.Pulse = Math.max(0, Cell.Pulse - Dt);
    }

    this._Draw(Owners, Current, Snap.PublicTerritory);
  }

  private _Draw(Owners: GridOwner[], Current: number, PublicTerritory: number): void {
    const Ctx = this._Ctx;
    const W = Ctx.Width;
    const H = Ctx.Height;
    const Size = Math.min(W, H) * 0.84;
    const Bx = (W - Size) / 2;
    const By = (H - Size) / 2;
    const P = CanvasPalette();

    // 外框支架（飞船看板框）
    this._DrawFrame(Bx, By, Size, P);

    // 网格
    const M = Size * 0.07;
    const GridW = Size - M * 2;
    const CellPx = GridW / GRID;
    const Gap = Math.max(1, CellPx * 0.1);
    const Cs = CellPx - Gap;

    const C2d = Ctx.Ctx;
    for (let I = 0; I < CELL_COUNT; I++) {
      const Col = I % GRID;
      const Row = Math.floor(I / GRID);
      const X = Bx + M + Col * CellPx + Gap / 2;
      const Y = By + M + Row * CellPx + Gap / 2;
      const Data = this._Cells[I];
      // 脉冲提亮
      const Pulse = Data.Pulse / PULSE_MS;
      const Br = 1 + Pulse * 0.7;
      const R = Math.min(255, (Data.R * Br) | 0);
      const G = Math.min(255, (Data.G * Br) | 0);
      const B = Math.min(255, (Data.B * Br) | 0);
      C2d.fillStyle = `rgb(${R},${G},${B})`;
      C2d.fillRect(X, Y, Cs, Cs);
      // 暗描边（网格质感）
      C2d.strokeStyle = P.CellStroke;
      C2d.lineWidth = 1;
      C2d.strokeRect(X + 0.5, Y + 0.5, Cs - 1, Cs - 1);
      // 当前玩家领土高亮描边（D 方案席位联动）
      if (Owners[I] === Current) {
        C2d.strokeStyle = P.CurrentHighlight;
        C2d.lineWidth = 1.5;
        C2d.strokeRect(X - 0.5, Y - 0.5, Cs + 1, Cs + 1);
      }
    }

    // 中心公共数值（任务1：统一首选字体）
    C2d.fillStyle = P.BoardText;
    C2d.font = `bold ${Math.max(12, Size * 0.05)}px '${PRIMARY_FONT}', 'Orbitron', monospace`;
    C2d.textAlign = 'center';
    C2d.textBaseline = 'middle';
    C2d.fillText(`公共 ${PublicTerritory}`, W / 2, By + Size + Size * 0.05);

    // 骰子点数结果（在对应玩家角落浮现，任务2）
    this._DrawDiceResults(C2d, Bx, By, Size, P);
  }

  /**
   * 在对应玩家角落绘制骰子点数结果，随时间淡出
   */
  private _DrawDiceResults(
    C2d: CanvasRenderingContext2D, Bx: number, By: number, Size: number, P: CanvasPaletteType): void {
    if (this._Results.length === 0) return;
    const Now = performance.now();
    this._Results = this._Results.filter((R) => R.Until > Now);
    for (const R of this._Results) {
      const Remaining = (R.Until - Now) / R.Duration;
      const Alpha = Math.max(0, Math.min(1, Remaining * 1.4));
      const [Ax, Ay] = CornerAnchor(R.PlayerId, Bx, By, Size);
      const Text = R.Values.join(' + ');
      C2d.save();
      C2d.globalAlpha = Alpha;
      C2d.font = `bold ${Math.max(13, Size * 0.045)}px '${PRIMARY_FONT}', sans-serif`;
      C2d.textAlign = 'center';
      C2d.textBaseline = 'middle';
      // 投影描边保证在任意底色上可读
      C2d.lineWidth = 3;
      C2d.strokeStyle = P.SpaceBg;
      C2d.strokeText(Text, Ax, Ay);
      C2d.fillStyle = R.Color;
      C2d.fillText(Text, Ax, Ay);
      C2d.restore();
    }
  }

  private _DrawFrame(Bx: number, By: number, Size: number, P: CanvasPaletteType): void {
    const C2d = this._Ctx.Ctx;
    // 外框（暗描边，白底上用近黑）
    C2d.strokeStyle = P.CellStroke;
    C2d.lineWidth = 2;
    C2d.strokeRect(Bx, By, Size, Size);
    // 四角支架括号（品牌青，白底上仍可见）
    const L = Size * 0.08;
    const Corners: [number, number, number, number][] = [
      [Bx, By, 1, 1],
      [Bx + Size, By, -1, 1],
      [Bx, By + Size, 1, -1],
      [Bx + Size, By + Size, -1, -1],
    ];
    C2d.strokeStyle = P.BoardPublic;
    C2d.lineWidth = 3;
    for (const [Cx, Cy, Sx, Sy] of Corners) {
      C2d.beginPath();
      C2d.moveTo(Cx, Cy + Sy * L);
      C2d.lineTo(Cx, Cy);
      C2d.lineTo(Cx + Sx * L, Cy);
      C2d.stroke();
    }
  }
}

/**
 * 计算某玩家角落在棋盘像素坐标中的「向内偏移」锚点
 */
function CornerAnchor(Id: number, Bx: number, By: number, Size: number): [number, number] {
  const M = Size * 0.07;
  const O = Size * 0.05; // 向棋盘内部偏移，避免贴边
  switch (Id) {
    case 0:
      return [Bx + M + O, By + M + O]; // 左上
    case 1:
      return [Bx + Size - M - O, By + M + O]; // 右上
    case 2:
      return [Bx + M + O, By + Size - M - O]; // 左下
    default:
      return [Bx + Size - M - O, By + Size - M - O]; // 右下
  }
}
