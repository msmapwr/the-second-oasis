/**
 * src/Core/GameState.ts
 * 操作类型：修改
 *
 * 核心状态机——编排所有 Core 模块，驱动完整对局
 * 关联规则：计划书 §6 回合流程（全局编排）+ v1.2 变体包
 */
import { SeededRandom } from '@/Utils/Random/SeededRandom';
import type { IRandomSource } from '@/Utils/Random/IRandomSource';
import { DiceRoller } from './DiceRoller';
import { Occupation } from './Occupation';
import { DevChain } from './DevChain';
import { Robbery } from './Robbery';
import { Collapse } from './Collapse';
import { Launch } from './Launch';
import { GameEnd } from './GameEnd';
import { DiceMode } from '@/Types/Dice';
import { PlayerStatus } from '@/Types/Player';
import type { PlayerId, PlayerSnapshot } from '@/Types/Player';
import type { TerritorySnapshot } from '@/Types/Territory';
import type { GameConfig } from '@/Types/GameConfig';
import { GamePhase } from '@/Types/GamePhase';
import type { TurnResult, LeaderTaxRecord } from '@/Types/Turn';
import type { Winner, TiebreakerRound, GameResult } from '@/Types/GameResult';
import { PlayerCountError, InvalidTurnPhaseError } from './Errors';
import {
  MIN_PLAYERS,
  MAX_PLAYERS,
} from './Constants';

interface InternalPlayer {
  Id: PlayerId;
  PrivateTerritory: number;
  ConsecutiveDoubles: number;
  Status: PlayerStatus;
  IsLaunched: boolean;
  IsWasteland: boolean;
  RevengeToken: boolean;
}

export class GameState {
  private readonly _Config: GameConfig;
  private readonly _Random: IRandomSource;
  private readonly _Dice: DiceRoller;
  private readonly _Occupation: Occupation;
  private readonly _Robbery: Robbery;
  private readonly _Collapse: Collapse;
  private readonly _Launch: Launch;
  private readonly _GameEnd: GameEnd;
  private readonly _DevChains: Map<PlayerId, DevChain>;

  private _Players: InternalPlayer[];
  private _PublicTerritory: number;

  private _Phase: GamePhase;
  private _CurrentPlayerIndex: number;
  private _RobberyTriggeredCount: number;

  private readonly _TurnHistory: TurnResult[];
  private readonly _TiebreakerHistory: TiebreakerRound[];
  private _Result: GameResult | null;

  private _RoundIndex: number;
  private _FirstPlayerIndex: PlayerId;
  private _PendingRevengeTarget: PlayerId | null = null;

  constructor(Config: GameConfig) {
    if (Config.PlayerCount < MIN_PLAYERS || Config.PlayerCount > MAX_PLAYERS) {
      throw new PlayerCountError(
        `玩家数 ${Config.PlayerCount} 不合法，须在 ${MIN_PLAYERS}~${MAX_PLAYERS} 之间`,
      );
    }

    this._Config = Config;
    this._Random = new SeededRandom(Config.Seed);
    this._Dice = new DiceRoller(this._Random);
    this._Occupation = new Occupation();
    this._Robbery = new Robbery(this._Random);
    this._Collapse = new Collapse(this._Random, Config.CollapseInitialX);
    this._Launch = new Launch(this._Dice);
    this._GameEnd = new GameEnd(this._Random);

    this._DevChains = new Map();
    this._Players = [];
    for (let I = 0; I < Config.PlayerCount; I++) {
      this._DevChains.set(I, new DevChain(0));
      this._Players.push({
        Id: I,
        PrivateTerritory: Config.InitialPrivate,
        ConsecutiveDoubles: 0,
        Status: PlayerStatus.Active,
        IsLaunched: false,
        IsWasteland: false,
        RevengeToken: false,
      });
    }

    this._PublicTerritory = Config.InitialPublic;
    this._Phase = GamePhase.Init;
    this._CurrentPlayerIndex = 0;
    this._RobberyTriggeredCount = 0;
    this._TurnHistory = [];
    this._TiebreakerHistory = [];
    this._Result = null;
    this._RoundIndex = 0;
    this._FirstPlayerIndex = 0;
  }

