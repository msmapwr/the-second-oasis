/**
 * src/AI/Simulator.ts
 * 操作类型：新建
 *
 * 浅层前瞻模拟器
 * 关联：D 优先级 AI 对手模块 §Phase 4
 *
 * 设计要点：
 * 1. 从当前 Snapshot 复制轻量状态，使用 Core/Occupation 模拟占领
 * 2. 对当前候选首步，随机掷骰；后续回合用快速启发式策略推进
 * 3. 近似处理抢夺/崩坏：抢夺按守恒简单转移，崩坏按系数均摊损失
 * 4. 运行多分支后聚合：最终私有、胜率、开发过度概率
 * 5. 不追求完美精确，只给决策器提供“趋势”修正
 */
import type { PlayerId } from '@/Types/Player';
import { PlayerStatus } from '@/Types/Player';
import type { TerritorySnapshot } from '@/Types/Territory';
import { DiceMode } from '@/Types/Dice';
import { DevMultiplier } from '@/Types/DevChain';
import { AIDifficulty } from '@/Types/AI';
import { Occupation } from '@/Core/Occupation';
import type { IRandomSource } from '@/Utils/Random/IRandomSource';
import { EvaluateMode, type EvalContext } from './Evaluator';
import { CreatePersonality } from './Personality';

/**
 * 模拟结果
 */
export interface SimulationResult {
  readonly ExpectedFinalOwn: number;
  readonly ExpectedFinalPublic: number;
  readonly WinProbability: number;
  readonly OverloadProbability: number;
  readonly ExpectedBestOpponent: number;
}

/**
 * 模拟用轻量状态
 */
interface SimState {
  PublicTerritory: number;
  Privates: number[];
  ConsecutiveDoubles: number[];
  RobberyTriggeredCount: number;
  CollapseX: number;
  CurrentPlayer: PlayerId;
  IsLaunched: boolean[];
  Status: PlayerStatus[];
}

/**
 * 模拟一个分支，返回最终状态
 */
function RunBranch(
  Initial: SimState,
  FocalPlayer: PlayerId,
  FirstMode: DiceMode,
  Depth: number,
  Random: IRandomSource,
): {
  FinalOwn: number;
  FinalPublic: number;
  BestOpp: number;
  IsWin: boolean;
  OverloadHappened: boolean;
} {
  const State = CloneState(Initial);

  // 第 0 步：执行候选首步（仅当 Depth >= 1 时）
  let Step = 0;
  let OverloadHappened = false;
  if (Depth > 0 && State.Status[State.CurrentPlayer] === PlayerStatus.Active && State.IsLaunched[State.CurrentPlayer]) {
    OverloadHappened = ExecutePlayerTurn(State, State.CurrentPlayer, FirstMode, Random);
    Step += 1;
  }
  if (Step > 0) AdvanceTurn(State);

  // 后续回合：所有活跃玩家使用快速启发式
  while (Step < Depth) {
    const Player = State.CurrentPlayer;
    if (State.Status[Player] === PlayerStatus.Active && State.IsLaunched[Player]) {
      const Mode = PickHeuristicMode(State, Player, FocalPlayer, Random);
      const Overloaded = ExecutePlayerTurn(State, Player, Mode, Random);
      if (Overloaded) OverloadHappened = true;
      Step += 1;
    }
    AdvanceTurn(State);
  }

  const FinalOwn = State.Privates[FocalPlayer];
  const BestOpp = State.Privates.reduce((Max, V, Id) =>
    Id === FocalPlayer ? Max : Math.max(Max, V), 0);
  return {
    FinalOwn,
    FinalPublic: State.PublicTerritory,
    BestOpp,
    IsWin: FinalOwn >= BestOpp && FinalOwn > 0,
    OverloadHappened,
  };
}

/**
 * 执行一个玩家回合（简化版，不含详细发射逻辑）
 * @returns 是否发生开发过度
 */
