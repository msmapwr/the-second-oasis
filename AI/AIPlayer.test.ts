/**
 * src/AI/AIPlayer.test.ts
 * 操作类型：新建
 *
 * AI 玩家实例测试
 * 使用 vitest globals
 */
import { DiceMode } from '@/Types/Dice';
import { AIDifficulty } from '@/Types/AI';
import { PlayerStatus } from '@/Types/Player';
import { RobberyRole } from '@/Types/Robbery';
import { SeededRandom } from '@/Utils/Random/SeededRandom';
import { AIPlayer } from './AIPlayer';

describe('AIPlayer', () => {
  const Config = {
    Id: 0 as 0,
    Name: 'AI-0',
    Color: '#ff0000',
    IsAI: true,
    Difficulty: AIDifficulty.Novice,
    Personality: {
      Aggressiveness: 0.5,
      RiskTolerance: 0.5,
      Vengefulness: 0.5,
      Patience: 0.5,
    },
  };

  const Snapshot = {
    PublicTerritory: 100,
    Players: [
      { Id: 0, PrivateTerritory: 10, ConsecutiveDoubles: 0, Status: PlayerStatus.Active, IsLaunched: true, IsWasteland: false, RevengeToken: false },
      { Id: 1, PrivateTerritory: 10, ConsecutiveDoubles: 0, Status: PlayerStatus.Active, IsLaunched: true, IsWasteland: false, RevengeToken: false },
    ],
  };

  it('应能做出模式选择并生成轨迹', () => {
    const AI = new AIPlayer(Config);
    const R = new SeededRandom(20);
    const { Mode, Trace } = AI.DecideMode(Snapshot, 0, 0, 2, R);
    expect([DiceMode.Aggressive, DiceMode.Steady, DiceMode.None]).toContain(Mode);
    expect(Trace.Type).toBe('Mode');
    expect(Trace.PlayerId).toBe(0);
  });

  it('应记录被抢事件', () => {
    const AI = new AIPlayer(Config);
    AI.ObserveTurn(
      {
        PlayerId: 1,
        Mode: DiceMode.Aggressive,
        Dice: null,
        DevOutcome: null,
        OccupationDelta: null,
        Robbery: {
          OverflowM2: 5,
          Defender: 0,
          RollHistory: [{ InitiatorRoll: 4, DefenderRoll: 2, IsTie: false }],
          Winner: RobberyRole.Initiator,
          RandomReturn: 1,
          Transfer: 3,
          InitiatorDelta: 2,
          DefenderDelta: -3,
          PublicDelta: 1,
        },
        Collapse: null,
        IsOverload: false,
        NeedsRelaunchNext: false,
        RoundIndex: 0,
        FirstPlayerIndex: 0,
        LeaderTax: null,
        SprintBonus: 0,
        Revenge: null,
      },
      Snapshot,
      1,
    );
    expect(AI.Memory.GetGrudgeAgainst(1, 1)).toBeGreaterThan(0);
  });

  it('应记录崩坏受损事件', () => {
    const AI = new AIPlayer(Config);
    AI.ObserveTurn(
      {
        PlayerId: 1,
        Mode: DiceMode.Aggressive,
        Dice: null,
        DevOutcome: null,
        OccupationDelta: null,
        Robbery: null,
        Collapse: {
          CoefficientX: 2,
          TotalLoss: 8,
          IsConserved: true,
          PlayerLosses: [
            { Id: 1, RandomLoss: 5, ActualLoss: 5, BeforePrivate: 10, AfterPrivate: 5 },
            { Id: 0, RandomLoss: 3, ActualLoss: 3, BeforePrivate: 10, AfterPrivate: 7 },
          ],
          InitiatorId: 1,
          PublicDelta: -2,
          NextX: 3,
        },
        IsOverload: false,
        NeedsRelaunchNext: false,
        RoundIndex: 0,
        FirstPlayerIndex: 0,
        LeaderTax: null,
        SprintBonus: 0,
        Revenge: null,
      },
      Snapshot,
      1,
    );
    expect(AI.Memory.GetGrudgeAgainst(1, 1)).toBeGreaterThan(0);
  });

  it('Reset 应清空记忆', () => {
    const AI = new AIPlayer(Config);
    AI.Memory.Record({ TargetId: 1, BaseScore: 3, IncidentType: 'robbery' }, 1);
    AI.Reset();
    expect(AI.Memory.Snapshot(1).length).toBe(0);
    expect(AI.GetTurnNumber()).toBe(0);
  });
});