  get Phase(): GamePhase {
    return this._Phase;
  }

  get CurrentPlayer(): PlayerId {
    return this._CurrentPlayerIndex;
  }

  get IsOver(): boolean {
    return this._Phase === GamePhase.GameOver;
  }

  get Result(): GameResult | null {
    return this._Result;
  }

  get RobberyTriggeredCount(): number {
    return this._RobberyTriggeredCount;
  }

  get CollapseX(): number {
    return this._Collapse.X;
  }

  get RoundIndex(): number {
    return this._RoundIndex;
  }

  get FirstPlayerIndex(): PlayerId {
    return this._FirstPlayerIndex;
  }

  get Snapshot(): TerritorySnapshot {
    return {
      PublicTerritory: this._PublicTerritory,
      Players: this._Players.map((P) => this.ToSnapshot(P)),
    };
  }

  GetConsecutiveDoubles(PlayerId: PlayerId): number {
    return this._DevChains.get(PlayerId)?.ConsecutiveDoubles ?? 0;
  }

  SetRevengeTarget(TargetId: PlayerId): void {
    this._PendingRevengeTarget = TargetId;
  }

  Start(): void {
    this._Phase = GamePhase.LaunchPhase;
    this._CurrentPlayerIndex = 0;
    this._RoundIndex = 0;
    this._FirstPlayerIndex = 0;
  }

  AttemptLaunch(): ReturnType<Launch['Attempt']> {
    if (this._Phase !== GamePhase.LaunchPhase) {
      throw new InvalidTurnPhaseError(
        `当前阶段 ${this._Phase} 不允许发射，须在 LaunchPhase`,
      );
    }

    const Player = this._Players[this._CurrentPlayerIndex];
    const Result = this._Launch.Attempt(Player.Id);

    if (Result.Status === 'Success') {
      Player.IsLaunched = true;
      const Gain = Math.min(Result.PrivateDelta, this._PublicTerritory);
      this._PublicTerritory -= Gain;
      Player.PrivateTerritory += Gain;

      if (Player.Status === PlayerStatus.NeedsRelaunch) {
        Player.Status = PlayerStatus.Active;
        Player.IsWasteland = false;
      }

      this._Phase = GamePhase.SelectMode;
      return Result;
    }

    if (!Player.IsLaunched) {
      this.AdvanceToNextPlayerInLaunch();
    } else {
      this.AdvanceToNextPlayer();
    }

    return Result;
  }

  Forfeit(PlayerId: PlayerId): void {
    if (this._Phase === GamePhase.GameOver) return;
    const Player = this._Players[PlayerId];
    if (!Player || Player.Status === PlayerStatus.Eliminated) return;
    Player.Status = PlayerStatus.Eliminated;
    Player.PrivateTerritory = 0;
    this.CheckAndApplyElimination();
  }