function ExecutePlayerTurn(
  State: SimState,
  Player: PlayerId,
  Mode: DiceMode,
  Random: IRandomSource,
): boolean {
  if (Mode === DiceMode.None) {
    State.ConsecutiveDoubles[Player] = 0;
    return false;
  }

  const PrivateBefore = State.Privates[Player];
  const PublicBefore = State.PublicTerritory;

  let RawGain = 0;
  let IsDouble = false;
  let Multiplier = DevMultiplier.None;
  let IsOverload = false;

  if (Mode === DiceMode.Steady) {
    RawGain = Random.NextDie();
  } else {
    const A = Random.NextDie();
    const B = Random.NextDie();
    const Sum = A + B;
    IsDouble = A === B;
    RawGain = Sum <= 6 ? 0 - Sum : Sum;
  }

  if (IsDouble) {
    const NewCount = State.ConsecutiveDoubles[Player] + 1;
    if (NewCount >= 3) {
      IsOverload = true;
    } else if (NewCount === 1) {
      Multiplier = DevMultiplier.Dev;
    } else {
      Multiplier = DevMultiplier.BigDev;
    }
    State.ConsecutiveDoubles[Player] = IsOverload ? 0 : NewCount;
  } else {
    State.ConsecutiveDoubles[Player] = 0;
  }

  if (IsOverload) {
    State.Privates[Player] = 0;
    State.Status[Player] = PlayerStatus.NeedsRelaunch;
    State.IsLaunched[Player] = false;
    return true;
  }

  const Occ = new Occupation().Calculate(PublicBefore, PrivateBefore, RawGain, Multiplier);
  State.PublicTerritory = Occ.PublicAfter;
  State.Privates[Player] += Occ.PrivateDelta;

  if (Occ.IsOverflow) {
    if (State.RobberyTriggeredCount === 0) {
      SimulateRobbery(State, Player, Occ.OverflowM2, Random);
      State.RobberyTriggeredCount = 1;
    } else {
      SimulateCollapse(State, Occ.OverflowM2);
      State.CollapseX += 1;
    }
  }
  return false;
}

/**
 * 简化抢夺：输家损失 min(OverflowM2, 私有)，赢家获得，剩余回公共
 * 以第一个非发起者且私有最多的玩家作为“防守者”
 */
function SimulateRobbery(
  State: SimState,
  Initiator: PlayerId,
  OverflowM2: number,
  _Random: IRandomSource,
): void {
  let Defender = -1;
  let MaxPrivate = -1;
  for (let I = 0; I < State.Privates.length; I++) {
    if (I === Initiator) continue;
    if (State.Privates[I] > MaxPrivate) {
      MaxPrivate = State.Privates[I];
      Defender = I;
    }
  }
  if (Defender < 0) {
    State.PublicTerritory += OverflowM2;
    return;
  }
  const Transfer = Math.min(OverflowM2, MaxPrivate);
  const ReturnToPublic = OverflowM2 - Transfer;
  State.Privates[Defender] -= Transfer;
  State.Privates[Initiator] += Transfer;
  State.PublicTerritory += ReturnToPublic;
}

/**
 * 简化崩坏：所有玩家（含发起者）均摊损失，公共也减少
 */
function SimulateCollapse(State: SimState, OverflowM2: number): void {
  const TotalLoss = State.CollapseX * OverflowM2;
  const LossPerPlayer = Math.floor(TotalLoss / State.Privates.length);
  const Remainder = TotalLoss - LossPerPlayer * State.Privates.length;
  for (let I = 0; I < State.Privates.length; I++) {
    State.Privates[I] = Math.max(0, State.Privates[I] - LossPerPlayer);
  }
  // 余数随机或给发起者：这里简化给 0 号玩家
  if (Remainder > 0) {
    State.Privates[0] = Math.max(0, State.Privates[0] - Remainder);
  }
  State.PublicTerritory = Math.max(0, State.PublicTerritory - OverflowM2);
}

/**
 * 快速启发式选模式：使用 Evaluator，但用默认性格和空记忆
 */
