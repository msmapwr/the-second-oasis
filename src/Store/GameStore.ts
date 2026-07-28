/**
 * src/Store/GameStore.ts
 * 操作类型：修改
 *
 * 响应式适配层：包装 GameState，把 pull-based 命令-查询转成事件流
 * 关联：B 阶段架构方案 §3.3
 */
import { GameState } from '@/Core/GameState';
import type { GameConfig } from '@/Types/GameConfig';
import { GamePhase } from '@/Types/GamePhase';
import type { PlayerId } from '@/Types/Player';
import type { TerritorySnapshot } from '@/Types/Territory';
import type { DiceMode } from '@/Types/Dice';
import type { LaunchResult } from '@/Types/Launch';
import type { TurnResult } from '@/Types/Turn';
import type { CardPlayedRecord } from '@/Types/Turn';
import type { CardInstance, DeckSnapshot } from '@/Types/Card';
import type { TiebreakerRound, GameResult } from '@/Types/GameResult';
import { EventEmitter, type Listener } from './EventEmitter';

export type StoreEvents = {
  PhaseChange: { From: GamePhase; To: GamePhase };
  Snapshot: TerritorySnapshot;
  Launch: { Result: LaunchResult; Snapshot: TerritorySnapshot };
  Turn: { Result: TurnResult; Snapshot: TerritorySnapshot };
  Tiebreaker: { Round: TiebreakerRound; Snapshot: TerritorySnapshot };
  GameOver: GameResult;
  RoundChange: { RoundIndex: number; FirstPlayerIndex: PlayerId };
  CardUsed: { CardType: string; Snapshot: TerritorySnapshot };
  DeckShuffled: void;
}

export interface IGameStore {
  readonly Phase: GamePhase;
  readonly CurrentPlayer: PlayerId;
  readonly IsOver: boolean;
  readonly Result: GameResult | null;
  readonly Snapshot: TerritorySnapshot;
  readonly RobberyTriggeredCount: number;
  readonly CollapseX: number;
  readonly RoundIndex: number;
  readonly FirstPlayerIndex: PlayerId;
  GetConsecutiveDoubles(Id: PlayerId): number;
  SetRevengeTarget(TargetId: PlayerId): void;
  Forfeit(PlayerId: PlayerId): void;
  InitiateRobbery(InitiatorId: PlayerId, TargetId: PlayerId): TurnResult | null;

  Start(): void;
  AttemptLaunch(): LaunchResult;
  PlayTurn(Mode: DiceMode): TurnResult;
  RunTiebreaker(): TiebreakerRound;

  StartAsync(): Promise<void>;
  AttemptLaunchAsync(): Promise<LaunchResult>;
  PlayTurnAsync(Mode: DiceMode): Promise<TurnResult>;
  RunTiebreakerAsync(): Promise<TiebreakerRound>;

  On<K extends keyof StoreEvents>(Type: K, Fn: Listener<StoreEvents[K]>): () => void;

  CardEnabled: boolean;
  GetCardHand(PlayerId: PlayerId): readonly CardInstance[];
  GetCardSnapshot(): DeckSnapshot;
  GetCardPlayableCards(PlayerId: PlayerId): CardInstance[];
  CanPlayCard(PlayerId: PlayerId, InstanceId: number): boolean;
  UseCard(PlayerId: PlayerId, InstanceId: number, TargetPlayerId: PlayerId | null): CardPlayedRecord | null;
  GetCardActiveConstants(): number;
  ScryTopCards(Count: number): readonly CardInstance[];
  ScryPickCard(PlayerId: PlayerId, InstanceId: number): boolean;
  ScryArrangeTop(CardIds: string[]): void;
}

export class GameStore extends EventEmitter<StoreEvents> implements IGameStore {
  private readonly _State: GameState;
  private _LastPhase: GamePhase;
  private _LastRoundIndex: number;
  private _LastFirstPlayerIndex: PlayerId;

  constructor(Config: GameConfig) {
    super();
    this._State = new GameState(Config);
    this._LastPhase = this._State.Phase;
    this._LastRoundIndex = this._State.RoundIndex;
    this._LastFirstPlayerIndex = this._State.FirstPlayerIndex;
  }

  get Phase(): GamePhase {
    return this._State.Phase;
  }

  get CurrentPlayer(): PlayerId {
    return this._State.CurrentPlayer;
  }

  get IsOver(): boolean {
    return this._State.IsOver;
  }

  get Result(): GameResult | null {
    return this._State.Result;
  }

  get Snapshot(): TerritorySnapshot {
    return this._State.Snapshot;
  }

  get RobberyTriggeredCount(): number {
    return this._State.RobberyTriggeredCount;
  }

  get CollapseX(): number {
    return this._State.CollapseX;
  }

  get RoundIndex(): number {
    return this._State.RoundIndex;
  }