  InitiateRobbery(InitiatorId: PlayerId, TargetId: PlayerId): TurnResult | null {
    if (this._Phase !== GamePhase.SelectMode) return null;
    const Player = this._Players[this._CurrentPlayerIndex];
    if (Player.Id !== InitiatorId) return null;
    if (Player.Status === PlayerStatus.Eliminated) return null;

    const Target = this._Players[TargetId];
    if (!Target || Target.Status === PlayerStatus.Eliminated) return null;

    const SnapshotPlayers = this.Snapshot.Players;
    const TargetSnapshot = SnapshotPlayers[TargetId];

    const OverflowM2 = Math.min(10, TargetSnapshot.PrivateTerritory);
    if (OverflowM2 <= 0) return null;

    const Result = this._Robbery.Resolve(InitiatorId, SnapshotPlayers, OverflowM2);

    this._Players[InitiatorId].PrivateTerritory += Result.InitiatorDelta;
    this._Players[TargetId].PrivateTerritory += Result.DefenderDelta;
    this._PublicTerritory += Result.PublicDelta;

    this.CheckAndApplyElimination();
    if (this.IsOver) {
      const Turn: TurnResult = {
        PlayerId: InitiatorId,
        Mode: DiceMode.Revenge,
        Dice: { Mode: DiceMode.Revenge, Dice: [], Sum: 0, IsDouble: false, IsDeducted: false, RawGain: 0 },
        DevOutcome: null,
        OccupationDelta: null,
        Robbery: Result,
        Collapse: null,
        IsOverload: false,
        NeedsRelaunchNext: false,
        RoundIndex: this._RoundIndex,
        FirstPlayerIndex: this._FirstPlayerIndex,
        LeaderTax: null,
        SprintBonus: 0,
        Revenge: null,
      };
      this._TurnHistory.push(Turn);
      return Turn;
    }

    this.AdvanceToNextPlayer();

    const Turn: TurnResult = {
      PlayerId: InitiatorId,
      Mode: DiceMode.Revenge,
      Dice: { Mode: DiceMode.Revenge, Dice: [], Sum: 0, IsDouble: false, IsDeducted: false, RawGain: 0 },
      DevOutcome: null,
      OccupationDelta: null,
      Robbery: Result,
      Collapse: null,
      IsOverload: false,
      NeedsRelaunchNext: false,
      RoundIndex: this._RoundIndex,
      FirstPlayerIndex: this._FirstPlayerIndex,
      LeaderTax: null,
      SprintBonus: 0,
      Revenge: null,
    };
    this._TurnHistory.push(Turn);
    return Turn;
  }

