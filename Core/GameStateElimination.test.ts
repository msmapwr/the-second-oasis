import { describe, it, expect } from 'vitest';
import { GameState } from './GameState';
import { CreateDefaultConfig } from '@/Types/GameConfig';
import { GamePhase } from '@/Types/GamePhase';
import { DiceMode } from '@/Types/Dice';

describe('玩家淘汰', () => {
  it('2 人局：一方私有归零时淘汰，另一方直接获胜', () => {
    const State = new GameState(CreateDefaultConfig(2, 1));
    State.Start();
    while (!State.Snapshot.Players.every((P) => P.IsLaunched) && !State.IsOver) {
      const Phase = State.Phase as GamePhase;
      if (Phase === GamePhase.LaunchPhase) State.AttemptLaunch();
      else if (Phase === GamePhase.SelectMode) State.PlayTurn(DiceMode.None);
    }
    let TurnCount = 0;
    while (!State.IsOver && TurnCount < 1000) {
      const Phase = State.Phase as GamePhase;
      if (Phase === GamePhase.SelectMode) {
        State.PlayTurn(DiceMode.Aggressive);
      } else if (Phase === GamePhase.LaunchPhase) {
        State.AttemptLaunch();
      }
      TurnCount += 1;
    }
    expect(State.IsOver).toBe(true);
    expect(State.Result).not.toBeNull();
    expect(State.Result!.Winners.length).toBe(1);
  });

  it('3 人局：一方淘汰后游戏继续，其余两人继续', () => {
    const State = new GameState(CreateDefaultConfig(3, 2));
    State.Start();
    let TurnCount = 0;
    while (!State.IsOver && TurnCount < 1000) {
      const Phase = State.Phase as GamePhase;
      if (Phase === GamePhase.SelectMode) {
        State.PlayTurn(DiceMode.Aggressive);
      } else if (Phase === GamePhase.LaunchPhase) {
        State.AttemptLaunch();
      } else if (Phase === GamePhase.Tiebreaker) {
        State.RunTiebreaker();
      }
      TurnCount += 1;
    }
    expect(State.IsOver).toBe(true);
  });

  it('淘汰玩家不获得回合', () => {
    const State = new GameState(CreateDefaultConfig(3, 3));
    State.Start();
    while (!State.Snapshot.Players.every((P) => P.IsLaunched) && !State.IsOver) {
      const Phase = State.Phase as GamePhase;
      if (Phase === GamePhase.LaunchPhase) State.AttemptLaunch();
      else if (Phase === GamePhase.SelectMode) State.PlayTurn(DiceMode.None);
    }
    const BeforeCount = State.Snapshot.Players.filter(
      (P) => P.Status !== 'Eliminated',
    ).length;
    expect(BeforeCount).toBe(3);
  });

  it('Forfeit 主动退出视为淘汰', () => {
    const State = new GameState(CreateDefaultConfig(2, 4));
    State.Start();
    while (!State.Snapshot.Players.every((P) => P.IsLaunched) && !State.IsOver) {
      const Phase = State.Phase as GamePhase;
      if (Phase === GamePhase.LaunchPhase) State.AttemptLaunch();
      else if (Phase === GamePhase.SelectMode) State.PlayTurn(DiceMode.None);
    }
    State.Forfeit(0);
    expect(State.IsOver).toBe(true);
    expect(State.Result!.Winners[0].Id).toBe(1);
  });

  it('已淘汰玩家再次 Forfeit 无效果', () => {
    const State = new GameState(CreateDefaultConfig(3, 5));
    State.Start();
    while (!State.Snapshot.Players.every((P) => P.IsLaunched) && !State.IsOver) {
      const Phase = State.Phase as GamePhase;
      if (Phase === GamePhase.LaunchPhase) State.AttemptLaunch();
      else if (Phase === GamePhase.SelectMode) State.PlayTurn(DiceMode.None);
    }
    State.Forfeit(0);
    const PhaseAfter = State.Phase;
    State.Forfeit(0);
    expect(State.Phase).toBe(PhaseAfter);
  });
});
