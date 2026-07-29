/**
 * src/Store/ReplayEngine.ts
 * 操作类型：新建
 *
 * 回放引擎——基于种子和事件日志确定性地重建对局过程。
 * 实现 IGameStore 接口，供 AnimationCoordinator 和 GameStageView 渲染。
 */

import { GameStore, type IGameStore, type StoreEvents } from '@/Store/GameStore';
import { CreateVariantConfig, CreateDefaultConfig } from '@/Types/GameConfig';
import { GamePhase } from '@/Types/GamePhase';
import type { PlayerId } from '@/Types/Player';
import type { TerritorySnapshot } from '@/Types/Territory';
import type { DiceMode } from '@/Types/Dice';
import type { LaunchResult } from '@/Types/Launch';
import type { TurnResult } from '@/Types/Turn';
import type { CardPlayedRecord } from '@/Types/Turn';
import type { CardInstance, DeckSnapshot } from '@/Types/Card';
import type { TiebreakerRound, GameResult } from '@/Types/GameResult';
import { EventEmitter, type Listener } from '@/Store/EventEmitter';
import type { StoredReplay, ReplayEvent } from '@/Types/Replay';

export class ReplayEngine implements IGameStore {
  private readonly _Replay: StoredReplay;
  private _Store: GameStore;
  private _CurrentIndex = 0;
  /**
   * 引擎自身维护的发射器。
   * 内部 GameStore 在 StepBackward/JumpTo 时会被整体重建（新建实例），
   * 若直接把订阅者的回调挂在内部 store 上，重建后旧 store 被丢弃、订阅失效，
   * 导致回放回退/跳转时界面（GameStageView）不再刷新。
   * 因此这里把内部 store 的事件转发到引擎自己的发射器，重建后只需重新订阅内部 store，
   * 外部订阅者（GameStageView）完全无感。
   */
  private readonly _Emitter = new EventEmitter<StoreEvents>();
  private _Unsub: Array<() => void> = [];

  constructor(Replay: StoredReplay) {
    this._Replay = Replay;
    this._Store = this._CreateStore();
    this._BindStore();
  }

  // ===== 位置信息 =====

  get CurrentIndex(): number {
    return this._CurrentIndex;
  }

  get TotalEvents(): number {
    return this._Replay.events.length;
  }

  get IsAtEnd(): boolean {
    return this._CurrentIndex >= this._Replay.events.length;
  }

  get IsAtStart(): boolean {
    return this._CurrentIndex === 0;
  }

  // ===== IGameStore 代理 =====

  get Phase(): GamePhase {
    return this._Store.Phase;
  }

  get CurrentPlayer(): PlayerId {
    return this._Store.CurrentPlayer;
  }

  get IsOver(): boolean {
    return this._Store.IsOver;
  }

  get Result(): GameResult | null {
    return this._Store.Result;
  }

  get Snapshot(): TerritorySnapshot {
    return this._Store.Snapshot;
  }

  get RobberyTriggeredCount(): number {
    return this._Store.RobberyTriggeredCount;
  }

  get CollapseX(): number {
    return this._Store.CollapseX;
  }

  get RoundIndex(): number {
    return this._Store.RoundIndex;
  }

  get FirstPlayerIndex(): PlayerId {
    return this._Store.FirstPlayerIndex;
  }

  GetConsecutiveDoubles(Id: PlayerId): number {
    return this._Store.GetConsecutiveDoubles(Id);
  }

  SetRevengeTarget(TargetId: PlayerId): void {
    this._Store.SetRevengeTarget(TargetId);
  }

  Forfeit(PlayerId: PlayerId): void {
    this._Store.Forfeit(PlayerId);
  }

  InitiateRobbery(InitiatorId: PlayerId, TargetId: PlayerId): TurnResult | null {
    return this._Store.InitiateRobbery(InitiatorId, TargetId);
  }

  get CardEnabled(): boolean {
    return this._Store.CardEnabled;
  }

  GetCardHand(PlayerId: PlayerId): readonly CardInstance[] {
    return this._Store.GetCardHand(PlayerId);
  }

  GetCardSnapshot(): DeckSnapshot {
    return this._Store.GetCardSnapshot();
  }

  GetCardPlayableCards(PlayerId: PlayerId): CardInstance[] {
    return this._Store.GetCardPlayableCards(PlayerId);
  }

  CanPlayCard(PlayerId: PlayerId, InstanceId: number): boolean {
    return this._Store.CanPlayCard(PlayerId, InstanceId);
  }

  UseCard(PlayerId: PlayerId, InstanceId: number, TargetPlayerId: PlayerId | null): CardPlayedRecord | null {
    return this._Store.UseCard(PlayerId, InstanceId, TargetPlayerId);
  }

  GetCardActiveConstants(): number {
    return this._Store.GetCardActiveConstants();
  }

  ScryTopCards(Count: number): readonly CardInstance[] {
    return this._Store.ScryTopCards(Count);
  }

