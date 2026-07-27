/**
 * 蒙特卡洛模拟测试
 * 验证模拟能正常运行并产出合理统计
 */
import { describe, it, expect } from 'vitest';
import { RunSimulation } from './MonteCarloSimulation';
import { DiceMode } from '@/Types/Dice';

describe('蒙特卡洛模拟', () => {
  it('2 人局 50 局应正常完成并返回统计', () => {
    const R = RunSimulation(2, 50, DiceMode.Aggressive, 100);
    expect(R.GameCount).toBe(50);
    expect(R.AvgTurns).toBeGreaterThan(0);
    expect(R.MinTurns).toBeGreaterThan(0);
    // 胜率总和应 = 1
    const SumWinRate = R.WinRates.reduce((A, B) => A + B, 0);
    expect(SumWinRate).toBeCloseTo(1, 5);
  });

  it('3 人局 30 局应正常完成', () => {
    const R = RunSimulation(3, 30, DiceMode.Aggressive, 200);
    expect(R.GameCount).toBe(30);
    expect(R.WinRates).toHaveLength(3);
  });

  it('稳健模式对局应回合数更多（收益低）', () => {
    const Aggressive = RunSimulation(2, 30, DiceMode.Aggressive, 300);
    const Steady = RunSimulation(2, 30, DiceMode.Steady, 300);
    // 稳健模式每次最多+6，激进最多+12，稳健应需要更多回合
    expect(Steady.AvgTurns).toBeGreaterThanOrEqual(Aggressive.AvgTurns);
  });

  it('相同种子批次应产生确定性结果', () => {
    const A = RunSimulation(2, 20, DiceMode.Aggressive, 500);
    const B = RunSimulation(2, 20, DiceMode.Aggressive, 500);
    expect(A).toEqual(B);
  });
});
