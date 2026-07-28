import type { GamePhase } from '@/Types/GamePhase';
import type { PlayerId } from '@/Types/Player';
import type { TerritorySnapshot } from '@/Types/Territory';
import type { IGameStore } from '@/Store/GameStore';
import type { InputGate } from '@/App/InputGate';
import { AIDirector } from '@/AI/AIDirector';
import { PlayerPalette } from '@/Store/PlayerPalette';
import type { DecisionTrace } from '@/AI/TransparentLog';
import { El } from '../Dom';
import { Component } from './Component';
import { FONT_STACK } from '@/Config/UiConstants';
import { HeaderHud } from './HeaderHud';
import { PlayerHudGrid } from './PlayerHudGrid';
import { BattleLogTerminal } from './BattleLogTerminal';
import { ControlConsole } from './ControlConsole';
import { CardHandView } from './CardHandView';
import type { CardViewMode } from './CardHandView';
import type { LogLevel } from './BattleLogTerminal';

export { type LogLevel } from './BattleLogTerminal';

export interface GameStageViewConfig {
  readonly Store: IGameStore;
  readonly Input: InputGate;
  readonly AIDirector: AIDirector;
  readonly Mode?: CardViewMode;
  readonly MyPlayerId?: number;
  readonly IsAI?: (PlayerId: number) => boolean;
  readonly IsSpectator?: boolean;
  readonly OnRequestSettings?: () => void;
  readonly OnRequestQuit?: () => void;
}

export class GameStageView extends Component {
  private readonly _Store: IGameStore;
  private readonly _Input: InputGate;
  private readonly _AIDirector: AIDirector;
  private readonly _OnSettings: () => void;
  private readonly _OnRequestQuit: () => void;
  private readonly _CardMode: CardViewMode;
  private readonly _CardMyPlayerId: number;
  private readonly _CardIsAI: (PlayerId: number) => boolean;

  private _Header!: HeaderHud;
  private _Grid!: PlayerHudGrid;
  private _Log!: BattleLogTerminal;
  private _Console!: ControlConsole;
  private _CardHand!: CardHandView;
  private _SprintBanner: HTMLElement | null = null;

  private _TurnBanner: HTMLElement | null = null;
  private _BannerTimer: number | null = null;

  private _UnsubSnapshot: (() => void) | null = null;
  private _UnsubRound: (() => void) | null = null;
  private _CleanupFns: (() => void)[] = [];
  private readonly _IsSpectator: boolean;

  constructor(Config: GameStageViewConfig) {
    super();
    this._Store = Config.Store;
    this._Input = Config.Input;
    this._AIDirector = Config.AIDirector;
    this._CardMode = Config.Mode ?? 'single';
    this._CardMyPlayerId = Config.MyPlayerId ?? 0;
    this._CardIsAI = Config.IsAI ?? (() => false);
    this._IsSpectator = Config.IsSpectator ?? false;
    this._OnSettings = Config.OnRequestSettings ?? (() => {});
    this._OnRequestQuit = Config.OnRequestQuit ?? (() => Config.Store.Forfeit(Config.Store.CurrentPlayer));
  }

  Mount(Parent: HTMLElement): void {
    const Root = El({
      Tag: 'div',
      Class: 'game-stage',
      Parent,
      Style: 'position:absolute;inset:0;font-family:' + FONT_STACK.Body + ';',
    });
    this.SetRoot(Root);

    this._Header = new HeaderHud();
    this._Header.Mount(Root);

    this._Grid = new PlayerHudGrid(this._Store.Snapshot.Players.length);
    this._Grid.Mount(Root);

    this._Log = new BattleLogTerminal();
    this._Log.Mount(Root);

    this._Console = new ControlConsole(this._Store, this._Input, this._OnRequestQuit, this._OnSettings);
    this._Console.Mount(Root);
    if (this._IsSpectator) {
      this._Console.Hide();
    }

    this._CardHand = new CardHandView(this._Store, this._CardMode, this._CardMyPlayerId, this._CardIsAI, (InstanceId: number) => {
      this._Input.SubmitCard(InstanceId);
    });
    this._CardHand.Mount(Root);

    if (this._IsSpectator) {
      El({
        Tag: 'div',
        Class: 'font-mono',
        Parent: Root,
        Style: 'position:absolute;bottom:12px;left:50%;transform:translateX(-50%);font-size:11px;color:var(--text-dim);opacity:0.5;pointer-events:none;',
        Text: '观战中 · SPECTATOR',
      });
    }

    const Sprint = El({
      Tag: 'div',
      Class: 'sprint-banner font-display',
      Parent: Root,
    });
    Sprint.textContent = '枯 竭 冲 刺';
    this._SprintBanner = Sprint;

    this._UnsubSnapshot = this._Store.On('Snapshot', (Snap) => this._Refresh(Snap));
    this._UnsubRound = this._Store.On('RoundChange', ({ RoundIndex, FirstPlayerIndex }) => {
      this.AppendLog('Info', `第 ${RoundIndex + 1} 轮开始，先手：${PlayerPalette.LabelLong(FirstPlayerIndex)}`);
    });

    const UnsubDecision = this._AIDirector.On('Decision', (Trace: DecisionTrace) => this.AppendAIDecision(Trace));
    const UnsubThinking = this._AIDirector.On('Thinking', ({ PlayerId }: { PlayerId: number }) => {
      const Seat = this._Grid.GetSeatRoot(PlayerId);
      if (Seat) {
        Seat.classList.add('ai-thinking');
        window.setTimeout(() => Seat.classList.remove('ai-thinking'), 360);
      }
    });
    // 订阅在 Unmount 时统一清理
    this._CleanupFns = [UnsubDecision, UnsubThinking];
  }

