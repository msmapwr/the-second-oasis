/**
 * src/AI/TransparentLog.test.ts
 * 操作类型：新建
 *
 * 决策透明日志类型测试
 * 使用 vitest globals
 */
import {
  IsModeTrace,
  IsLaunchTrace,
  IsTiebreakerTrace,
  type ModeDecisionTrace,
  type LaunchDecisionTrace,
  type TiebreakerDecisionTrace,
} from './TransparentLog';
import { DiceMode } from '@/Types/Dice';

describe('TransparentLog type guards', () => {
  it('应识别 Mode 轨迹', () => {
    const Trace: ModeDecisionTrace = {
      Type: 'Mode',
      PlayerId: 0,
      Difficulty: 0,
      Personality: {
        Aggressiveness: 0.5,
        RiskTolerance: 0.5,
        Vengefulness: 0.5,
        Patience: 0.5,
      },
      Grudges: [],
      Evaluations: [],
      SelectedMode: DiceMode.Steady,
      Reason: '测试',
      ThinkingTimeMs: 100,
    };
    expect(IsModeTrace(Trace)).toBe(true);
    expect(IsLaunchTrace(Trace)).toBe(false);
    expect(IsTiebreakerTrace(Trace)).toBe(false);
  });

  it('应识别 Launch 轨迹', () => {
    const Trace: LaunchDecisionTrace = {
      Type: 'Launch',
      PlayerId: 0,
      Difficulty: 0,
      Personality: {
        Aggressiveness: 0.5,
        RiskTolerance: 0.5,
        Vengefulness: 0.5,
        Patience: 0.5,
      },
      Reason: '测试',
      ObservedLaunchFailures: 0,
      ThinkingTimeMs: 100,
    };
    expect(IsLaunchTrace(Trace)).toBe(true);
  });

  it('应识别 Tiebreaker 轨迹', () => {
    const Trace: TiebreakerDecisionTrace = {
      Type: 'Tiebreaker',
      PlayerId: 0,
      Difficulty: 0,
      Personality: {
        Aggressiveness: 0.5,
        RiskTolerance: 0.5,
        Vengefulness: 0.5,
        Patience: 0.5,
      },
      Reason: '测试',
      OwnPrivate: 10,
      BestOpponentPrivate: 12,
      ThinkingTimeMs: 100,
    };
    expect(IsTiebreakerTrace(Trace)).toBe(true);
  });
});
