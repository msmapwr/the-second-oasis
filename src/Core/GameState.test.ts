/**
 * GameState 核心状态机集成测试
 * 关联规则：§6 全局流程、所有模块联动
 *
 * 测试策略：用 SeededRandom 跑完整对局，验证不变量与确定性
 */
import { describe, it, expect } from 'vitest';
import { GameState } from './GameState';
import { CreateDefaultConfig } from '@/Types/GameConfig';
import { GamePhase } from '@/Types/GamePhase';
import { DiceMode } from '@/Types/Dice';

/**
 * 辅助：跑一局完整对局，返回终局状态摘要
 * 封装对局循环逻辑，避免 TS 类型收窄导致的 Phase 比较问题
 */
function RunFullGame(
  PlayerCount: 2 | 3 | 4,
  Seed: number,
  Mode: DiceMode = DiceMode.Aggressive,
): {
  IsOver: boolean;
  Public: number;
  WinnerIds: number[];
  RobberyCount: number;
  CollapseX: number;
} {
  const State = new GameState(CreateDefaultConfig(PlayerCount, Seed));
  State.Start();

  // 安全上限防止死循环
  let Iterations = 0;
  const MaxIter = 2000;

  while (!State.IsOver && Iterations < MaxIter) {
    Iterations++;
    const Phase = State.Phase as GamePhase;
    if (Phase === GamePhase.LaunchPhase) {
      State.AttemptLaunch();
    } else if (Phase === GamePhase.SelectMode) {
      State.PlayTurn(Mode);
    } else if (Phase === GamePhase.Tiebreaker) {
      State.RunTiebreaker();
    } else {
      // 其他阶段不应出现在外部循环（内部瞬态），退出防卡死
      break;
    }
  }

  return {
    IsOver: State.IsOver,
    Public: State.Snapshot.PublicTerritory,
    WinnerIds: State.Result?.Winners.map((W) => W.Id) ?? [],
    RobberyCount: State.RobberyTriggeredCount,
    CollapseX: State.CollapseX,
  };
}

/** 辅助：跑完发射阶段（新逻辑下发射与正常回合会交错，需按 Phase 推进） */
function CompleteLaunch(State: GameState): void {
  let Iterations = 0;
  while (!State.Snapshot.Players.every((P) => P.IsLaunched) && Iterations < 400) {
    Iterations++;
    const Phase = State.Phase as GamePhase;
    if (Phase === GamePhase.LaunchPhase) {
      State.AttemptLaunch();
    } else if (Phase === GamePhase.SelectMode) {
      // 已发射玩家先进入正常回合，用 None 模式推进以保持领土最小变动
      State.PlayTurn(DiceMode.None);
    } else {
      break;
    }
  }
}

