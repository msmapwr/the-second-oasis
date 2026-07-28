import { El, On, Clear } from '../Dom';
import { Component } from './Component';
import { PlayerPalette } from '@/Store/PlayerPalette';
import type { GamePhase } from '@/Types/GamePhase';
import { DiceMode } from '@/Types/Dice';
import type { InputGate } from '@/App/InputGate';
import type { IGameStore } from '@/Store/GameStore';

export class ControlConsole extends Component {
  private readonly _Store: IGameStore;
  private readonly _Input: InputGate;
  private readonly _OnQuit: () => void;
  private readonly _OnRequestSettings: () => void;
  private _CleanupFns: (() => void)[] = [];
  private _Area: HTMLElement | null = null;

  constructor(
    Store: IGameStore,
    Input: InputGate,
    OnQuit: () => void,
    OnRequestSettings?: () => void,
  ) {
    super();
    this._Store = Store;
    this._Input = Input;
    this._OnQuit = OnQuit;
    this._OnRequestSettings = OnRequestSettings ?? (() => {});
  }

  Mount(Parent: HTMLElement): void {
    this._Area = El({ Tag: 'div', Class: 'control-console panel-surface', Parent });
    this.SetRoot(this._Area);
  }

  SetPhase(Phase: GamePhase): void {
    if (!this._Area) return;
    Clear(this._Area);

    let Index = 0;
    const Add = (
      Text: string,
      Modifier: 'launch' | 'steady' | 'aggressive' | 'pass' | 'tiebreak' | 'revenge',
      Hint: string,
      OnClick: () => void,
    ): void => {
      this._AddButton(Text, Modifier, Hint, OnClick, Index++);
    };

    if (Phase === 'LaunchPhase' as GamePhase) {
      Add('🚀 发射', 'launch', '空格', () => this._Input.SubmitLaunch());
    } else if (Phase === 'SelectMode' as GamePhase) {
      const Current = this._Store.Snapshot.Players[this._Store.CurrentPlayer];
      Add('稳健', 'steady', '1', () => this._Input.SubmitMode(DiceMode.Steady));
      Add('激进', 'aggressive', '2', () => this._Input.SubmitMode(DiceMode.Aggressive));
      Add('不开发', 'pass', '3', () => this._Input.SubmitMode(DiceMode.None));
      if (Current?.RevengeToken) {
        Add('复仇', 'revenge', '4', () => this._ShowRevengeTargetPicker());
      }
      Add('抢夺', 'revenge', 'R', () => this._ShowRobberyTargetPicker());
    } else if (Phase === 'Tiebreaker' as GamePhase) {
      Add('⚔ 加赛掷骰', 'tiebreak', '空格', () => this._Input.SubmitTiebreaker());
    } else {
      El({ Tag: 'span', Class: 'font-mono text-dim', Parent: this._Area, Style: 'font-size:13px;', Text: '— 等待中 —' });
    }

    this._AddQuitButton();
  }

  private _ShowRevengeTargetPicker(): void {
    if (!this._Area) return;
    Clear(this._Area);
    El({
      Tag: 'span', Class: 'font-mono text-dim', Parent: this._Area,
      Style: 'font-size:12px;margin-right:8px;',
      Text: '选择复仇目标:',
    });
    for (const P of this._Store.Snapshot.Players) {
      if (P.Id === this._Store.CurrentPlayer) continue;
      const Btn = El({
        Tag: 'button', Class: 'console-btn revenge', Parent: this._Area,
        Style: `border-color:${PlayerPalette.Color(P.Id)};`,
      });
      El({ Tag: 'span', Parent: Btn, Text: PlayerPalette.LabelShort(P.Id) });
      this._CleanupFns.push(On(Btn, 'click', () => {
        this._Store.SetRevengeTarget(P.Id);
        this._Input.SubmitMode(DiceMode.Revenge);
      }));
    }
  }