  PlayTurn(Mode: DiceMode): TurnResult {
    if (this._Phase !== GamePhase.SelectMode) {
      throw new InvalidTurnPhaseError(
        `当前阶段 ${this._Phase} 不允许 PlayTurn，须在 SelectMode`,
      );
    }

    const Player = this._Players[this._CurrentPlayerIndex];
    const PlayerId = Player.Id;

    if (Player.Status === PlayerStatus.Eliminated) {
      this.AdvanceToNextPlayer();
      return this.BuildSkippedTurn(PlayerId);
    }

    if (Mode === DiceMode.Revenge) {
      return this.PlayRevengeTurn(PlayerId);
    }

    const Dice = this._Dice.Roll(Mode);
    const Chain = this._DevChains.get(PlayerId)!;
    const DevOutcome = Chain.Advance(Dice.IsDouble, Mode);

    if (DevOutcome.IsOverload) {
      Player.PrivateTerritory = 0;
      Player.IsWasteland = true;
      Player.Status = PlayerStatus.NeedsRelaunch;
      Player.ConsecutiveDoubles = 0;
      Chain.Reset();

      const IsRoundEnd = this.IsRoundEndAfterThisTurn();
      const LeaderTax = IsRoundEnd ? this.ApplyLeaderTax() : null;
      const Turn: TurnResult = {
        PlayerId,
        Mode,
        Dice: Mode === DiceMode.None ? null : Dice,
        DevOutcome,
        OccupationDelta: null,
        Robbery: null,
        Collapse: null,
        IsOverload: true,
        NeedsRelaunchNext: true,
        RoundIndex: this._RoundIndex,
        FirstPlayerIndex: this._FirstPlayerIndex,
        LeaderTax,
        SprintBonus: 0,
        Revenge: null,
      };
      this._TurnHistory.push(Turn);

      if (GameEnd.IsGameOver(this._PublicTerritory)) {
        this.EnterGameOver();
      } else {
        this.AdvanceToNextPlayer();
      }
      return Turn;
    }

    const PublicBefore = this._PublicTerritory;
    const PrivateBefore = Player.PrivateTerritory;
    const SprintBonus = this.CalculateSprintBonus(Dice.RawGain);
    const Occ = this._Occupation.Calculate(
      PublicBefore,
      PrivateBefore,
      Dice.RawGain,
      DevOutcome.Multiplier,
      SprintBonus,
    );

    this._PublicTerritory = Occ.PublicAfter;
    Player.PrivateTerritory += Occ.PrivateDelta;
    Player.ConsecutiveDoubles = DevOutcome.NewConsecutiveDoubles;
    this.CheckAndApplyElimination();
    if ((this._Phase as GamePhase) === GamePhase.GameOver) {
      const SkipTurn: TurnResult = {
        PlayerId,
        Mode,
        Dice: Mode === DiceMode.None ? null : Dice,
        DevOutcome,
        OccupationDelta: { PublicDelta: Occ.PublicDelta, PrivateDelta: Occ.PrivateDelta },
        Robbery: null,
        Collapse: null,
        IsOverload: false,
        NeedsRelaunchNext: false,
        RoundIndex: this._RoundIndex,
        FirstPlayerIndex: this._FirstPlayerIndex,
        LeaderTax: null,
        SprintBonus: Occ.SprintBonus,
        Revenge: null,
      };
      this._TurnHistory.push(SkipTurn);
      return SkipTurn;
    }

    let RobberyResult: TurnResult['Robbery'] = null;
    let CollapseResult: TurnResult['Collapse'] = null;

    if (Occ.IsOverflow) {
      if (this._RobberyTriggeredCount === 0) {
        RobberyResult = this.ResolveRobbery(PlayerId, Occ.OverflowM2);
      } else {
        CollapseResult = this.ResolveCollapse(PlayerId, Occ.OverflowM2);
      }
    }

    const IsRoundEnd = this.IsRoundEndAfterThisTurn();
    const LeaderTax = IsRoundEnd ? this.ApplyLeaderTax() : null;

    const Turn: TurnResult = {
      PlayerId,
      Mode,
      Dice: Mode === DiceMode.None ? null : Dice,
      DevOutcome,
      OccupationDelta: {
        PublicDelta: Occ.PublicDelta,
        PrivateDelta: Occ.PrivateDelta,
      },
      Robbery: RobberyResult,
      Collapse: CollapseResult,
      IsOverload: false,
      NeedsRelaunchNext: false,
      RoundIndex: this._RoundIndex,
      FirstPlayerIndex: this._FirstPlayerIndex,
      LeaderTax,
      SprintBonus: Occ.SprintBonus,
      Revenge: null,
    };
    this._TurnHistory.push(Turn);

    if (GameEnd.IsGameOver(this._PublicTerritory)) {
      this.EnterGameOver();
    } else {
      this.AdvanceToNextPlayer();
    }

    return Turn;
  }