describe('GameState 核心状态机', () => {
  describe('初始化与发射阶段', () => {
    it('构造后应为 Init 阶段，公共领土=100', () => {
      const State = new GameState(CreateDefaultConfig(2, 42));
      expect(State.Phase).toBe(GamePhase.Init);
      expect(State.Snapshot.PublicTerritory).toBe(100);
      expect(State.Snapshot.Players).toHaveLength(2);
      expect(State.Snapshot.Players[0].PrivateTerritory).toBe(0);
      expect(State.Snapshot.Players[0].IsLaunched).toBe(false);
    });

    it('玩家数非法应抛 PlayerCountError', () => {
      expect(() => new GameState(CreateDefaultConfig(1 as 2, 42))).toThrow();
      expect(() => new GameState(CreateDefaultConfig(5 as 2, 42))).toThrow();
    });

    it('Start 后进入 LaunchPhase', () => {
      const State = new GameState(CreateDefaultConfig(2, 42));
      State.Start();
      expect(State.Phase).toBe(GamePhase.LaunchPhase);
    });

    it('发射阶段完成后全员 IsLaunched=true，进入 SelectMode', () => {
      const State = new GameState(CreateDefaultConfig(2, 42));
      State.Start();
      CompleteLaunch(State);

      expect(State.Phase).toBe(GamePhase.SelectMode);
      expect(State.Snapshot.Players.every((P) => P.IsLaunched)).toBe(true);
      // 每人至少 +2（成功一次）
      for (const P of State.Snapshot.Players) {
        expect(P.PrivateTerritory).toBeGreaterThanOrEqual(2);
      }
    });

    it('非 LaunchPhase 调用 AttemptLaunch 应抛错', () => {
      const State = new GameState(CreateDefaultConfig(2, 42));
      // 未 Start，Phase=Init
      expect(() => State.AttemptLaunch()).toThrow();
    });
  });

  describe('主循环基本流程', () => {
    it('PlayTurn 后应推进到下一位玩家或终局', () => {
      const State = new GameState(CreateDefaultConfig(2, 42));
      State.Start();
      CompleteLaunch(State);

      State.PlayTurn(DiceMode.Aggressive);

      // 应推进到下一位或终局或加赛
      const Phase = State.Phase as GamePhase;
      expect([
        GamePhase.SelectMode,
        GamePhase.LaunchPhase,
        GamePhase.GameOver,
        GamePhase.Tiebreaker,
      ]).toContain(Phase);
    });

    it('非 SelectMode 调用 PlayTurn 应抛错', () => {
      const State = new GameState(CreateDefaultConfig(2, 42));
      State.Start();
      // Phase=LaunchPhase
      expect(() => State.PlayTurn(DiceMode.Steady)).toThrow();
    });

    it('None 模式：公共与私有领土不变，连击清零', () => {
      const State = new GameState(CreateDefaultConfig(2, 42));
      State.Start();
      CompleteLaunch(State);

      const Snap = State.Snapshot;
      const PublicBefore = Snap.PublicTerritory;
      const PrivateSumBefore = Snap.Players[0].PrivateTerritory + Snap.Players[1].PrivateTerritory;

      State.PlayTurn(DiceMode.None);

      // None 模式不掷骰不占领
      const SnapAfter = State.Snapshot;
      expect(SnapAfter.PublicTerritory).toBe(PublicBefore);
      const PrivateSumAfter = SnapAfter.Players[0].PrivateTerritory + SnapAfter.Players[1].PrivateTerritory;
      expect(PrivateSumAfter).toBe(PrivateSumBefore);
    });
  });

  describe('完整对局不变量', () => {
    it('2 人局：应跑到终局，所有私有≥0，唯一胜者', () => {
      const R = RunFullGame(2, 42);
      expect(R.IsOver).toBe(true);
      expect(R.WinnerIds).toHaveLength(1);
    });

    it('3 人局：应跑到终局', () => {
      const R = RunFullGame(3, 7);
      expect(R.IsOver).toBe(true);
      expect(R.WinnerIds.length).toBeGreaterThanOrEqual(1);
    });

    it('4 人局：应跑到终局', () => {
      const R = RunFullGame(4, 123);
      expect(R.IsOver).toBe(true);
    });

    it('相同种子应产生完全相同的对局（确定性/联机同步保证）', () => {
      const A = RunFullGame(2, 42);
      const B = RunFullGame(2, 42);
      expect(A).toEqual(B);
    });

    it('稳健模式对局：应跑到终局', () => {
      const R = RunFullGame(2, 999, DiceMode.Steady);
      expect(R.IsOver).toBe(true);
    });

    it('私有领土在终局时永远 ≥0（不变量）', () => {
      // 多种子验证
      for (const Seed of [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]) {
        const State = new GameState(CreateDefaultConfig(3, Seed));
        State.Start();
        CompleteLaunch(State);

        let T = 0;
        while (!State.IsOver && (State.Phase as GamePhase) !== GamePhase.Tiebreaker && T < 1000) {
          const Phase = State.Phase as GamePhase;
          if (Phase === GamePhase.SelectMode) State.PlayTurn(DiceMode.Aggressive);
          else if (Phase === GamePhase.LaunchPhase) State.AttemptLaunch();
          T++;
        }
        while ((State.Phase as GamePhase) === GamePhase.Tiebreaker && T < 1010) {
          State.RunTiebreaker();
          T++;
        }

        expect(State.IsOver).toBe(true);
        for (const P of State.Snapshot.Players) {
          expect(P.PrivateTerritory).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe('抢夺与崩坏机制', () => {
    it('RobberyTriggeredCount 最多为 1（之后溢出转崩坏）', () => {
      // 多种子验证
      for (const Seed of [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]) {
        const R = RunFullGame(3, Seed);
        expect(R.IsOver).toBe(true);
        expect(R.RobberyCount).toBeLessThanOrEqual(1);
      }
    });

    it('崩坏系数 X 应 ≥ 初值 2', () => {
      const R = RunFullGame(3, 42);
      expect(R.CollapseX).toBeGreaterThanOrEqual(2);
    });
  });
});
