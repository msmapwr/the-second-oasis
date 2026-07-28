/**
 * src/Net/SpectatorGameStore.ts
 * 操作类型：新建
 *
 * 观战者 Store——实现 IGameStore，只读不操作。
 * 通过 WebSocketClient 接收服务端广播，缓存所有玩家的完整手牌。
 */

import { GameStore, type IGameStore, type StoreEvents } from '@/Store/GameStore';
import { CreateDefaultConfig } from '@/Types/GameConfig';
import { GamePhase } from '@/Types/GamePhase';
import type { PlayerId } from '@/Types/Player';
import type { TerritorySnapshot } from '@/Types/Territory';
import type { DiceMode } from '@/Types/Dice';
import type { LaunchResult } from '@/Types/Launch';
import type { TurnResult } from '@/Types/Turn';
import type { CardPlayedRecord } from '@/Types/Turn';
import type { CardInstance, DeckSnapshot } from '@/Types/Card';
import type { TiebreakerRound, GameResult } from '@/Types/GameResult';
import type { Listener } from '@/Store/EventEmitter';
import type { SpectatorInitialState, HandRevealPayload, GameStartingPayload, TurnResultPayload, LaunchResultPayload, TiebreakerResultPayload, GameOverPayload, CardResultPayload } from './Messages';
import { WebSocketClient } from './WebSocketClient';

const SPECTATOR_CANNOT_ACT = '观战者不可执行操作';

export class SpectatorGameStore implements IGameStore {
  private readonly _Client: WebSocketClient;
  private _Store: GameStore | null = null;
  private _Unsubs: Array<() => void> = [];

  private readonly _Hands: Map<PlayerId, CardInstance[]> = new Map();
  private _DeckSize = 0;
  private _DiscardSize = 0;
  private _CardEnabled = false;

  constructor(Client: WebSocketClient) {
    this._Client = Client;
  }

  InitFromSpectatorJoined(Initial: SpectatorInitialState): void {
    const PlayerCount = Initial.players.length as 2 | 3 | 4;
    this._Store = new GameStore(
      CreateDefaultConfig(PlayerCount, 0),
    );
    this._Store.Start();

    this._CardEnabled = Initial.cardEnabled;

    for (const H of Initial.hands) {
      this._Hands.set(H.playerId, [...H.hand] as CardInstance[]);
    }
    this._DeckSize = Initial.deckSize;
    this._DiscardSize = Initial.discardSize;
  }

  StartListening(): void {
    this._Unsubs.push(
      this._Client.On('GAME_STARTING', (_P: GameStartingPayload) => {
        // 观战者不处理 GAME_STARTING
      }),
    );

    this._Unsubs.push(
      this._Client.On('TURN_RESULT', (P: TurnResultPayload) => {
        if (this._Store && this._Store.Phase === GamePhase.SelectMode) {
          this._Store.PlayTurn(P.turnResult.Mode);
        }
      }),
    );

    this._Unsubs.push(
      this._Client.On('LAUNCH_RESULT', (_P: LaunchResultPayload) => {
        if (this._Store && this._Store.Phase === GamePhase.LaunchPhase) {
          this._Store.AttemptLaunch();
        }
      }),
    );

    this._Unsubs.push(
      this._Client.On('TIEBREAKER_RESULT', (_P: TiebreakerResultPayload) => {
        if (this._Store && this._Store.Phase === GamePhase.Tiebreaker) {
          this._Store.RunTiebreaker();
        }
      }),
    );

    this._Unsubs.push(
      this._Client.On('GAME_OVER', (_P: GameOverPayload) => {
        // 内部 GameStore 会通过 IsOver + Result 触发事件
      }),
    );

    this._Unsubs.push(
      this._Client.On('CARD_RESULT', (P: CardResultPayload) => {
        if (this._Store && this._Store.CardEnabled) {
          this._Store.UseCard(P.playerId, P.cardInstanceId, P.targetPlayerId);
        }
      }),
    );

    this._Unsubs.push(
      this._Client.On('HAND_REVEAL', (P: HandRevealPayload) => {
        for (const H of P.hands) {
          this._Hands.set(H.playerId, [...H.hand] as CardInstance[]);
        }
        this._DeckSize = P.deckSize;
        this._DiscardSize = P.discardSize;
      }),
    );
  }