  SetPhase(Phase: GamePhase): void {
    this._Header.SetPhase(Phase);
    this._Console.SetPhase(Phase);
  }

  AnnounceTurn(PlayerId: PlayerId, Action: '发射' | '回合' | '加赛'): void {
    const Color = PlayerPalette.Color(PlayerId);
    const Label = PlayerPalette.LabelLong(PlayerId);
    if (this._TurnBanner === null) {
      this._TurnBanner = El({
        Tag: 'div', Class: 'turn-banner font-display', Parent: this.Root,
      });
    }
    const Banner = this._TurnBanner;
    Banner.style.setProperty('--c', Color);
    Banner.textContent = `${Label} · ${Action}`;
    Banner.classList.remove('show');
    if (this._BannerTimer !== null) { clearTimeout(this._BannerTimer); }
    void Banner.offsetWidth;
    Banner.classList.add('show');
    this._BannerTimer = window.setTimeout(() => {
      Banner.classList.remove('show');
      this._BannerTimer = null;
    }, 1600);
  }

  private _Refresh(Snap: TerritorySnapshot): void {
    this._Header.Refresh(
      Snap.PublicTerritory,
      this._Store.CollapseX,
      this._Store.RobberyTriggeredCount,
      this._Store.RoundIndex,
      this._Store.FirstPlayerIndex,
    );

    if (this._SprintBanner) {
      const InSprint = Snap.PublicTerritory <= 30;
      if (InSprint) {
        this._SprintBanner.classList.add('show');
      } else {
        this._SprintBanner.classList.remove('show');
      }
    }

    this._Grid.Refresh(Snap.Players, this._Store.CurrentPlayer);
  }

  FlashSeats(Ids: number[]): void {
    this._Grid.FlashSeats(Ids);
  }

  AppendLog(Level: LogLevel, Text: string): void {
    this._Log.AppendLog(Level, Text);
  }

  AppendAIDecision(Trace: Parameters<typeof this._Log.AppendAIDecision>[0]): void {
    this._Log.AppendAIDecision(Trace);
  }

  ClearLog(): void {
    this._Log.ClearLog();
  }

  ShowBusy(Text = '结算中…'): void {
    this._Console.ShowBusy(Text);
  }

  ClearConsole(): void {
    this._Console.Clear();
  }

  GetSeatValueEl(Id: PlayerId): HTMLElement | null {
    return this._Grid.GetSeatValueEl(Id);
  }

  GetPublicNumEl(): HTMLElement | null {
    return this._Header.GetPublicNumEl();
  }

  GetMountEl(): HTMLElement {
    return this.Root;
  }

  protected _OnUnmount(): void {
    this._CleanupFns.forEach((Fn) => Fn());
    this._CleanupFns = [];
    if (this._BannerTimer !== null) {
      clearTimeout(this._BannerTimer);
      this._BannerTimer = null;
    }
    this._UnsubSnapshot?.();
    this._UnsubSnapshot = null;
    this._UnsubRound?.();
    this._UnsubRound = null;
    this._Header.Unmount();
    this._Grid.Unmount();
    this._Log.Unmount();
    this._Console.Unmount();
    this._CardHand.Unmount();
  }
}
