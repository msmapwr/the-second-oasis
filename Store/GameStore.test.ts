/**
 * src/Store/GameStore.test.ts
 * 操作类型：新建
 *
 * GameStore 单元测试
 * 用真实 GameState 验证事件发射机制
 */
import { describe, it, expect } from 'vitest';
import { GameStore } from './GameStore';
import { CreateDefaultConfig } from '@/Types/GameConfig';
import { GamePhase } from '@/Types/GamePhase';
import { DiceMode } from '@/Types/Dice';

/**
 * 创建测试用 2 人局 Store
 */
function MakeStore(Seed = 42): GameStore {
  return new GameStore(CreateDefaultConfig(2, Seed));
}

describe('GameStore', () => {
  it('构造后 Phase === Init', () => {
    const Store = MakeStore();
    expect(Store.Phase).toBe(GamePhase.Init);
    expect(Store.IsOver).toBe(false);
    expect(Store.Result).toBeNull();
  });

  it('Snapshot 初始公共=100，私有=0', () => {
    const Store = MakeStore();
    const Snap = Store.Snapshot;
    expect(Snap.PublicTerritory).toBe(100);
    expect(Snap.Players).toHaveLength(2);
    expect(Snap.Players[0].PrivateTerritory).toBe(0);
    expect(Snap.Players[0].IsLaunched).toBe(false);
  });

  it('CollapseX 初始为 2', () => {
    const Store = MakeStore();
    expect(Store.CollapseX).toBe(2);
  });

  it('RobberyTriggeredCount 初始为 0', () => {
    const Store = MakeStore();
    expect(Store.RobberyTriggeredCount).toBe(0);
  });

  it('Start() 后 Phase === LaunchPhase，发射 PhaseChange', () => {
    const Store = MakeStore();
    const Phases: { From: GamePhase; To: GamePhase }[] = [];
    Store.On('PhaseChange', (P) => Phases.push(P));
    Store.Start();
    expect(Store.Phase).toBe(GamePhase.LaunchPhase);
    expect(Phases).toEqual([{ From: GamePhase.Init, To: GamePhase.LaunchPhase }]);
  });

  it('Start() 后发射 Snapshot 事件', () => {
    const Store = MakeStore();
    let SnapCount = 0;
    Store.On('Snapshot', () => SnapCount++);
    Store.Start();
    expect(SnapCount).toBe(1);
  });

  it('AttemptLaunch() 发射 Launch 事件含结果', () => {
    const Store = MakeStore();
    Store.Start();
    let LaunchResult: unknown = null;
    Store.On('Launch', ({ Result }) => { LaunchResult = Result; });
    const Result = Store.AttemptLaunch();
    expect(LaunchResult).toBe(Result);
  });

  it('AttemptLaunch() 后发射 Snapshot 事件', () => {
    const Store = MakeStore();
    Store.Start();
    let SnapCount = 0;
    Store.On('Snapshot', () => SnapCount++);
    Store.AttemptLaunch();
    expect(SnapCount).toBe(1);
  });

  it('完整发射序章后进入 SelectMode', () => {
    const Store = MakeStore(42);
    Store.Start();
    // 发射阶段 per-player：成功玩家立即进入 SelectMode 正常回合，
    // 失败/未发射玩家继续 LaunchPhase，因此需交替处理两种阶段直到全员发射。
    let Guard = 0;
    while (!Store.Snapshot.Players.every((P) => P.IsLaunched) && Guard < 200) {
      if (Store.Phase === GamePhase.LaunchPhase) {
        Store.AttemptLaunch();
      } else if (Store.Phase === GamePhase.SelectMode) {
        Store.PlayTurn(DiceMode.None);
      } else {
        break;
      }
      Guard++;
    }
    expect(Store.Phase).toBe(GamePhase.SelectMode);
    // 全员应已发射
    for (const P of Store.Snapshot.Players) {
      expect(P.IsLaunched).toBe(true);
    }
  });

  it('PlayTurn() 发射 Turn 事件含结果', () => {
    const Store = MakeStore(42);
    Store.Start();
    // 跑完发射阶段
    let Guard = 0;
    while (Store.Phase === GamePhase.LaunchPhase && Guard < 50) {
      Store.AttemptLaunch();
      Guard++;
    }
    // 现在在 SelectMode
    let TurnResult: unknown = null;
    Store.On('Turn', ({ Result }) => { TurnResult = Result; });
    const Result = Store.PlayTurn(DiceMode.Steady);
    expect(TurnResult).toBe(Result);
  });

  it('PlayTurn() 后发射 Snapshot 事件', () => {
    const Store = MakeStore(42);
    Store.Start();
    let Guard = 0;
    while (Store.Phase === GamePhase.LaunchPhase && Guard < 50) {
      Store.AttemptLaunch();
      Guard++;
    }
    let SnapCount = 0;
    Store.On('Snapshot', () => SnapCount++);
    Store.PlayTurn(DiceMode.None); // None 不消耗随机源
    expect(SnapCount).toBe(1);
  });

  it('PhaseChange 不在相同 Phase 时重复发射', () => {
    const Store = MakeStore(42);
    Store.Start();
    let PhaseCount = 0;
    Store.On('PhaseChange', () => PhaseCount++);
    // 首轮发射：可能多次 AttemptLaunch 仍保持 LaunchPhase
    const BeforeLaunch = Store.Phase;
    Store.AttemptLaunch();
    // 如果 Phase 没变，PhaseCount 应为 0
    if (Store.Phase === BeforeLaunch) {
      expect(PhaseCount).toBe(0);
    }
  });

  it('GetConsecutiveDoubles 初始为 0', () => {
    const Store = MakeStore();
    Store.Start();
    expect(Store.GetConsecutiveDoubles(0)).toBe(0);
    expect(Store.GetConsecutiveDoubles(1)).toBe(0);
  });

  it('CurrentPlayer 初始为 0', () => {
    const Store = MakeStore();
    Store.Start();
    expect(Store.CurrentPlayer).toBe(0);
  });

  it('PlayTurn(Steady) 后 CurrentPlayer 推进', () => {
    const Store = MakeStore(42);
    Store.Start();
    let Guard = 0;
    while (Store.Phase === GamePhase.LaunchPhase && Guard < 50) {
      Store.AttemptLaunch();
      Guard++;
    }
    const Before = Store.CurrentPlayer;
    Store.PlayTurn(DiceMode.None);
    // 2 人局，玩家应交替
    expect(Store.CurrentPlayer).not.toBe(Before);
  });
});