  StopListening(): void {
    for (const Unsub of this._Unsubs) {
      Unsub();
    }
    this._Unsubs = [];
  }

  // ===== IGameStore 代理 =====

  get Phase(): GamePhase {
    return this._Store?.Phase ?? GamePhase.Init;
  }

  get CurrentPlayer(): PlayerId {
    return this._Store?.CurrentPlayer ?? 0;
  }

  get IsOver(): boolean {
    return this._Store?.IsOver ?? false;
  }

  get Result(): GameResult | null {
    return this._Store?.Result ?? null;
  }

  get Snapshot(): TerritorySnapshot {
    return this._Store?.Snapshot ?? { PublicTerritory: 100, Players: [] };
  }

  get RobberyTriggeredCount(): number {
    return this._Store?.RobberyTriggeredCount ?? 0;
  }

  get CollapseX(): number {
    return this._Store?.CollapseX ?? 2;
  }

  get RoundIndex(): number {
    return this._Store?.RoundIndex ?? 0;
  }

  get FirstPlayerIndex(): PlayerId {
    return this._Store?.FirstPlayerIndex ?? 0;
  }

  GetConsecutiveDoubles(Id: PlayerId): number {
    return this._Store?.GetConsecutiveDoubles(Id) ?? 0;
  }

  SetRevengeTarget(_TargetId: PlayerId): void {
    throw new Error(SPECTATOR_CANNOT_ACT);
  }

  Forfeit(_PlayerId: PlayerId): void {
    throw new Error(SPECTATOR_CANNOT_ACT);
  }

  InitiateRobbery(_InitiatorId: PlayerId, _TargetId: PlayerId): TurnResult | null {
    throw new Error(SPECTATOR_CANNOT_ACT);
  }

  Start(): void {
    throw new Error(SPECTATOR_CANNOT_ACT);
  }

  AttemptLaunch(): LaunchResult {
    throw new Error(SPECTATOR_CANNOT_ACT);
  }

  PlayTurn(_Mode: DiceMode): TurnResult {
    throw new Error(SPECTATOR_CANNOT_ACT);
  }

  RunTiebreaker(): TiebreakerRound {
    throw new Error(SPECTATOR_CANNOT_ACT);
  }

  StartAsync(): Promise<void> {
    throw new Error(SPECTATOR_CANNOT_ACT);
  }

  AttemptLaunchAsync(): Promise<LaunchResult> {
    throw new Error(SPECTATOR_CANNOT_ACT);
  }

  PlayTurnAsync(_Mode: DiceMode): Promise<TurnResult> {
    throw new Error(SPECTATOR_CANNOT_ACT);
  }

  RunTiebreakerAsync(): Promise<TiebreakerRound> {
    throw new Error(SPECTATOR_CANNOT_ACT);
  }

  On<K extends keyof StoreEvents>(Type: K, Fn: Listener<StoreEvents[K]>): () => void {
    return this._Store?.On(Type, Fn) ?? (() => { /* noop */ });
  }

  get CardEnabled(): boolean {
    return this._CardEnabled && (this._Store?.CardEnabled ?? false);
  }

  GetCardHand(PlayerId: PlayerId): readonly CardInstance[] {
    return this._Hands.get(PlayerId) ?? [];
  }

  GetCardSnapshot(): DeckSnapshot {
    return {
      DeckSize: this._DeckSize,
      DiscardSize: this._DiscardSize,
      Hands: new Map(),
      ActiveConstantCount: this._Store?.GetCardActiveConstants() ?? 0,
    };
  }

  GetCardPlayableCards(_PlayerId: PlayerId): CardInstance[] {
    return [];
  }

  CanPlayCard(_PlayerId: PlayerId, _InstanceId: number): boolean {
    return false;
  }

  UseCard(_PlayerId: PlayerId, _InstanceId: number, _TargetPlayerId: PlayerId | null): CardPlayedRecord | null {
    throw new Error(SPECTATOR_CANNOT_ACT);
  }

  GetCardActiveConstants(): number {
    return 0;
  }

  ScryTopCards(_Count: number): readonly CardInstance[] {
    return [];
  }

  ScryPickCard(_PlayerId: PlayerId, _InstanceId: number): boolean {
    throw new Error(SPECTATOR_CANNOT_ACT);
  }

  ScryArrangeTop(_CardIds: string[]): void {
    throw new Error(SPECTATOR_CANNOT_ACT);
  }
}