  ScryPickCard(PlayerId: PlayerId, InstanceId: number): boolean {
    return this._Store.ScryPickCard(PlayerId, InstanceId);
  }

  ScryArrangeTop(CardIds: string[]): void {
    this._Store.ScryArrangeTop(CardIds);
  }

  // ===== 同步方法（回放中不直接调用） =====

  Start(): void {
    // 已通过构造函数完成
  }

  AttemptLaunch(): LaunchResult {
    return this._Store.AttemptLaunch();
  }

  PlayTurn(Mode: DiceMode): TurnResult {
    return this._Store.PlayTurn(Mode);
  }

  RunTiebreaker(): TiebreakerRound {
    return this._Store.RunTiebreaker();
  }

  StartAsync(): Promise<void> {
    return Promise.resolve();
  }

  AttemptLaunchAsync(): Promise<LaunchResult> {
    return Promise.resolve(this._Store.AttemptLaunch());
  }

  PlayTurnAsync(Mode: DiceMode): Promise<TurnResult> {
    return Promise.resolve(this._Store.PlayTurn(Mode));
  }

  RunTiebreakerAsync(): Promise<TiebreakerRound> {
    return Promise.resolve(this._Store.RunTiebreaker());
  }

  On<K extends keyof StoreEvents>(Type: K, Fn: Listener<StoreEvents[K]>): () => void {
    return this._Emitter.On(Type, Fn);
  }

  // ===== 回放操作 =====

  StepForward(): boolean {
    if (this._CurrentIndex >= this._Replay.events.length) return false;

    const Event = this._Replay.events[this._CurrentIndex];
    this._ApplyEvent(Event);
    this._CurrentIndex += 1;
    return true;
  }

  StepBackward(): boolean {
    if (this._CurrentIndex <= 0) return false;

    this._CurrentIndex -= 1;
    this._RebuildFromStart();
    return true;
  }

  JumpTo(Index: number): void {
    const Clamped = Math.max(0, Math.min(Index, this._Replay.events.length));
    this._CurrentIndex = Clamped;
    this._RebuildFromStart();
  }

  // ===== 内部方法 =====

  /**
   * 依据当前种子重建一个全新的内部 GameStore
   */
  private _CreateStore(): GameStore {
    const Config = this._Replay.header.variant
      ? CreateVariantConfig(this._Replay.header.playerCount, this._Replay.header.seed)
      : CreateDefaultConfig(this._Replay.header.playerCount, this._Replay.header.seed);
    const Store = new GameStore(Config);
    Store.Start();
    return Store;
  }

  /**
   * 把内部 GameStore 的事件转发到引擎自己的发射器。
   * 重建内部 store 时只需先解绑再重新调用本方法，外部订阅者不受影响。
   */
  private _BindStore(): void {
    this._Unsub.push(
      this._Store.On('Snapshot', (S) => this._Emitter.Emit('Snapshot', S)),
      this._Store.On('PhaseChange', (P) => this._Emitter.Emit('PhaseChange', P)),
      this._Store.On('RoundChange', (R) => this._Emitter.Emit('RoundChange', R)),
      this._Store.On('Launch', (L) => this._Emitter.Emit('Launch', L)),
      this._Store.On('Turn', (T) => this._Emitter.Emit('Turn', T)),
      this._Store.On('Tiebreaker', (Tb) => this._Emitter.Emit('Tiebreaker', Tb)),
      this._Store.On('CardUsed', (C) => this._Emitter.Emit('CardUsed', C)),
      this._Store.On('GameOver', (G) => this._Emitter.Emit('GameOver', G)),
      this._Store.On('DeckShuffled', () => this._Emitter.Emit('DeckShuffled', undefined)),
    );
  }

  private _RebuildFromStart(): void {
    // 解绑旧内部 store 的转发订阅，避免泄漏
    for (const Unsub of this._Unsub) Unsub();
    this._Unsub = [];

    this._Store = this._CreateStore();
    this._BindStore();

    for (let I = 0; I < this._CurrentIndex; I++) {
      this._ApplyEventTo(this._Store, this._Replay.events[I]);
    }
  }

  private _ApplyEvent(Event: ReplayEvent): void {
    this._ApplyEventTo(this._Store, Event);
  }

  private _ApplyEventTo(Store: GameStore, Event: ReplayEvent): void {
    switch (Event.type) {
      case 'PhaseChange':
        break;
      case 'RoundChange':
        break;
      case 'Launch':
        Store.AttemptLaunch();
        break;
      case 'Turn':
        Store.PlayTurn(Event.payload.Mode);
        break;
      case 'Tiebreaker':
        Store.RunTiebreaker();
        break;
      case 'CardUsed':
        Store.UseCard(Store.CurrentPlayer, Event.payload.InstanceId, Event.payload.Record.TargetPlayerId);
        break;
      case 'Keyframe':
        break;
      case 'GameOver':
        break;
    }
  }
}
