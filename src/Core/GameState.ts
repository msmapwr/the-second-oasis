/**
 * src/Core/GameState.ts
 * 操作类型：修改
 *
 * 核心状态机——编排所有 Core 模块，驱动完整对局
 * 关联规则：计划书 §6 回合流程（全局编排）+ v1.2 变体包 + v1.3 技能卡罗牌
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
import { CardEngine } from './Card/CardEngine';
import type { CardInstance, DeckSnapshot } from '@/Types/Card';
import { DiceMode } from '@/Types/Dice';
import { PlayerStatus } from '@/Types/Player';
import { RobberyRole } from '@/Types/Robbery';
import type { PlayerId, PlayerSnapshot } from '@/Types/Player';
import type { TerritorySnapshot } from '@/Types/Territory';
import type { GameConfig } from '@/Types/GameConfig';
import { GamePhase } from '@/Types/GamePhase';
import type { TurnResult, LeaderTaxRecord, CardPlayedRecord } from '@/Types/Turn';
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
  private readonly _CardEngine: CardEngine;
  private readonly _CardEnabled: boolean;

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
  private _PendingCard: CardPlayedRecord | null = null;
  private _PendingRobberyTurn: TurnResult | null = null;
  private _CardsDealt: boolean = false;

  private _PendingCounters: Array<{
    readonly OwnerId: PlayerId;
    readonly CardId: string;
    readonly Mechanic: string;
    readonly TargetId: PlayerId | null;
    readonly ApSpent: number;
  }> = [];

  private _ForcedModes: Map<PlayerId, DiceMode> = new Map();
  private _TerritoryFloors: Map<PlayerId, number> = new Map();
  private _TerritoryShields: Set<PlayerId> = new Set();
  private _AbsoluteShields: Set<PlayerId> = new Set();
  private _ApDiscountActive: boolean = false;
  private _FirstCardFreeThisRound: boolean = true;
  private _ExtraTurnPending: boolean = false;
  private _PersistentRawGain: boolean = false;

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
    this._CardEngine = new CardEngine(new SeededRandom(Config.Seed + 0x5c4d));
    this._CardEnabled = Config.EnableSkillCards;

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

  get CardEnabled(): boolean {
    return this._CardEnabled;
  }

  GetCardHand(PlayerId: PlayerId): readonly CardInstance[] {
    return this._CardEngine.GetHand(PlayerId);
  }

  GetCardSnapshot(): DeckSnapshot {
    return this._CardEngine.GetSnapshot();
  }

  GetCardActiveConstants(): number {
    return this._CardEngine.GetActiveConstants().length;
  }

  GetPendingCounters(): number {
    return this._PendingCounters.length;
  }

  ScryTopCards(Count: number): readonly CardInstance[] {
    return this._CardEngine.PeekTop(Count);
  }

  ScryPickCard(PlayerId: PlayerId, InstanceId: number): boolean {
    const AllTop = this._CardEngine.PeekTop(100);
    const Target = AllTop.find((C) => C.InstanceId === InstanceId);
    if (!Target) return false;

    const Remaining = AllTop.filter((C) => C.InstanceId !== InstanceId);
    const Hand = this._CardEngine.GetHand(PlayerId);
    if (Hand.length >= 3) {
      this._CardEngine.PutOnTop(Remaining);
      return false;
    }

    this._CardEngine.PutOnTop(Remaining);
    const Drawn = this._CardEngine.DrawCards(PlayerId, 1);
    return Drawn.length > 0;
  }

  ScryArrangeTop(CardIds: string[]): void {
    const AllTop = this._CardEngine.PeekTop(100);
    const Reordered = CardIds
      .map((Id) => AllTop.find((C) => C.Definition.Id === Id))
      .filter((C): C is CardInstance => C !== undefined);
    const Remaining = AllTop.filter((C) => !CardIds.includes(C.Definition.Id));
    this._CardEngine.PutOnTop([...Remaining, ...Reordered]);
  }

  GetPendingCard(): CardPlayedRecord | null {
    return this._PendingCard;
  }

  GetCardPlayableCards(PlayerId: PlayerId): CardInstance[] {
    const Player = this._Players[PlayerId];
    if (!Player) return [];
    const Phase = this._CardEnabled ? 'SelectMode' : '';
    return this._CardEngine.GetPlayableCards(PlayerId, Phase, Player.PrivateTerritory);
  }

  CanPlayCard(PlayerId: PlayerId, InstanceId: number): boolean {
    if (!this._CardEnabled) return false;
    const PhaseOk = this._Phase === GamePhase.SelectMode || this._Phase === GamePhase.LaunchPhase;
    if (!PhaseOk) return false;
    const Player = this._Players[PlayerId];
    if (!Player) return false;
    const PhaseStr = this._Phase === GamePhase.LaunchPhase ? 'LaunchPhase' : 'SelectMode';
    return this._CardEngine.CanPlayCard(PlayerId, InstanceId, PhaseStr, Player.PrivateTerritory);
  }

  /**
   * 使用卡牌——在 SelectMode 或 LaunchPhase 阶段
   */
  UseCard(PlayerId: PlayerId, InstanceId: number, TargetPlayerId: PlayerId | null): CardPlayedRecord | null {
    if (!this._CardEnabled) return null;
    if (this._Phase !== GamePhase.SelectMode && this._Phase !== GamePhase.LaunchPhase) return null;

    const Player = this._Players[PlayerId];
    if (!Player || Player.Status === PlayerStatus.Eliminated) return null;

    const Hand = this._CardEngine.GetHand(PlayerId);
    const CardInst = Hand.find((C) => C.InstanceId === InstanceId);
    if (!CardInst) return null;

    const Def = CardInst.Definition;

    if (Player.PrivateTerritory < Def.ApCost && !this._FirstCardFreeThisRound) return null;

    const IsLaunchPhase = this._Phase === GamePhase.LaunchPhase;
    if (IsLaunchPhase && Def.EffectPhase !== 'LaunchPhase') return null;
    if (!IsLaunchPhase && Def.EffectPhase === 'LaunchPhase') return null;

    const PhaseStr = IsLaunchPhase ? 'LaunchPhase' : (Def.Type === 'Counter' ? 'CounterWindow' : 'SelectMode');
    const CanPlay = this._CardEngine.CanPlayCard(PlayerId, InstanceId, PhaseStr, Player.PrivateTerritory);
    if (!CanPlay) return null;

    let EffectiveTarget = TargetPlayerId;
    if (EffectiveTarget === null) {
      EffectiveTarget = this.AutoSelectTarget(PlayerId, Def.EffectTarget);
    }

    const UsageResult = this._CardEngine.PlayCard(PlayerId, InstanceId, EffectiveTarget);
    if (!UsageResult) return null;

    const ActualApCost = (Def.EffectMechanic === 'FirstCardFree' || this._FirstCardFreeThisRound)
      ? 0 : (this._ApDiscountActive ? Math.max(1, Def.ApCost - 1) : Def.ApCost);

    if (this._FirstCardFreeThisRound && ActualApCost > 0) {
      this._FirstCardFreeThisRound = false;
    }

    Player.PrivateTerritory -= ActualApCost;
    this._PublicTerritory += ActualApCost;

    if (Def.EffectMechanic === 'ApRefund') {
      const Refund = Math.floor(ActualApCost / 2);
      this._PublicTerritory -= Refund;
      Player.PrivateTerritory += Refund;
    }

    if (this._ApDiscountActive) {
      Player.PrivateTerritory += 1;
      this._PublicTerritory -= 1;
    }

    this.ApplyCardImmediateEffect(Def, PlayerId, EffectiveTarget);

    const Record: CardPlayedRecord = {
      CardId: Def.Id,
      CardNameCn: Def.NameCn,
      CardType: Def.Type,
      EffectMechanic: Def.EffectMechanic,
      ApSpent: Def.ApCost,
      TargetPlayerId: EffectiveTarget,
    };

    if (Def.Type === 'Counter') {
      this._PendingCounters.push({
        OwnerId: PlayerId,
        CardId: Def.Id,
        Mechanic: Def.EffectMechanic,
        TargetId: EffectiveTarget,
        ApSpent: Def.ApCost,
      });
      return Record;
    }

    const DiceMechanics = [
      'Reroll', 'SetDie', 'SetDieTo6', 'SelectiveReroll', 'SetMinimum',
      'ChooseExactDice', 'BestOfTwoModes', 'ForceDouble', 'ConditionalForceDouble',
      'RawGainBonus', 'TripleRawGain', 'GainAndDraw', 'DevChainProtect', 'ChaosRawGain',
      'SkipTurn', 'ExtraTurn', 'ModeLock', 'ForceAggressive', 'RerollTarget',
      'PersistentRawGain', 'Redistribute',
    ];
    if (DiceMechanics.includes(Def.EffectMechanic)) {
      this._PendingCard = Record;
    }

    return Record;
  }

  /**
   * 应用卡牌的即时效果（不依赖骰子的领土变动）
   */
  private ApplyCardImmediateEffect(
    Def: { readonly EffectMechanic: string; readonly ZeroSum: boolean },
    PlayerId: PlayerId,
    TargetId: PlayerId | null,
  ): void {
    const Self = this._Players[PlayerId];

    switch (Def.EffectMechanic) {
      case 'TerritoryGain': {
        const Gain = Math.min(3, this._PublicTerritory);
        this._PublicTerritory -= Gain;
        Self.PrivateTerritory += Gain;
        break;
      }
      case 'PureHeal': {
        Self.PrivateTerritory += 3;
        break;
      }
      case 'MassDrain': {
        const Drain = Math.min(5, this._PublicTerritory);
        this._PublicTerritory -= Drain;
        Self.PrivateTerritory += Drain;
        break;
      }
      case 'Steal': {
        if (TargetId === null) break;
        const Target = this._Players[TargetId];
        if (!Target || Target.Status === PlayerStatus.Eliminated) break;
        const Amount = Math.min(3, Target.PrivateTerritory);
        Target.PrivateTerritory -= Amount;
        Self.PrivateTerritory += Amount;
        break;
      }
      case 'SacrificeForBonus': {
        const Loss = Math.min(2, Self.PrivateTerritory);
        Self.PrivateTerritory -= Loss;
        this._PublicTerritory += Loss;
        break;
      }
      case 'SacrificeForImmunity': {
        const Loss = Math.min(1, Self.PrivateTerritory);
        Self.PrivateTerritory -= Loss;
        this._PublicTerritory += Loss;
        break;
      }
      case 'Balance': {
        if (TargetId === null) break;
        const T = this._Players[TargetId];
        if (!T || T.Status === PlayerStatus.Eliminated) break;
        const Avg = Math.floor((Self.PrivateTerritory + T.PrivateTerritory) / 2);
        const SelfDiff = Avg - Self.PrivateTerritory;
        const TargetDiff = Avg - T.PrivateTerritory;
        Self.PrivateTerritory = Avg;
        T.PrivateTerritory = Avg;
        this._PublicTerritory += 0 - (SelfDiff + TargetDiff);
        break;
      }
      case 'GiftAndDraw': {
        if (TargetId === null) break;
        const T2 = this._Players[TargetId];
        if (!T2 || T2.Status === PlayerStatus.Eliminated) break;
        const Gift = Math.min(1, Self.PrivateTerritory);
        Self.PrivateTerritory -= Gift;
        T2.PrivateTerritory += Gift;
        this._CardEngine.DrawCards(PlayerId, 2);
        break;
      }
      case 'RemoveWasteland': {
        if (Self.Status === PlayerStatus.NeedsRelaunch && Self.IsWasteland) {
          Self.Status = PlayerStatus.Active;
          Self.IsWasteland = false;
        }
        break;
      }
      case 'ForceCollapse': {
        const Snapshot = this.Snapshot.Players;
        const Result = this._Collapse.Resolve(PlayerId, Snapshot, 5, this._PublicTerritory);
        for (const Loss of Result.PlayerLosses) {
          this._Players[Loss.Id].PrivateTerritory += this.ApplyTerritoryProtection(
            Loss.Id,
            Loss.AfterPrivate - this._Players[Loss.Id].PrivateTerritory,
          );
        }
        this._PublicTerritory += Result.PublicDelta;
        break;
      }
      case 'ResetAllChains': {
        for (const Chain of this._DevChains.values()) {
          Chain.Reset();
        }
        break;
      }
      case 'CatchupHeal': {
        for (const P of this._Players) {
          if (P.Status === PlayerStatus.Eliminated) continue;
          if (P.PrivateTerritory <= 2) {
            const Heal = Math.min(2 - P.PrivateTerritory, this._PublicTerritory);
            this._PublicTerritory -= Heal;
            P.PrivateTerritory += Heal;
          }
        }
        break;
      }
      case 'GlobalHeal': {
        for (const P of this._Players) {
          if (P.Status === PlayerStatus.Eliminated) continue;
          const Heal = Math.min(1, this._PublicTerritory);
          this._PublicTerritory -= Heal;
          P.PrivateTerritory += Heal;
        }
        break;
      }
      case 'ModeLock': {
        if (TargetId !== null) {
          this._ForcedModes.set(TargetId, DiceMode.Steady);
        }
        break;
      }
      case 'ForceAggressive': {
        if (TargetId !== null) {
          this._ForcedModes.set(TargetId, DiceMode.Aggressive);
        }
        break;
      }
      case 'SwapTerritory': {
        if (TargetId === null) break;
        const T3 = this._Players[TargetId];
        if (!T3 || T3.Status === PlayerStatus.Eliminated) break;
        if (Self.PrivateTerritory < 1 || T3.PrivateTerritory < 1) break;
        Self.PrivateTerritory -= 1;
        T3.PrivateTerritory -= 1;
        Self.PrivateTerritory += 1;
        T3.PrivateTerritory += 1;
        break;
      }
      case 'BranchingEffect': {
        if (TargetId === null) {
          const Gain = Math.min(2, this._PublicTerritory);
          this._PublicTerritory -= Gain;
          Self.PrivateTerritory += Gain;
        } else {
          const T4 = this._Players[TargetId];
          if (T4 && T4.Status !== PlayerStatus.Eliminated) {
            const Loss = Math.min(1, T4.PrivateTerritory);
            T4.PrivateTerritory -= Loss;
            this._PublicTerritory += Loss;
          }
        }
        break;
      }
      case 'PeekHand': {
        break;
      }
      case 'LaunchThresholdReduction': {
        break;
      }
      case 'ApRefund': {
        break;
      }
      case 'AbsoluteShield': {
        this._AbsoluteShields.add(PlayerId);
        break;
      }
      case 'TerritoryShield': {
        this._TerritoryShields.add(PlayerId);
        break;
      }
      case 'TerritoryFloor': {
        this._TerritoryFloors.set(PlayerId, this._Players[PlayerId].PrivateTerritory);
        break;
      }
      case 'ExtraTurn': {
        this._ExtraTurnPending = true;
        break;
      }
      case 'ApDiscount': {
        this._ApDiscountActive = true;
        break;
      }
      case 'ApRefund': {
        break;
      }
      case 'CounterCostPenalty': {
        break;
      }
      case 'PersistentRawGain': {
        this._PersistentRawGain = true;
        break;
      }
      default:
        break;
    }
  }

  Start(): void {
    this._Phase = GamePhase.LaunchPhase;
    this._CurrentPlayerIndex = 0;
    this._RoundIndex = 0;
    this._FirstPlayerIndex = 0;
    this._CardsDealt = false;

    if (this._CardEnabled) {
      this._CardEngine.Initialize(this._Config.PlayerCount);
    }
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
        CardPlayed: null,
      };
      this._TurnHistory.push(Turn);
      return Turn;
    }

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
    this._PendingRobberyTurn = Turn;
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

    const ForcedMode = this._ForcedModes.get(PlayerId);
    const EffectiveMode = ForcedMode !== undefined ? ForcedMode : Mode;
    if (ForcedMode !== undefined) {
      this._ForcedModes.delete(PlayerId);
    }

    if (EffectiveMode === DiceMode.None && this._PendingRobberyTurn !== null) {
      const Turn = this._PendingRobberyTurn;
      this._PendingRobberyTurn = null;
      this.AdvanceToNextPlayer();
      return Turn;
    }

    if (EffectiveMode === DiceMode.Revenge) {
      return this.PlayRevengeTurn(PlayerId);
    }

    if (this._PendingCard !== null && this._PendingCard.EffectMechanic === 'SkipTurn') {
      const CardRecord = this._PendingCard;
      this._PendingCard = null;
      const Turn: TurnResult = {
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
        CardPlayed: CardRecord,
      };
      this._TurnHistory.push(Turn);
      this.AdvanceToNextPlayer();
      return Turn;
    }

    const Dice = this._Dice.Roll(EffectiveMode);
    const PendingCard = this._PendingCard;
    this._PendingCard = null;
    let ModifiedDice = this.ApplyCardDiceModifiers(Dice, PendingCard, PlayerId);

    if (this._PersistentRawGain && ModifiedDice.RawGain > 0 && !ModifiedDice.IsDeducted) {
      ModifiedDice = { ...ModifiedDice, RawGain: ModifiedDice.RawGain + 1, Sum: ModifiedDice.Sum + 1 };
    }

    let EffectiveIsDouble = ModifiedDice.IsDouble;
    if (PendingCard !== null) {
      if (PendingCard.EffectMechanic === 'ForceDouble' ||
          PendingCard.EffectMechanic === 'ConditionalForceDouble') {
        EffectiveIsDouble = true;
      }
    }

    const Constants = this._CardEngine.GetActiveConstantsForPlayer(PlayerId);
    const HasDevChainProtect = Constants.some(
      (Ac) => Ac.Card.Definition.EffectMechanic === 'DevChainProtect',
    );

    const Chain = this._DevChains.get(PlayerId)!;
    const SavedConsecutive = Chain.ConsecutiveDoubles;
    const DevOutcome = Chain.Advance(EffectiveIsDouble, Mode);

    let FinalDevOutcome = DevOutcome;
    if (HasDevChainProtect && !DevOutcome.IsOverload &&
        DevOutcome.NewConsecutiveDoubles === 0 && SavedConsecutive > 0) {
      Chain.Reset();
      for (let I = 0; I < SavedConsecutive; I++) {
        Chain.Advance(true, DiceMode.Aggressive);
      }
      FinalDevOutcome = {
        Multiplier: SavedConsecutive === 2 ? 3 as const : 2 as const,
        IsOverload: false,
        NewConsecutiveDoubles: SavedConsecutive,
      };
    }

    if (FinalDevOutcome.IsOverload) {
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
        DevOutcome: FinalDevOutcome,
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
        CardPlayed: PendingCard ?? null,
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
    const SprintBonus = this.CalculateSprintBonus(ModifiedDice.RawGain);
    const Occ = this._Occupation.Calculate(
      PublicBefore,
      PrivateBefore,
      ModifiedDice.RawGain,
      FinalDevOutcome.Multiplier,
      SprintBonus,
    );

    this._PublicTerritory = Occ.PublicAfter;
    const ProtectedDelta = this.ApplyTerritoryProtection(PlayerId, Occ.PrivateDelta);
    Player.PrivateTerritory += ProtectedDelta;

    const ActiveConsts = this._CardEngine.GetActiveConstantsForPlayer(PlayerId);
    for (const Ac of ActiveConsts) {
      const Mech = Ac.Card.Definition.EffectMechanic;
      if (Mech === 'OccupationBonus' && Occ.PrivateDelta > 0) {
        Player.PrivateTerritory += 1;
      }
      if (Mech === 'MirrorGain' && Occ.PrivateDelta > 0) {
        Player.PrivateTerritory += 1;
      }
    }
    Player.ConsecutiveDoubles = FinalDevOutcome.NewConsecutiveDoubles;
    this.CheckAndApplyElimination();
    if ((this._Phase as GamePhase) === GamePhase.GameOver) {
      const SkipTurn: TurnResult = {
        PlayerId,
        Mode,
        Dice: Mode === DiceMode.None ? null : Dice,
        DevOutcome: FinalDevOutcome,
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
        CardPlayed: PendingCard ?? null,
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
      Mode: EffectiveMode,
      Dice: Mode === DiceMode.None ? null : ModifiedDice,
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
      CardPlayed: PendingCard ?? null,
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
        CardPlayed: null,
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
      CardPlayed: null,
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

  private ApplyCollapseCounters(
    Result: NonNullable<TurnResult['Collapse']>,
    _InitiatorId: PlayerId,
  ): NonNullable<TurnResult['Collapse']> {
    const Consumed: number[] = [];

    for (let I = 0; I < this._PendingCounters.length; I++) {
      const C = this._PendingCounters[I];
      switch (C.Mechanic) {
        case 'CollapseReduction': {
          const LossEntry = Result.PlayerLosses.find((L) => L.Id === C.OwnerId);
          if (LossEntry) {
            const Reduction = Math.min(2, LossEntry.ActualLoss);
            const NewAfter = LossEntry.AfterPrivate + Reduction;
            const NewLosses = Result.PlayerLosses.map((L) =>
              L.Id === C.OwnerId
                ? { ...L, ActualLoss: L.ActualLoss - Reduction, AfterPrivate: NewAfter }
                : L,
            );
            Result = {
              ...Result,
              PlayerLosses: NewLosses,
              TotalLoss: Result.TotalLoss - Reduction,
              PublicDelta: Result.PublicDelta - Reduction,
            };
            Consumed.push(I);
          }
          break;
        }
        case 'RedirectCollapseLoss': {
          const SelfLoss = Result.PlayerLosses.find((L) => L.Id === C.OwnerId);
          if (SelfLoss && SelfLoss.ActualLoss > 0 && C.TargetId !== null) {
            const Target = this._Players[C.TargetId];
            if (Target && Target.Status !== PlayerStatus.Eliminated) {
              const Transfer = Math.min(SelfLoss.ActualLoss, Target.PrivateTerritory);
              Target.PrivateTerritory -= Transfer;
              const NewSelfAfter = SelfLoss.AfterPrivate + Transfer;
              const NewLosses = Result.PlayerLosses.map((L) =>
                L.Id === C.OwnerId
                  ? { ...L, ActualLoss: L.ActualLoss - Transfer, AfterPrivate: NewSelfAfter }
                  : L,
              );
              Result = {
                ...Result,
                PlayerLosses: NewLosses,
                PublicDelta: Result.PublicDelta - Transfer,
              };
              Consumed.push(I);
            }
          }
          break;
        }
        case 'FullNegate': {
          const SelfLoss = Result.PlayerLosses.find((L) => L.Id === C.OwnerId);
          if (SelfLoss && SelfLoss.ActualLoss > 0) {
            const NewAfter = SelfLoss.AfterPrivate + SelfLoss.ActualLoss;
            const NewLosses = Result.PlayerLosses.map((L) =>
              L.Id === C.OwnerId
                ? { ...L, ActualLoss: 0, AfterPrivate: NewAfter }
                : L,
            );
            Result = {
              ...Result,
              PlayerLosses: NewLosses,
              TotalLoss: Result.TotalLoss - SelfLoss.ActualLoss,
              PublicDelta: Result.PublicDelta - SelfLoss.ActualLoss,
            };
            Consumed.push(I);
          }
          break;
        }
        default:
          break;
      }
    }

    for (let I = Consumed.length - 1; I >= 0; I--) {
      this._PendingCounters.splice(Consumed[I], 1);
    }

    return Result;
  }

  private ResolveRobbery(
    InitiatorId: PlayerId,
    OverflowM2: number,
  ): NonNullable<TurnResult['Robbery']> {
    const SnapshotPlayers = this.Snapshot.Players;
    let Result = this._Robbery.Resolve(InitiatorId, SnapshotPlayers, OverflowM2);

    Result = this.ApplyRobberyCounters(Result, InitiatorId);

    const ProtectedInitDelta = this.ApplyTerritoryProtection(InitiatorId, Result.InitiatorDelta);
    const ProtectedDefDelta = this.ApplyTerritoryProtection(Result.Defender, Result.DefenderDelta);
    this._Players[InitiatorId].PrivateTerritory += ProtectedInitDelta;
    this._Players[Result.Defender].PrivateTerritory += ProtectedDefDelta;
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

  private ApplyRobberyCounters(
    Result: NonNullable<TurnResult['Robbery']>,
    InitiatorId: PlayerId,
  ): NonNullable<TurnResult['Robbery']> {
    const DefenderId = Result.Defender;
    const Consumed: number[] = [];

    for (let I = 0; I < this._PendingCounters.length; I++) {
      const C = this._PendingCounters[I];
      switch (C.Mechanic) {
        case 'ExtraLoss': {
          const InitiatorLoss = Math.min(1, this._Players[InitiatorId].PrivateTerritory);
          const DefenderLoss = Math.min(1, this._Players[DefenderId].PrivateTerritory);
          this._Players[InitiatorId].PrivateTerritory -= InitiatorLoss;
          this._Players[DefenderId].PrivateTerritory -= DefenderLoss;
          this._PublicTerritory += InitiatorLoss + DefenderLoss;
          Consumed.push(I);
          break;
        }
        case 'RobberyDefenseBonus': {
          if (C.OwnerId === DefenderId) {
            const Bonus = 3;
            const NewInitiatorDelta = Result.InitiatorDelta > 0 ? Result.InitiatorDelta - Bonus : Result.InitiatorDelta;
            const NewDefenderDelta = Result.DefenderDelta + Bonus;
            Result = {
              ...Result,
              InitiatorDelta: Math.min(NewInitiatorDelta, 0),
              DefenderDelta: NewDefenderDelta,
              PublicDelta: Result.PublicDelta - Bonus,
            };
            Consumed.push(I);
          }
          break;
        }
        case 'SwapRobberyDice': {
          if (C.OwnerId === DefenderId) {
            const Swapped = { ...Result, InitiatorDelta: Result.DefenderDelta, DefenderDelta: Result.InitiatorDelta };
            if (Result.Winner === 'Initiator') {
              Result = { ...Swapped, Winner: RobberyRole.Defender };
            } else {
              Result = { ...Swapped, Winner: RobberyRole.Initiator };
            }
            Consumed.push(I);
          }
          break;
        }
        default:
          break;
      }
    }

    for (let I = Consumed.length - 1; I >= 0; I--) {
      this._PendingCounters.splice(Consumed[I], 1);
    }

    return Result;
  }

  private ResolveCollapse(
    InitiatorId: PlayerId,
    OverflowM2: number,
  ): NonNullable<TurnResult['Collapse']> {
    let Result = this._Collapse.Resolve(
      InitiatorId,
      this.Snapshot.Players,
      OverflowM2,
      this._PublicTerritory,
    );

    Result = this.ApplyCollapseCounters(Result, InitiatorId);

    for (const Loss of Result.PlayerLosses) {
      this._Players[Loss.Id].PrivateTerritory += this.ApplyTerritoryProtection(
        Loss.Id,
        Loss.AfterPrivate - this._Players[Loss.Id].PrivateTerritory,
      );
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

    if (this._CardEnabled && !this._CardsDealt) {
      this.DealCardsAtRoundStart();
    }
  }

  private AdvanceToNextPlayer(): void {
    if (this._ExtraTurnPending) {
      this._ExtraTurnPending = false;
      return;
    }

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

      if (this._CardEnabled) {
        this.DealCardsAtRoundStart();
      }
    }

    this._CurrentPlayerIndex = NextIndex;

    this._AbsoluteShields.clear();
    this._FirstCardFreeThisRound = true;
    this._PersistentRawGain = false;

    const Next = this._Players[this._CurrentPlayerIndex];
    if (Next.Status === PlayerStatus.Eliminated) {
      if (this.CountActivePlayers() <= 1) {
        this.EnterGameOver();
        return;
      }
      this.AdvanceToNextPlayer();
      return;
    }

    if (this._CardEnabled) {
      this._CardEngine.TickConstants(Next.Id);
    }

    if (!Next.IsLaunched || Next.Status === PlayerStatus.NeedsRelaunch) {
      this._Phase = GamePhase.LaunchPhase;
    } else {
      this._Phase = GamePhase.SelectMode;
    }
  }

  private ApplyCardDiceModifiers(
    Dice: ReturnType<DiceRoller['Roll']>,
    PendingCard: CardPlayedRecord | null,
    PlayerId: PlayerId,
  ): ReturnType<DiceRoller['Roll']> {
    if (PendingCard === null) return Dice;

    const Mech = PendingCard.EffectMechanic;

    switch (Mech) {
      case 'RawGainBonus':
        return { ...Dice, RawGain: Dice.RawGain + 2 };

      case 'TripleRawGain':
        return { ...Dice, RawGain: Dice.RawGain * 3 };

      case 'ChaosRawGain': {
        const Direction = this._Random.NextInt(0, 1) === 0 ? -1 : 1;
        return { ...Dice, RawGain: Dice.RawGain + Direction };
      }

      case 'SetDieTo6':
        if (Dice.Dice.length === 1) {
          return { ...Dice, Dice: [6], Sum: 6, IsDouble: false, IsDeducted: false, RawGain: 6 };
        }
        return { ...Dice, Dice: [Dice.Dice[0] === 1 ? 6 : Dice.Dice[0], Dice.Dice[0] === 1 ? Dice.Dice[1] : 6] as [1|2|3|4|5|6, 1|2|3|4|5|6], Sum: Dice.Sum + (6 - (Dice.Dice[0] === 1 ? Dice.Dice[0] : Dice.Dice[1])), IsDouble: Dice.Dice[0] === Dice.Dice[1], RawGain: Dice.RawGain + (6 - (Dice.Dice[0] === 1 ? Dice.Dice[0] : Dice.Dice[1])) };

      case 'SetMinimum':
        if (Dice.Sum <= 3) {
          return { ...Dice, Sum: 4, RawGain: Dice.IsDeducted ? -4 : 4 };
        }
        return Dice;

      case 'Reroll': {
        const NewDice = this._Dice.Roll(Dice.Mode);
        return NewDice;
      }

      case 'SelectiveReroll': {
        const FreshDice = this._Dice.Roll(Dice.Mode);
        return FreshDice.RawGain > Dice.RawGain ? FreshDice : Dice;
      }

      case 'GainAndDraw': {
        this._CardEngine.DrawCards(PlayerId, 1);
        return { ...Dice, RawGain: Dice.RawGain + 1 };
      }

      case 'BestOfTwoModes': {
        const SteadyRoll = this._Dice.Roll(DiceMode.Steady);
        const AggressiveRoll = this._Dice.Roll(DiceMode.Aggressive);
        const Best = SteadyRoll.RawGain >= AggressiveRoll.RawGain ? SteadyRoll : AggressiveRoll;
        return Best;
      }

      case 'ChooseExactDice': {
        if (Dice.Dice.length >= 2) {
          return { ...Dice, Dice: [6, 6] as [1|2|3|4|5|6, 1|2|3|4|5|6], Sum: 12, IsDouble: true, IsDeducted: false, RawGain: 12 };
        }
        return { ...Dice, Dice: [6], Sum: 6, IsDouble: false, IsDeducted: false, RawGain: 6 };
      }

      case 'SetDie': {
        if (Dice.Dice.length >= 2) {
          return { ...Dice, Dice: [6, Dice.Dice[1]] as [1|2|3|4|5|6, 1|2|3|4|5|6], Sum: 6 + Dice.Dice[1], IsDouble: 6 === Dice.Dice[1], IsDeducted: (6 + Dice.Dice[1]) <= 6, RawGain: Dice.IsDeducted ? -(6 + Dice.Dice[1]) : (6 + Dice.Dice[1]) };
        }
        return { ...Dice, Dice: [6], Sum: 6, IsDouble: false, IsDeducted: false, RawGain: 6 };
      }

      default:
        return Dice;
    }
  }

  private GetRichestOther(SelfId: PlayerId): PlayerId {
    let Best: PlayerId | null = null;
    let BestPrivate = -1;
    for (const P of this._Players) {
      if (P.Id === SelfId || P.Status === PlayerStatus.Eliminated) continue;
      if (P.PrivateTerritory > BestPrivate) {
        BestPrivate = P.PrivateTerritory;
        Best = P.Id;
      }
    }
    return Best ?? ((SelfId + 1) % this._Config.PlayerCount);
  }

  private ApplyTerritoryProtection(PlayerId: PlayerId, ProposedDelta: number): number {
    if (this._AbsoluteShields.has(PlayerId)) {
      this._AbsoluteShields.delete(PlayerId);
      return ProposedDelta > 0 ? ProposedDelta : 0;
    }

    if (this._TerritoryShields.has(PlayerId) && ProposedDelta < 0) {
      this._TerritoryShields.delete(PlayerId);
      return 0;
    }

    const Floor = this._TerritoryFloors.get(PlayerId);
    if (Floor !== undefined && ProposedDelta < 0) {
      const PlayerTerritory = this._Players[PlayerId].PrivateTerritory;
      const After = PlayerTerritory + ProposedDelta;
      if (After < Floor) {
        return Floor - PlayerTerritory;
      }
    }

    return ProposedDelta;
  }

  private AutoSelectTarget(SelfId: PlayerId, Target: string): PlayerId | null {
    switch (Target) {
      case 'SingleEnemy':
      case 'AnyPlayer':
      case 'RichestOther':
        return this.GetRichestOther(SelfId);
      case 'Self':
        return SelfId;
      case 'Choice':
        return null;
      default:
        return null;
    }
  }

  private DealCardsAtRoundStart(): void {
    const ActiveIds: PlayerId[] = [];
    for (const P of this._Players) {
      if (P.Status !== PlayerStatus.Eliminated) {
        ActiveIds.push(P.Id);
      }
    }
    this._CardEngine.DealToAll(ActiveIds);
    this._CardsDealt = true;
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
