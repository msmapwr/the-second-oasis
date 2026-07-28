/**
 * src/Render/Animation/AnimationCoordinator.ts
 * 操作类型：新建
 *
 * 动画/音频事件编排器
 *
 * 设计要点：
 * 1. 订阅 GameStore 事件，把业务结果翻译为动画/音频指令
 * 2. 不直接操作 Core/Store，只读取事件载荷和只读快照
 * 3. 负责调用 DiceStage 和 AudioEngine 的同步时机
 * 4. 提供坐标查询接口，要求外部传入 GameStageView 或类似 UI 句柄
 */
import type { IGameStore } from '@/Store/GameStore';
import type { PlayerId } from '@/Types/Player';
import type { TurnResult } from '@/Types/Turn';
import type { LaunchResult } from '@/Types/Launch';
import type { TiebreakerRound } from '@/Types/GameResult';
import type { AnimationManager } from './AnimationManager';
import type { AudioEngine } from '@/Audio/AudioEngine';
import { NumberPopAnimation } from './NumberPopAnimation';
import { SeatPulseAnimation } from './SeatPulseAnimation';
import { ChainBadgeAnimation, type ChainBadgeType } from './ChainBadgeAnimation';
import { PlayerPalette } from '@/Store/PlayerPalette';

/**
 * 坐标提供器：由 GameStageView 实现，避免 Coordinator 直接依赖 DOM 结构
 */
export interface ICoordProvider {
  /** 获取玩家私有数值元素（用于数字弹出） */
  GetSeatValueEl(Id: PlayerId): HTMLElement | null;
  /** 获取公共领土数值元素 */
  GetPublicNumEl(): HTMLElement | null;
  /** 获取 DOM 动画挂载点（一般为 body 或 ui-layer） */
  GetMountEl(): HTMLElement;
}

export class AnimationCoordinator {
  private readonly _Store: IGameStore;
  private readonly _Manager: AnimationManager;
  private readonly _Audio: AudioEngine;
  private readonly _Coords: ICoordProvider;
  private readonly _Unsubs: (() => void)[] = [];

  constructor(
    Store: IGameStore,
    Manager: AnimationManager,
    Audio: AudioEngine,
    Coords: ICoordProvider,
  ) {
    this._Store = Store;
    this._Manager = Manager;
    this._Audio = Audio;
    this._Coords = Coords;

    this._Unsubs.push(
      Store.On('Launch', ({ Result }) => this._OnLaunch(Result)),
      Store.On('Turn', ({ Result }) => this._OnTurn(Result)),
      Store.On('Tiebreaker', ({ Round }) => this._OnTiebreaker(Round)),
      Store.On('GameOver', () => this._Audio.Play('GameOver')),
    );
  }

  /**
   * 取消所有订阅，用于场景切换
   */
  Dispose(): void {
    for (const Unsub of this._Unsubs) Unsub();
    this._Unsubs.length = 0;
  }

  private _OnLaunch(Result: LaunchResult): void {
    const PlayerId = this._Store.CurrentPlayer;
    this._PulseSeat(PlayerId);
    this._Audio.Play(Result.Status === 'Success' ? 'LaunchSuccess' : 'LaunchFail');
  }

  private _OnTurn(Result: TurnResult): void {
    const PlayerId = this._Store.CurrentPlayer;

    this._PulseSeat(PlayerId);

    if (Result.Dice) {
      this._Audio.Play('DiceSettle');
    }

    if (Result.OccupationDelta) {
      const Delta = Result.OccupationDelta.PrivateDelta;
      this._Audio.Play(Delta >= 0 ? 'OccupyUp' : 'OccupyDown');
      this._PopNumber(PlayerId, Delta);
      this._PopPublic(Result.OccupationDelta.PublicDelta);
    }

    if (Result.DevOutcome) {
      const M = Result.DevOutcome.Multiplier;
      if (Result.IsOverload) {
        this._Audio.Play('ChainBreak');
        this._ShowChainBadge(PlayerId, 'Break');
      } else if (M === 2) {
        this._Audio.Play('ChainX2');
        this._ShowChainBadge(PlayerId, 'X2');
      } else if (M === 3) {
        this._Audio.Play('ChainX3');
        this._ShowChainBadge(PlayerId, 'X3');
      }
    }

    if (Result.Robbery) {
      this._Audio.Play('RobberyStart');
      const R = Result.Robbery;
      // 胜负音效：若发起者胜利则播放 Win，否则 Lose
      this._Audio.Play(R.Winner === 'Initiator' ? 'RobberyWin' : 'RobberyLose');
      this._PopNumber(PlayerId, R.InitiatorDelta);
      this._PopNumber(R.Defender as PlayerId, R.DefenderDelta);
    }

    if (Result.Collapse) {
      this._Audio.Play('Collapse');
      for (const Loss of Result.Collapse.PlayerLosses) {
        this._PopNumber(Loss.Id as PlayerId, 0 - Loss.ActualLoss);
      }
    }
  }

  private _OnTiebreaker(Round: TiebreakerRound): void {
    for (const Roll of Round.Rolls) {
      this._PulseSeat(Roll.Id as PlayerId);
    }
    this._Audio.Play('DiceSettle');
  }

  /**
   * 席位脉冲：当前玩家行动提示
   */
  private _PulseSeat(Id: PlayerId): void {
    const El = this._Coords.GetSeatValueEl(Id);
    if (!El) return;
    const Rect = El.getBoundingClientRect();
    const Color = PlayerPalette.Color(Id);
    this._Manager.Add(
      new SeatPulseAnimation(
        this._Coords.GetMountEl(),
        Rect.left + Rect.width / 2,
        Rect.top + Rect.height / 2,
        Rect.width,
        Rect.height,
        Color,
      ),
    );
  }

  /**
   * 从坐标提供器获取元素矩形中心，创建数字弹出动画
   */
  private _PopFromElement(El: HTMLElement | null, Delta: number): void {
    if (Delta === 0 || !El) return;
    const Rect = El.getBoundingClientRect();
    this._Manager.Add(
      new NumberPopAnimation(
        this._Coords.GetMountEl(),
        Rect.left + Rect.width / 2,
        Rect.top,
        Delta,
      ),
    );
  }

  /**
   * 私有领土数字弹出
   */
  private _PopNumber(Id: PlayerId, Delta: number): void {
    this._PopFromElement(this._Coords.GetSeatValueEl(Id), Delta);
  }

  /**
   * 公共领土数字弹出
   */
  private _PopPublic(Delta: number): void {
    this._PopFromElement(this._Coords.GetPublicNumEl(), Delta);
  }

  /**
   * 开发链徽章弹出
   */
  private _ShowChainBadge(Id: PlayerId, Type: ChainBadgeType): void {
    const El = this._Coords.GetSeatValueEl(Id);
    if (!El) return;
    const Rect = El.getBoundingClientRect();
    this._Manager.Add(
      new ChainBadgeAnimation(
        this._Coords.GetMountEl(),
        Rect.left + Rect.width / 2,
        Rect.top - 24,
        Type,
      ),
    );
  }
}