  private PlayRevengeTurn(PlayerId: PlayerId): TurnResult {
    const Player = this._Players[PlayerId];
    const TargetId = this.ResolveRevengeTarget(PlayerId);
    const Roll = this._Dice.RollRevengeResult(
      this._Config.RevengeSuccessThreshold,
      (Die) => Die - 2,
      this._Config.RevengeFailureCost,
    );

    let TargetDelta = 0;
    let SelfDelta = 0;
    let PublicDelta = 0;

    if (Roll.IsSuccess) {
      const Target = this._Players[TargetId];
      const Steal = Math.min(Roll.StealAmount, Target.PrivateTerritory);
      Target.PrivateTerritory -= Steal;
      Player.PrivateTerritory += Steal;
      TargetDelta = -Steal;
      SelfDelta = Steal;
    } else {
      const Loss = Math.min(Roll.SelfLoss, Player.PrivateTerritory);
      Player.PrivateTerritory -= Loss;
      this._PublicTerritory += Loss;
      SelfDelta = -Loss;
      PublicDelta = Loss;
    }

    Player.RevengeToken = false;
    this.CheckAndApplyElimination();
    if ((this._Phase as GamePhase) === GamePhase.GameOver) {
      const SkipTurn: TurnResult = {
        PlayerId,
        Mode: DiceMode.Revenge,
        Dice: { Mode: DiceMode.Revenge, Dice: [Roll.Die], Sum: Roll.Die, IsDouble: false, IsDeducted: false, RawGain: 0 },
        DevOutcome: null,
        OccupationDelta: null,
        Robbery: null,
        Collapse: null,
        IsOverload: false,
        NeedsRelaunchNext: false,
        RoundIndex: this._RoundIndex,
        FirstPlayerIndex: this._FirstPlayerIndex,
        LeaderTax: null,
        SprintBonus: 0,
        Revenge: { TargetId, Roll, TargetDelta, SelfDelta, PublicDelta },
      };
      this._TurnHistory.push(SkipTurn);
      return SkipTurn;
    }

    const IsRoundEnd = this.IsRoundEndAfterThisTurn();
    const LeaderTax = IsRoundEnd ? this.ApplyLeaderTax() : null;

    const Turn: TurnResult = {
      PlayerId,
      Mode: DiceMode.Revenge,
      Dice: {
        Mode: DiceMode.Revenge,
        Dice: [Roll.Die],
        Sum: Roll.Die,
        IsDouble: false,
        IsDeducted: false,
        RawGain: 0,
      },
      DevOutcome: null,
      OccupationDelta: null,
      Robbery: null,
      Collapse: null,
      IsOverload: false,
      NeedsRelaunchNext: false,
      RoundIndex: this._RoundIndex,
      FirstPlayerIndex: this._FirstPlayerIndex,
      LeaderTax,
      SprintBonus: 0,
      Revenge: {
        TargetId,
        Roll,
        TargetDelta,
        SelfDelta,
        PublicDelta,
      },
    };
    this._TurnHistory.push(Turn);

    if (GameEnd.IsGameOver(this._PublicTerritory)) {
      this.EnterGameOver();
    } else {
      this.AdvanceToNextPlayer();
    }

    return Turn;
  }

  private IsRoundEndAfterThisTurn(): boolean {
    const Count = this._Config.PlayerCount;
    let NextIndex = this._CurrentPlayerIndex;
    for (let I = 0; I < Count; I++) {
      NextIndex = (NextIndex + 1) % Count;
      const Next = this._Players[NextIndex];
      if (Next.Status === PlayerStatus.Eliminated) continue;
      return NextIndex === this._FirstPlayerIndex;
    }
    return true;
  }

  private ResolveRevengeTarget(PlayerId: PlayerId): PlayerId {
    if (this._PendingRevengeTarget !== null && this._PendingRevengeTarget !== PlayerId) {
      const Target = this._PendingRevengeTarget;
      this._PendingRevengeTarget = null;
      return Target;
    }

    let Best: PlayerId | null = null;
    let BestPrivate = -1;
    for (const P of this._Players) {
      if (P.Id !== PlayerId && P.PrivateTerritory > BestPrivate) {
        BestPrivate = P.PrivateTerritory;
        Best = P.Id;
      }
    }
    return Best ?? ((PlayerId + 1) % this._Config.PlayerCount);
  }

  private CalculateSprintBonus(RawGain: number): number {
    if (!this._Config.EnableScarcitySprint) return 0;
    if (this._PublicTerritory > this._Config.SprintThreshold) return 0;
    if (RawGain <= 0) return 0;
    return this._Config.SprintBonus;
  }

  RunTiebreaker(): TiebreakerRound {
    if (this._Phase !== GamePhase.Tiebreaker) {
      throw new InvalidTurnPhaseError(
        `当前阶段 ${this._Phase} 不允许加赛，须在 Tiebreaker`,
      );
    }

    const Winners = this._Result?.Winners ?? [];
    const Participants = Winners.map((W) => W.Id);
    const Round = this._GameEnd.RunTiebreakerRound(Participants);
    this._TiebreakerHistory.push(Round);

    if (Round.IsFinal) {
      const FinalWinnerId = Round.WinnersThisRound[0];
      const WinnerSnapshot = this._Players[FinalWinnerId];
      this._Result = {
        IsOver: true,
        Winners: [
          {
            Id: FinalWinnerId,
            PrivateTerritory: WinnerSnapshot.PrivateTerritory,
          },
        ],
        TiebreakerHistory: [...this._TiebreakerHistory],
        FinalSnapshot: this.Snapshot,
      };
      this._Phase = GamePhase.GameOver;
    } else {
      const NewWinners: Winner[] = Round.WinnersThisRound.map((Id) => ({
        Id,
        PrivateTerritory: this._Players[Id].PrivateTerritory,
      }));
      this._Result = {
        IsOver: true,
        Winners: NewWinners,
        TiebreakerHistory: [...this._TiebreakerHistory],
        FinalSnapshot: this.Snapshot,
      };
    }

    return Round;
  }

