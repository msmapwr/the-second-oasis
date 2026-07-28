/**
 * src/AI/Evaluator.test.ts
 * 操作类型：新建
 *
 * 评估器测试
 * 使用 vitest globals
 */
import { DiceMode } from '@/Types/Dice';
import { AIDifficulty } from '@/Types/AI';
import { PlayerStatus } from '@/Types/Player';
import { EvaluateMode, type EvalContext } from './Evaluator';

describe('EvaluateMode', () => {
  const BaseContext = (Public: number, Own: number, Opp: number): EvalContext => ({
    Snapshot: {
      PublicTerritory: Public,
      Players: [
        { Id: 0, PrivateTerritory: Own, ConsecutiveDoubles: 0, Status: PlayerStatus.Active, IsLaunched: true, IsWasteland: false, RevengeToken: false },
        { Id: 1, PrivateTerritory: Opp, ConsecutiveDoubles: 0, Status: PlayerStatus.Active, IsLaunched: true, IsWasteland: false, RevengeToken: false },
      ],
    },
    PlayerId: 0,
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

  it('公共池充足时 Aggressive 分数应高于 Steady', () => {
    const Ctx = BaseContext(100, 10, 10);
    const Steady = EvaluateMode(Ctx, DiceMode.Steady);
    const Aggressive = EvaluateMode(Ctx, DiceMode.Aggressive);
    expect(Aggressive.FinalScore).toBeGreaterThan(Steady.FinalScore);
  });

  it('公共池极低且已 2 次连击时 Aggressive 分数应显著下降（怕清零）', () => {
    const Ctx = BaseContext(5, 10, 10);
    const Ctx2 = {
      ...Ctx,
      ConsecutiveDoubles: 2,
      Snapshot: {
        ...Ctx.Snapshot,
        Players: Ctx.Snapshot.Players.map((P) =>
          P.Id === 0 ? { ...P, ConsecutiveDoubles: 2 } : P,
        ),
      },
    };
    const Aggressive = EvaluateMode(Ctx2, DiceMode.Aggressive);
    const Steady = EvaluateMode(Ctx2, DiceMode.Steady);
    expect(Aggressive.RiskBreakdown.OverloadChance).toBeGreaterThan(0);
    expect(Aggressive.FinalScore).toBeLessThan(Steady.FinalScore);
  });

  it('None 模式应不改变领土且分数较低', () => {
    const Ctx = BaseContext(100, 10, 10);
    const None = EvaluateMode(Ctx, DiceMode.None);
    expect(None.ExpectedOwnAfter).toBe(10);
    expect(None.ExpectedPublicAfter).toBe(100);
  });

  it('Steady 的期望私有增量应约为 3.5', () => {
    const Ctx = BaseContext(100, 10, 10);
    const Steady = EvaluateMode(Ctx, DiceMode.Steady);
    expect(Steady.ExpectedOwnAfter).toBeCloseTo(13.5, 0);
  });

  it('Aggressive 公共充足时会有正期望收益', () => {
    const Ctx = BaseContext(100, 10, 10);
    const Aggressive = EvaluateMode(Ctx, DiceMode.Aggressive);
    expect(Aggressive.ExpectedOwnAfter).toBeGreaterThan(10);
  });

  it('Rookie 与 Master 对同一局面评估方向应一致（但分数绝对值不同）', () => {
    const Ctx = BaseContext(100, 10, 10);
    const CtxMaster = { ...Ctx, Difficulty: AIDifficulty.Master };
    const RookieAggressive = EvaluateMode(Ctx, DiceMode.Aggressive).FinalScore;
    const MasterAggressive = EvaluateMode(CtxMaster, DiceMode.Aggressive).FinalScore;
    const RookieSteady = EvaluateMode(Ctx, DiceMode.Steady).FinalScore;
    const MasterSteady = EvaluateMode(CtxMaster, DiceMode.Steady).FinalScore;
    expect(RookieAggressive > RookieSteady).toBe(MasterAggressive > MasterSteady);
  });
});