function PickHeuristicMode(
  State: SimState,
  Player: PlayerId,
  _FocalPlayer: PlayerId,
  Random: IRandomSource,
): DiceMode {
  const Snapshot = StateToSnapshot(State);
  const Difficulty = AIDifficulty.Novice;
  const Personality = CreatePersonality(Difficulty, 'Balanced', Random);
  const Ctx: EvalContext = {
    Snapshot,
    PlayerId: Player,
    ConsecutiveDoubles: State.ConsecutiveDoubles[Player],
    RobberyTriggeredCount: State.RobberyTriggeredCount,
    CollapseX: State.CollapseX,
    Grudges: [],
    Personality,
    Difficulty,
    TurnNumber: 1,
  };

  const Steady = EvaluateMode(Ctx, DiceMode.Steady);
  const Aggressive = EvaluateMode(Ctx, DiceMode.Aggressive);
  const None = EvaluateMode(Ctx, DiceMode.None);

  const Evals = [Steady, Aggressive, None];
  Evals.sort((A, B) => B.FinalScore - A.FinalScore);
  return Evals[0].Mode;
}

/**
 * 把模拟状态转为 Snapshot
 */
function StateToSnapshot(State: SimState): TerritorySnapshot {
  return {
    PublicTerritory: State.PublicTerritory,
    Players: State.Privates.map((Private, Id) => ({
      Id,
      PrivateTerritory: Private,
      ConsecutiveDoubles: State.ConsecutiveDoubles[Id],
      Status: State.Status[Id],
      IsLaunched: State.IsLaunched[Id],
      IsWasteland: State.Status[Id] === PlayerStatus.NeedsRelaunch,
      RevengeToken: false,
    })),
  };
}

/**
 * 推进当前玩家到下一位
 */
function AdvanceTurn(State: SimState): void {
  State.CurrentPlayer = (State.CurrentPlayer + 1) % State.Privates.length;
}

/**
 * 深拷贝模拟状态
 */
function CloneState(State: SimState): SimState {
  return {
    PublicTerritory: State.PublicTerritory,
    Privates: [...State.Privates],
    ConsecutiveDoubles: [...State.ConsecutiveDoubles],
    RobberyTriggeredCount: State.RobberyTriggeredCount,
    CollapseX: State.CollapseX,
    CurrentPlayer: State.CurrentPlayer,
    IsLaunched: [...State.IsLaunched],
    Status: [...State.Status],
  };
}

/**
 * 从 Snapshot 初始化模拟状态
 */
function InitStateFromSnapshot(Snapshot: TerritorySnapshot): SimState {
  return {
    PublicTerritory: Snapshot.PublicTerritory,
    Privates: Snapshot.Players.map((P) => P.PrivateTerritory),
    ConsecutiveDoubles: Snapshot.Players.map((P) => P.ConsecutiveDoubles),
    RobberyTriggeredCount: 0,
    CollapseX: 2,
    CurrentPlayer: 0,
    IsLaunched: Snapshot.Players.map((P) => P.IsLaunched),
    Status: Snapshot.Players.map((P) => P.Status),
  };
}

/**
 * 外部入口：对某个候选首步做前瞻模拟
 */
export function SimulateFirstMode(
  Snapshot: TerritorySnapshot,
  FocalPlayer: PlayerId,
  FirstMode: DiceMode,
  Depth: number,
  Branches: number,
  Random: IRandomSource,
  InitialCollapseX: number,
  InitialRobberyCount: number,
  CurrentPlayer: PlayerId,
): SimulationResult {
  const Initial = InitStateFromSnapshot(Snapshot);
  Initial.CollapseX = InitialCollapseX;
  Initial.RobberyTriggeredCount = InitialRobberyCount;
  Initial.CurrentPlayer = CurrentPlayer;

  let TotalOwn = 0;
  let TotalPublic = 0;
  let TotalBestOpp = 0;
  let Wins = 0;
  let Overloads = 0;

  for (let I = 0; I < Branches; I++) {
    const Result = RunBranch(Initial, FocalPlayer, FirstMode, Depth, Random);
    TotalOwn += Result.FinalOwn;
    TotalPublic += Result.FinalPublic;
    TotalBestOpp += Result.BestOpp;
    if (Result.IsWin) Wins += 1;
    if (Result.OverloadHappened) Overloads += 1;
  }

  return {
    ExpectedFinalOwn: TotalOwn / Branches,
    ExpectedFinalPublic: TotalPublic / Branches,
    WinProbability: Wins / Branches,
    OverloadProbability: Overloads / Branches,
    ExpectedBestOpponent: TotalBestOpp / Branches,
  };
}
