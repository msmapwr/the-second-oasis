/**
 * src/AI/DecisionMaker.test.ts
 * 操作类型：新建
 *
 * 决策器测试
 * 使用 vitest globals
 */
import { DiceMode } from '@/Types/Dice';
import { AIDifficulty } from '@/Types/AI';
import { PlayerStatus } from '@/Types/Player';
import { SeededRandom } from '@/Utils/Random/SeededRandom';
import { DecideMode } from './DecisionMaker';

describe('DecideMode', () => {
  const BaseContext = (Public: number, Own: number, Opp: number) => ({
    PlayerId: 0 as 0,
    Snapshot: {
      PublicTerritory: Public,
      Players: [
        { Id: 0, PrivateTerritory: Own, ConsecutiveDoubles: 0, Status: PlayerStatus.Active, IsLaunched: true, IsWasteland: false, RevengeToken: false },
        { Id: 1, PrivateTerritory: Opp, ConsecutiveDoubles: 0, Status: PlayerStatus.Active, IsLaunched: true, IsWasteland: false, RevengeToken: false },
      ],
    },
    ConsecutiveDoubles: 0,
    RobberyTriggeredCount: 0,
    CollapseX: 2,
    Grudges: [],
    Personality: {
      Aggressiveness: 0.5,
      RiskTolerance: 0.5,
      Vengefulness: 0.5,
      Patience: 0.5,
    },
    Difficulty: AIDifficulty.Novice,
    TurnNumber: 1,
  });

  it('公共充足时大师级 AI 应倾向激进', () => {
    const R = new SeededRandom(10);
    const Ctx = { ...BaseContext(100, 10, 10), Difficulty: AIDifficulty.Master };
    const { Mode, Trace } = DecideMode(Ctx, R);
    expect([DiceMode.Aggressive, DiceMode.Steady]).toContain(Mode);
    expect(Trace.SelectedMode).toBe(Mode);
    expect(Trace.Evaluations.length).toBe(3);
  });

  it('Rookie 应有更高随机性（在模糊局面多次运行出现不同选择）', () => {
    const Choices = new Set<DiceMode>();
    for (let Seed = 1; Seed <= 30; Seed++) {
      const R = new SeededRandom(Seed);
      // 公共池低，激进风险高，不同种子噪声可能改变选择
      const Ctx = { ...BaseContext(10, 10, 10), Difficulty: AIDifficulty.Rookie };
      const { Mode } = DecideMode(Ctx, R);
      Choices.add(Mode);
    }
    // Rookie 噪声大，应至少出现两种选择
    expect(Choices.size).toBeGreaterThan(1);
  });

  it('已 2 次连击且公共低时，高难 AI 应避免激进', () => {
    const R = new SeededRandom(11);
    const Ctx = {
      ...BaseContext(5, 10, 10),
      ConsecutiveDoubles: 2,
      Difficulty: AIDifficulty.Master,
    };
    const CtxWithSnapshot = {
      ...Ctx,
      Snapshot: {
        ...Ctx.Snapshot,
        Players: Ctx.Snapshot.Players.map((P) =>
          P.Id === 0 ? { ...P, ConsecutiveDoubles: 2 } : P,
        ),
      },
    };
    const { Mode } = DecideMode(CtxWithSnapshot, R);
    expect(Mode).not.toBe(DiceMode.Aggressive);
  });

  it('应生成非空决策理由', () => {
    const R = new SeededRandom(12);
    const Ctx = BaseContext(100, 10, 10);
    const { Trace } = DecideMode(Ctx, R);
    expect(Trace.Reason.length).toBeGreaterThan(0);
    expect(Trace.ThinkingTimeMs).toBeGreaterThanOrEqual(0);
  });
});