  get FirstPlayerIndex(): PlayerId {
    return this._State.FirstPlayerIndex;
  }

  GetConsecutiveDoubles(Id: PlayerId): number {
    return this._State.GetConsecutiveDoubles(Id);
  }

  SetRevengeTarget(TargetId: PlayerId): void {
    this._State.SetRevengeTarget(TargetId);
  }

  Forfeit(PlayerId: PlayerId): void {
    this._State.Forfeit(PlayerId);
  }

  InitiateRobbery(InitiatorId: PlayerId, TargetId: PlayerId): TurnResult | null {
    return this._State.InitiateRobbery(InitiatorId, TargetId);
  }

  Start(): void {
    this._State.Start();
    this._EmitPhase();
    this._EmitRound();
    this.Emit('Snapshot', this._State.Snapshot);
  }

  AttemptLaunch(): LaunchResult {
    const Result = this._State.AttemptLaunch();
    this._EmitPhase();
    this._EmitRound();
    this.Emit('Launch', { Result, Snapshot: this._State.Snapshot });
    this.Emit('Snapshot', this._State.Snapshot);
    if (this._State.IsOver) {
      this.Emit('GameOver', this._State.Result!);
    }
    return Result;
  }

  PlayTurn(Mode: DiceMode): TurnResult {
    const Result = this._State.PlayTurn(Mode);
    this._EmitPhase();
    this._EmitRound();
    this.Emit('Turn', { Result, Snapshot: this._State.Snapshot });
    this.Emit('Snapshot', this._State.Snapshot);
    if (this._State.IsOver) {
      this.Emit('GameOver', this._State.Result!);
    }
    return Result;
  }

  RunTiebreaker(): TiebreakerRound {
    const Round = this._State.RunTiebreaker();
    this._EmitPhase();
    this._EmitRound();
    this.Emit('Tiebreaker', { Round, Snapshot: this._State.Snapshot });
    this.Emit('Snapshot', this._State.Snapshot);
    if (this._State.IsOver) {
      this.Emit('GameOver', this._State.Result!);
    }
    return Round;
  }

  StartAsync(): Promise<void> {
    this.Start();
    return Promise.resolve();
  }

  AttemptLaunchAsync(): Promise<LaunchResult> {
    return Promise.resolve(this.AttemptLaunch());
  }

  PlayTurnAsync(Mode: DiceMode): Promise<TurnResult> {
    return Promise.resolve(this.PlayTurn(Mode));
  }

  RunTiebreakerAsync(): Promise<TiebreakerRound> {
    return Promise.resolve(this.RunTiebreaker());
  }

  private _EmitPhase(): void {
    const To = this._State.Phase;
    if (To !== this._LastPhase) {
      this.Emit('PhaseChange', { From: this._LastPhase, To });
      this._LastPhase = To;
    }
  }

  private _EmitRound(): void {
    const RoundIndex = this._State.RoundIndex;
    const FirstPlayerIndex = this._State.FirstPlayerIndex;
    if (
      RoundIndex !== this._LastRoundIndex ||
      FirstPlayerIndex !== this._LastFirstPlayerIndex
    ) {
      this.Emit('RoundChange', { RoundIndex, FirstPlayerIndex });
      this._LastRoundIndex = RoundIndex;
      this._LastFirstPlayerIndex = FirstPlayerIndex;
    }
  }

  get CardEnabled(): boolean {
    return this._State.CardEnabled;
  }

  GetCardHand(PlayerId: PlayerId): readonly CardInstance[] {
    return this._State.GetCardHand(PlayerId);
  }

  GetCardSnapshot(): DeckSnapshot {
    return this._State.GetCardSnapshot();
  }

  GetCardPlayableCards(PlayerId: PlayerId): CardInstance[] {
    return this._State.GetCardPlayableCards(PlayerId);
  }

  CanPlayCard(PlayerId: PlayerId, InstanceId: number): boolean {
    return this._State.CanPlayCard(PlayerId, InstanceId);
  }

  UseCard(PlayerId: PlayerId, InstanceId: number, TargetPlayerId: PlayerId | null): CardPlayedRecord | null {
    const Result = this._State.UseCard(PlayerId, InstanceId, TargetPlayerId);
    this.Emit('Snapshot', this._State.Snapshot);
    if (Result) {
      this.Emit('CardUsed', { CardType: Result.CardType, Snapshot: this._State.Snapshot });
    }
    return Result;
  }

  GetCardActiveConstants(): number {
    return this._State.GetCardActiveConstants();
  }

  ScryTopCards(Count: number): readonly CardInstance[] {
    return this._State.ScryTopCards(Count);
  }

  ScryPickCard(PlayerId: PlayerId, InstanceId: number): boolean {
    return this._State.ScryPickCard(PlayerId, InstanceId);
  }

  ScryArrangeTop(CardIds: string[]): void {
    this._State.ScryArrangeTop(CardIds);
  }
}