  private ResolveRobbery(
    InitiatorId: PlayerId,
    OverflowM2: number,
  ): NonNullable<TurnResult['Robbery']> {
    const Result = this._Robbery.Resolve(
      InitiatorId,
      this.Snapshot.Players,
      OverflowM2,
    );

    this._Players[InitiatorId].PrivateTerritory += Result.InitiatorDelta;
    this._Players[Result.Defender].PrivateTerritory += Result.DefenderDelta;
    this._PublicTerritory += Result.PublicDelta;
    this._RobberyTriggeredCount += 1;
    this.CheckAndApplyElimination();
    if (this._Phase === GamePhase.GameOver) return Result;

    if (this._Config.EnableRevengeRaid) {
      const LoserId = Result.Winner === 'Initiator' ? Result.Defender : InitiatorId;
      this._Players[LoserId].RevengeToken = true;
    }

    return Result;
  }

  private ResolveCollapse(
    InitiatorId: PlayerId,
    OverflowM2: number,
  ): NonNullable<TurnResult['Collapse']> {
    const Result = this._Collapse.Resolve(
      InitiatorId,
      this.Snapshot.Players,
      OverflowM2,
      this._PublicTerritory,
    );

    for (const Loss of Result.PlayerLosses) {
      this._Players[Loss.Id].PrivateTerritory = Loss.AfterPrivate;
    }
    this._PublicTerritory += Result.PublicDelta;
    this.CheckAndApplyElimination();
    if (this._Phase === GamePhase.GameOver) return Result;

    if (this._Config.EnableRevengeRaid && Result.PlayerLosses.length > 0) {
      let MaxLoss = -1;
      let Victim: PlayerId | null = null;
      for (const Loss of Result.PlayerLosses) {
        if (Loss.ActualLoss > MaxLoss) {
          MaxLoss = Loss.ActualLoss;
          Victim = Loss.Id;
        }
      }
      if (Victim !== null) {
        this._Players[Victim].RevengeToken = true;
      }
    }

    return Result;
  }

  private EnterGameOver(): void {
    const Winners = GameEnd.ComputeWinners(this.Snapshot.Players);
    this._Result = {
      IsOver: true,
      Winners,
      TiebreakerHistory: [...this._TiebreakerHistory],
      FinalSnapshot: this.Snapshot,
    };

    if (Winners.length > 1) {
      this._Phase = GamePhase.Tiebreaker;
    } else {
      this._Phase = GamePhase.GameOver;
    }
  }

  private AdvanceToNextPlayerInLaunch(): void {
    const Count = this._Config.PlayerCount;
    for (let I = 0; I < Count; I++) {
      this._CurrentPlayerIndex = (this._CurrentPlayerIndex + 1) % Count;
      const Next = this._Players[this._CurrentPlayerIndex];
      if (!Next.IsLaunched) {
        return;
      }
    }
    this._Phase = GamePhase.SelectMode;
    this._CurrentPlayerIndex = this._FirstPlayerIndex;
  }

