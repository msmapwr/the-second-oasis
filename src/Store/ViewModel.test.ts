/**
 * src/Store/ViewModel.test.ts
 * 操作类型：新建
 *
 * ViewModel 单元测试
 */
import { describe, it, expect } from 'vitest';
import { ToPlayerViewModel, ToBoardViewModel, type ViewModelContext } from './ViewModel';
import type { PlayerSnapshot, PlayerStatus } from '@/Types/Player';
import type { TerritorySnapshot } from '@/Types/Territory';

/**
 * 构造测试用 PlayerSnapshot
 */
function MakePlayer(
  Id: number,
  Private: number,
  Consecutive: number,
  Over: Partial<PlayerSnapshot> = {},
): PlayerSnapshot {
  return {
    Id,
    PrivateTerritory: Private,
    ConsecutiveDoubles: Consecutive,
    Status: 'Active' as PlayerStatus,
    IsLaunched: true,
    IsWasteland: false,
    RevengeToken: false,
    ...Over,
  };
}

/**
 * 构造测试用 TerritorySnapshot
 */
function MakeSnapshot(PublicT: number, Players: PlayerSnapshot[]): TerritorySnapshot {
  return { PublicTerritory: PublicT, Players };
}

const BaseContext: ViewModelContext = {
  CurrentPlayerId: 0,
  CollapseX: 2,
  RobberyTriggeredCount: 0,
  WastelandCount: 0,
};

describe('ViewModel', () => {
  it('ToPlayerViewModel 正确映射基础字段', () => {
    const Snap = MakePlayer(1, 15, 0);
    const Vm = ToPlayerViewModel(Snap, BaseContext);
    expect(Vm.Id).toBe(1);
    expect(Vm.PrivateTerritory).toBe(15);
    expect(Vm.ConsecutiveDoubles).toBe(0);
    expect(Vm.Color).toBe('#8B5CF6'); // 玩家1=紫
    expect(Vm.LabelShort).toBe('P2');
    expect(Vm.LabelLong).toBe('玩家2');
  });

  it('ComboLabel 由 ConsecutiveDoubles 推导', () => {
    expect(ToPlayerViewModel(MakePlayer(0, 10, 1), BaseContext).ComboLabel).toBe('2x');
    expect(ToPlayerViewModel(MakePlayer(0, 10, 2), BaseContext).ComboLabel).toBe('3x');
    expect(ToPlayerViewModel(MakePlayer(0, 10, 0), BaseContext).ComboLabel).toBe('');
  });

  it('IsCurrent 标记当前行动玩家', () => {
    const Ctx = { ...BaseContext, CurrentPlayerId: 2 };
    expect(ToPlayerViewModel(MakePlayer(0, 10, 0), Ctx).IsCurrent).toBe(false);
    expect(ToPlayerViewModel(MakePlayer(2, 10, 0), Ctx).IsCurrent).toBe(true);
  });

  it('IsWasteland 与 IsLaunched 透传', () => {
    const Wasteland = MakePlayer(0, 0, 0, { IsWasteland: true, IsLaunched: false });
    const Vm = ToPlayerViewModel(Wasteland, BaseContext);
    expect(Vm.IsWasteland).toBe(true);
    expect(Vm.IsLaunched).toBe(false);
  });

  it('ToBoardViewModel 守恒：OccupiedCells = 100 - PublicTerritory', () => {
    const Snap = MakeSnapshot(73, [MakePlayer(0, 15, 0), MakePlayer(1, 12, 0)]);
    const Vm = ToBoardViewModel(Snap, BaseContext);
    expect(Vm.PublicTerritory).toBe(73);
    expect(Vm.TotalCells).toBe(100);
    expect(Vm.OccupiedCells).toBe(27);
  });

  it('ToBoardViewModel 传递危机指标', () => {
    const Snap = MakeSnapshot(50, [MakePlayer(0, 25, 0), MakePlayer(1, 25, 0)]);
    const Ctx = { ...BaseContext, CollapseX: 5, RobberyTriggeredCount: 1, WastelandCount: 3 };
    const Vm = ToBoardViewModel(Snap, Ctx);
    expect(Vm.CollapseX).toBe(5);
    expect(Vm.RobberyTriggeredCount).toBe(1);
    expect(Vm.WastelandCount).toBe(3);
  });

  it('ToBoardViewModel 包含所有玩家视图模型', () => {
    const Snap = MakeSnapshot(80, [
      MakePlayer(0, 10, 0),
      MakePlayer(1, 10, 1),
    ]);
    const Vm = ToBoardViewModel(Snap, BaseContext);
    expect(Vm.Players).toHaveLength(2);
    expect(Vm.Players[0].Id).toBe(0);
    expect(Vm.Players[1].ComboLabel).toBe('2x');
  });

  it('公共领土为 0 时 OccupiedCells = 100', () => {
    const Snap = MakeSnapshot(0, [MakePlayer(0, 50, 0), MakePlayer(1, 50, 0)]);
    const Vm = ToBoardViewModel(Snap, BaseContext);
    expect(Vm.OccupiedCells).toBe(100);
  });
});
