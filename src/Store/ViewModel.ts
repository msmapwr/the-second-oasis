/**
 * src/Store/ViewModel.ts
 * 操作类型：新建
 *
 * Snapshot → UI 视图模型映射
 * 关联：B 阶段架构方案 §3.4
 *
 * 设计要点：
 * 1. 纯函数转换，无副作用，便于单元测试
 * 2. 把 Core 的不可变 Snapshot 转成 UI 友好的扁平结构
 * 3. 自建派生字段：ComboLabel、IsCurrent、OccupiedCells 等
 * 4. 不持有状态，由调用方（GameStore/组件）按需调用
 */
import type { PlayerId, PlayerSnapshot, PlayerStatus } from '@/Types/Player';
import type { TerritorySnapshot } from '@/Types/Territory';
import { PlayerPalette, type ComboLabel } from './PlayerPalette';

/**
 * 单玩家视图模型
 * 把 PlayerSnapshot 扁平化 + 加入派生字段
 */
export interface PlayerViewModel {
  /** 玩家 ID（0-based） */
  readonly Id: PlayerId;
  /** 阵营色（hex） */
  readonly Color: string;
  /** 阵营暗色（hex，用于阴影） */
  readonly ColorDim: string;
  /** 短标签（P1） */
  readonly LabelShort: string;
  /** 长标签（玩家1） */
  readonly LabelLong: string;
  /** 阵营代号（蔚蓝协定） */
  readonly Codename: string;
  /** 私有领土数值 */
  readonly PrivateTerritory: number;
  /** 连续对子计数 */
  readonly ConsecutiveDoubles: number;
  /** 连击标签（''/'2x'/'3x'） */
  readonly ComboLabel: ComboLabel;
  /** 玩家状态 */
  readonly Status: PlayerStatus;
  /** 是否已发射 */
  readonly IsLaunched: boolean;
  /** 是否荒地 */
  readonly IsWasteland: boolean;
  /** 是否当前行动玩家 */
  readonly IsCurrent: boolean;
}

/**
 * 看板视图模型
 * 聚合领土快照 + 危机指标，供 Renderer 一次性读取
 */
export interface BoardViewModel {
  /** 公共领土剩余 */
  readonly PublicTerritory: number;
  /** 总格子数（=100） */
  readonly TotalCells: number;
  /** 已被占领格数（= TotalCells - PublicTerritory，守恒） */
  readonly OccupiedCells: number;
  /** 荒地格数（UI 维护，初始 0） */
  readonly WastelandCount: number;
  /** 当前崩坏系数 x */
  readonly CollapseX: number;
  /** 抢夺已触发次数（0 或 1，之后转崩坏） */
  readonly RobberyTriggeredCount: number;
  /** 各玩家视图模型 */
  readonly Players: readonly PlayerViewModel[];
}

/**
 * ViewModel 转换所需的外部上下文
 * 这些信息不在 Snapshot 中，需调用方传入
 */
export interface ViewModelContext {
  /** 当前行动玩家 ID */
  readonly CurrentPlayerId: PlayerId;
  /** 当前崩坏系数 x */
  readonly CollapseX: number;
  /** 抢夺已触发次数 */
  readonly RobberyTriggeredCount: number;
  /** 荒地格数（UI 层维护的累计值） */
  readonly WastelandCount: number;
}

/**
 * 把单个 PlayerSnapshot 转成 PlayerViewModel
 */
export function ToPlayerViewModel(
  Snap: PlayerSnapshot,
  Context: ViewModelContext,
): PlayerViewModel {
  return {
    Id: Snap.Id,
    Color: PlayerPalette.Color(Snap.Id),
    ColorDim: PlayerPalette.ColorDim(Snap.Id),
    LabelShort: PlayerPalette.LabelShort(Snap.Id),
    LabelLong: PlayerPalette.LabelLong(Snap.Id),
    Codename: PlayerPalette.Codename(Snap.Id),
    PrivateTerritory: Snap.PrivateTerritory,
    ConsecutiveDoubles: Snap.ConsecutiveDoubles,
    ComboLabel: PlayerPalette.ComboLabel(Snap.ConsecutiveDoubles),
    Status: Snap.Status,
    IsLaunched: Snap.IsLaunched,
    IsWasteland: Snap.IsWasteland,
    IsCurrent: Snap.Id === Context.CurrentPlayerId,
  };
}

/**
 * 把 TerritorySnapshot 转成 BoardViewModel
 *
 * 注意：WastelandCount 不在 Snapshot 中（Core 只标记玩家是否荒地，
 * 不统计格数），由 Context.WastelandCount 传入（UI 层 OwnerGrid 维护）
 */
export function ToBoardViewModel(
  Snap: TerritorySnapshot,
  Context: ViewModelContext,
): BoardViewModel {
  const TotalCells = 100;
  return {
    PublicTerritory: Snap.PublicTerritory,
    TotalCells,
    OccupiedCells: TotalCells - Snap.PublicTerritory,
    WastelandCount: Context.WastelandCount,
    CollapseX: Context.CollapseX,
    RobberyTriggeredCount: Context.RobberyTriggeredCount,
    Players: Snap.Players.map((P) => ToPlayerViewModel(P, Context)),
  };
}
