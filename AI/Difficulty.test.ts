/**
 * src/AI/Difficulty.test.ts
 * 操作类型：新建
 *
 * 难度参数表测试
 * 使用 vitest globals
 */
import { AIDifficulty } from '@/Types/AI';
import {
  GetDifficultyProfile,
  GetDifficultyLabel,
  GetDifficultyName,
} from './Difficulty';

describe('GetDifficultyProfile', () => {
  it('Rookie 无前瞻、大噪声', () => {
    const P = GetDifficultyProfile(AIDifficulty.Rookie);
    expect(P.LookaheadDepth).toBe(0);
    expect(P.SimulationBranches).toBe(0);
    expect(P.EvaluationNoise).toBeGreaterThan(0);
  });

  it('Master 前瞻最深、噪声为 0', () => {
    const P = GetDifficultyProfile(AIDifficulty.Master);
    expect(P.LookaheadDepth).toBeGreaterThan(0);
    expect(P.SimulationBranches).toBeGreaterThan(0);
    expect(P.EvaluationNoise).toBe(0);
  });

  it('难度参数应随等级单调递增', () => {
    const Levels = [
      AIDifficulty.Rookie,
      AIDifficulty.Novice,
      AIDifficulty.Intermediate,
      AIDifficulty.Advanced,
      AIDifficulty.Elite,
      AIDifficulty.Master,
    ];
    let LastLookahead = -1;
    for (const L of Levels) {
      const P = GetDifficultyProfile(L);
      expect(P.LookaheadDepth).toBeGreaterThanOrEqual(LastLookahead);
      LastLookahead = P.LookaheadDepth;
    }
  });
});

describe('GetDifficultyLabel / GetDifficultyName', () => {
  it('应返回中文标签', () => {
    expect(GetDifficultyLabel(AIDifficulty.Rookie)).toBe('菜鸟');
    expect(GetDifficultyLabel(AIDifficulty.Master)).toBe('大师');
  });

  it('应返回英文名称', () => {
    expect(GetDifficultyName(AIDifficulty.Novice)).toBe('Novice');
  });
});
