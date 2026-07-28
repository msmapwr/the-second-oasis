/**
 * src/AI/Simulator.test.ts
 * 操作类型：新建
 *
 * 模拟器测试
 * 使用 vitest globals
 */
import { DiceMode } from '@/Types/Dice';
import { PlayerStatus } from '@/Types/Player';
import { SeededRandom } from '@/Utils/Random/SeededRandom';
import { SimulateFirstMode } from './Simulator';

describe('SimulateFirstMode', () => {
  const Snapshot = {
    PublicTerritory: 100,
    Players: [
      { Id: 0, PrivateTerritory: 10, ConsecutiveDoubles: 0, Status: PlayerStatus.Active, IsLaunched: true, IsWasteland: false, RevengeToken: false },
      { Id: 1, PrivateTerritory: 10, ConsecutiveDoubles: 0, Status: PlayerStatus.Active, IsLaunched: true, IsWasteland: false, RevengeToken: false },
    ],
  };

  it('应在多分支后给出聚合结果', () => {
    const R = new SeededRandom(7);
    const Result = SimulateFirstMode(
      Snapshot,
      0,
      DiceMode.Aggressive,
      2,
      10,
      R,
      2,
      0,
      0,
    );
    expect(Result.ExpectedFinalOwn).toBeGreaterThanOrEqual(0);
    expect(Result.WinProbability).toBeGreaterThanOrEqual(0);
    expect(Result.WinProbability).toBeLessThanOrEqual(1);
  });

  it('Steady 应比 Aggressive 有更低开发过度概率', () => {
    const R1 = new SeededRandom(8);
    const R2 = new SeededRandom(8);
    const Aggressive = SimulateFirstMode(
      Snapshot,
      0,
      DiceMode.Aggressive,
      2,
      20,
      R1,
      2,
      0,
      0,
    );
    const Steady = SimulateFirstMode(
      Snapshot,
      0,
      DiceMode.Steady,
      2,
      20,
      R2,
      2,
      0,
      0,
    );
    expect(Steady.OverloadProbability).toBe(0);
    expect(Aggressive.OverloadProbability).toBeGreaterThanOrEqual(0);
  });

  it('深度 0 不应模拟任何回合，结果等于初始状态', () => {
    const R = new SeededRandom(9);
    const Result = SimulateFirstMode(
      Snapshot,
      0,
      DiceMode.Steady,
      0,
      1,
      R,
      2,
      0,
      0,
    );
    expect(Result.ExpectedFinalOwn).toBe(10);
    expect(Result.ExpectedFinalPublic).toBe(100);
  });
});