  private _ShowRobberyTargetPicker(): void {
    if (!this._Area) return;
    Clear(this._Area);
    El({
      Tag: 'span', Class: 'font-mono text-dim', Parent: this._Area,
      Style: 'font-size:12px;margin-right:8px;',
      Text: '选择抢夺目标:',
    });
    for (const P of this._Store.Snapshot.Players) {
      if (P.Id === this._Store.CurrentPlayer) continue;
      if (P.PrivateTerritory <= 0) continue;
      const Btn = El({
        Tag: 'button', Class: 'console-btn revenge', Parent: this._Area,
        Style: `border-color:${PlayerPalette.Color(P.Id)};`,
      });
      El({ Tag: 'span', Parent: Btn, Text: `${PlayerPalette.LabelShort(P.Id)} (${P.PrivateTerritory})` });
      this._CleanupFns.push(On(Btn, 'click', () => {
        const Result = this._Store.InitiateRobbery(this._Store.CurrentPlayer, P.Id);
        if (Result) {
          this._Input.SubmitMode(DiceMode.None);
        }
      }));
    }
  }

  ShowBusy(Text = '结算中…'): void {
    if (!this._Area) return;
    Clear(this._Area);
    El({
      Tag: 'span', Class: 'font-mono text-dim', Parent: this._Area,
      Style: 'font-size:13px;opacity:0.7;letter-spacing:1px;',
      Text,
    });
  }

  Clear(): void {
    if (this._Area) Clear(this._Area);
  }

  Hide(): void {
    if (this._Area) {
      this._Area.style.display = 'none';
    }
  }

  private _AddButton(
    Text: string,
    Modifier: 'launch' | 'steady' | 'aggressive' | 'pass' | 'tiebreak' | 'revenge',
    Hint: string,
    OnClick: () => void,
    Index: number,
  ): void {
    if (!this._Area) return;
    const Btn = El({
      Tag: 'button',
      Class: `console-btn ${Modifier}`,
      Parent: this._Area,
    });
    El({ Tag: 'span', Parent: Btn, Text });
    if (Hint) {
      El({ Tag: 'kbd', Class: 'btn-hint font-mono', Parent: Btn, Text: Hint });
    }
    Btn.style.animationDelay = `${Index * 0.06}s`;
    Btn.addEventListener('animationend', () => { Btn.style.animation = 'none'; }, { once: true });
    this._CleanupFns.push(On(Btn, 'click', (E: Event) => {
      this._SpawnRipple(Btn, E as MouseEvent);
      OnClick();
    }));
  }

  private _AddQuitButton(): void {
    if (!this._Area) return;
    if (this._OnRequestSettings) {
      const SetBtn = El({
        Tag: 'button', Class: 'console-btn pass', Parent: this._Area,
      });
      El({ Tag: 'span', Parent: SetBtn, Text: '设置 ⚙' });
      this._CleanupFns.push(On(SetBtn, 'click', () => this._OnRequestSettings()));
    }
    const Btn = El({
      Tag: 'button', Class: 'console-btn quit-btn', Parent: this._Area,
    });
    El({ Tag: 'span', Parent: Btn, Text: '退出' });
    this._CleanupFns.push(On(Btn, 'click', () => this._ShowQuitConfirm()));
  }

  private _ShowQuitConfirm(): void {
    if (!this._Area) return;
    Clear(this._Area);
    El({ Tag: 'span', Class: 'font-mono text-dim', Parent: this._Area, Style: 'font-size:13px;margin-right:8px;', Text: '确定要退出游戏吗？' });
    const YesBtn = El({ Tag: 'button', Class: 'console-btn aggressive', Parent: this._Area });
    El({ Tag: 'span', Parent: YesBtn, Text: '确认退出' });
    const NoBtn = El({ Tag: 'button', Class: 'console-btn steady', Parent: this._Area });
    El({ Tag: 'span', Parent: NoBtn, Text: '取消' });
    On(YesBtn, 'click', () => this._OnQuit());
    On(NoBtn, 'click', () => this.SetPhase(this._Store.Phase));
  }

  private _SpawnRipple(Btn: HTMLElement, E: MouseEvent): void {
    const Rect = Btn.getBoundingClientRect();
    const Span = document.createElement('span');
    Span.className = 'btn-ripple';
    Span.style.left = `${E.clientX - Rect.left}px`;
    Span.style.top = `${E.clientY - Rect.top}px`;
    const D = Math.max(Rect.width, Rect.height);
    Span.style.width = `${D}px`;
    Span.style.height = `${D}px`;
    Btn.appendChild(Span);
    Span.addEventListener('animationend', () => Span.remove(), { once: true });
  }

  protected _OnUnmount(): void {
    this._CleanupFns.forEach((Fn) => Fn());
    this._CleanupFns = [];
  }
}