  private AdvanceToNextPlayer(): void {
    const Count = this._Config.PlayerCount;
    const InMainLoop = this._Phase === GamePhase.SelectMode;

    let NextIndex = this._CurrentPlayerIndex;
    for (let I = 0; I < Count; I++) {
      NextIndex = (NextIndex + 1) % Count;
      const Next = this._Players[NextIndex];
      if (Next.Status === PlayerStatus.Eliminated) continue;
      break;
    }

    if (InMainLoop && NextIndex === this._FirstPlayerIndex) {
      if (this._Config.EnableRotatingStart) {
        this._RoundIndex += 1;
        this._FirstPlayerIndex = (this._RoundIndex % Count) as PlayerId;
      }
    }

    this._CurrentPlayerIndex = NextIndex;

    const Next = this._Players[this._CurrentPlayerIndex];
    if (Next.Status === PlayerStatus.Eliminated) {
      if (this.CountActivePlayers() <= 1) {
        this.EnterGameOver();
        return;
      }
      this.AdvanceToNextPlayer();
      return;
    }

    if (!Next.IsLaunched || Next.Status === PlayerStatus.NeedsRelaunch) {
      this._Phase = GamePhase.LaunchPhase;
    } else {
      this._Phase = GamePhase.SelectMode;
    }
  }

  private ApplyLeaderTax(): LeaderTaxRecord | null {
    if (!this._Config.EnableLeaderTax || this._Config.LeaderTaxBase <= 0) return null;
    if (this._Phase === GamePhase.GameOver) return null;

    let Leader: InternalPlayer | null = null;
    for (const P of this._Players) {
      if (P.Status === PlayerStatus.Eliminated) continue;
      if (!P.IsLaunched) continue;
      if (Leader === null || P.PrivateTerritory > Leader.PrivateTerritory) {
        Leader = P;
      }
    }

    if (Leader === null) return null;

    let IsTied = false;
    for (const P of this._Players) {
      if (P.Id !== Leader.Id && P.PrivateTerritory === Leader.PrivateTerritory) {
        IsTied = true;
        break;
      }
    }
    if (IsTied) return null;

    const Tax = Math.min(this._Config.LeaderTaxBase, Leader.PrivateTerritory);
    if (Tax <= 0) return null;

    Leader.PrivateTerritory -= Tax;
    this._PublicTerritory += Tax;
    this.CheckAndApplyElimination();
    if ((this._Phase as GamePhase) === GamePhase.GameOver) return null;
    return { PlayerId: Leader.Id, Amount: Tax };
  }

  private CheckAndApplyElimination(): void {
    if (this._Phase === GamePhase.GameOver) return;
    for (const P of this._Players) {
      if (P.Status === PlayerStatus.Eliminated) continue;
      if (P.Status === PlayerStatus.Active && P.IsLaunched && P.PrivateTerritory === 0) {
        P.Status = PlayerStatus.Eliminated;
      }
    }
    const AllLaunched = this._Players.every(
      (P) => P.IsLaunched || P.Status === PlayerStatus.Eliminated,
    );
    if (AllLaunched && this.HasOnlyOneActivePlayer()) {
      this.EnterGameOver();
    }
  }

  private CountActivePlayers(): number {
    let Count = 0;
    for (const P of this._Players) {
      if (P.Status !== PlayerStatus.Eliminated && P.IsLaunched) {
        Count += 1;
      }
    }
    return Count;
  }

  private HasOnlyOneActivePlayer(): boolean {
    return this.CountActivePlayers() <= 1;
  }

  private BuildSkippedTurn(PlayerId: PlayerId): TurnResult {
    return {
      PlayerId,
      Mode: DiceMode.None,
      Dice: null,
      DevOutcome: null,
      OccupationDelta: null,
      Robbery: null,
      Collapse: null,
      IsOverload: false,
      NeedsRelaunchNext: false,
      RoundIndex: this._RoundIndex,
      FirstPlayerIndex: this._FirstPlayerIndex,
      LeaderTax: null,
      SprintBonus: 0,
      Revenge: null,
    };
  }

  private ToSnapshot(P: InternalPlayer): PlayerSnapshot {
    return {
      Id: P.Id,
      PrivateTerritory: P.PrivateTerritory,
      ConsecutiveDoubles: P.ConsecutiveDoubles,
      Status: P.Status,
      IsLaunched: P.IsLaunched,
      IsWasteland: P.IsWasteland,
      RevengeToken: P.RevengeToken,
    };
  }
}
