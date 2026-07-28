/**
 * src/UI/Components/CardHandView.ts
 * 操作类型：重写
 *
 * 技能卡手牌栏——新拟态风格，底部侧边定位，跟随当前玩家切换
 * 单机：当前玩家回合显示手牌，AI 回合显示卡背
 * 观战：显示所有人手牌
 * 联机：仅显示自己手牌
 */
import { Component } from './Component';
import { El, On, Clear } from '@/UI/Dom';
import type { IGameStore } from '@/Store/GameStore';
import type { PlayerId } from '@/Types/Player';
import { CardType } from '@/Types/Card';
import { GamePhase } from '@/Types/GamePhase';
import { PlayerPalette } from '@/Store/PlayerPalette';

export type CardViewMode = 'single' | 'spectator' | 'multiplayer';

const SUIT_COLORS: Record<string, string> = {
  Major: '#F0C040', Swords: '#60A5FA', Wands: '#E05555', Cups: '#0ECCCE', Pentacles: '#3CC080',
};

const SUIT_SYMBOLS: Record<string, string> = {
  Major: '\u2605', Swords: '\uD83D\uDDE1', Wands: '\uD83E\uDE84', Cups: '\uD83C\uDFC6', Pentacles: '\uD83E\uDE99',
};

export class CardHandView extends Component {
  private readonly _Store: IGameStore;
  private readonly _Mode: CardViewMode;
  private readonly _MyPlayerId: PlayerId;
  private readonly _OnPlayCard: (InstanceId: number) => void;
  private readonly _IsAI: (PlayerId: PlayerId) => boolean;
  private _CleanupFns: Array<() => void> = [];
  private _CardListeners: Array<() => void> = [];
  private _CardsRow!: HTMLElement;
  private _Tooltip: HTMLElement | null = null;

  constructor(
    Store: IGameStore, Mode: CardViewMode, MyPlayerId: PlayerId,
    IsAI: (Pid: PlayerId) => boolean, OnPlayCard: (Id: number) => void,
  ) {
    super();
    this._Store = Store;
    this._Mode = Mode;
    this._MyPlayerId = MyPlayerId;
    this._IsAI = IsAI;
    this._OnPlayCard = OnPlayCard;
  }

  Mount(Parent: HTMLElement): void {
    const Container = El({
      Tag: 'div',
      Style: 'position:fixed;bottom:90px;left:16px;display:flex;flex-direction:column;align-items:flex-start;z-index:50;pointer-events:none;',
    });
    Container.id = 'card-hand-container';

    this._CardsRow = El({
      Tag: 'div',
      Style: 'display:flex;gap:6px;flex-wrap:wrap;pointer-events:auto;',
      Parent: Container,
    });

    this._CleanupFns.push(this._Store.On('Snapshot', () => this._Refresh()));

    Parent.appendChild(Container);
    this.SetRoot(Container);
    this._Refresh();
  }

  protected _OnUnmount(): void {
    for (const Fn of this._CleanupFns) Fn();
    for (const Fn of this._CardListeners) Fn();
    this._CleanupFns = [];
    this._CardListeners = [];
    this._HideTooltip();
    if (this._Tooltip) { this._Tooltip.remove(); this._Tooltip = null; }
  }

  private _CurrentViewPlayer(): PlayerId | null {
    const Curr = this._Store.CurrentPlayer;
    if (this._Mode === 'multiplayer') return this._MyPlayerId;
    if (this._Mode === 'spectator') return null;
    return Curr;
  }

  private _ShouldShowFace(Pid: PlayerId): boolean {
    if (this._Mode === 'spectator') return true;
    if (this._Mode === 'multiplayer') return Pid === this._MyPlayerId;
    return !this._IsAI(Pid);
  }

  private _Refresh(): void {
    if (!this._Root || !this._CardsRow) return;

    const TargetPlayer = this._CurrentViewPlayer();
    const Phase = this._Store.Phase;
    const IsCardPhase = Phase === GamePhase.SelectMode || Phase === GamePhase.LaunchPhase;

    this._HideTooltip();

    if (!this._Store.CardEnabled || !IsCardPhase) {
      this._Root.style.display = 'none';
      return;
    }

    this._Root.style.display = 'flex';
    Clear(this._CardsRow);
    for (const Fn of this._CardListeners) Fn();
    this._CardListeners = [];

    if (TargetPlayer !== null) {
      this._RenderPlayerCards(TargetPlayer);
    } else {
      for (let Pid = 0; Pid < this._Store.Snapshot.Players.length; Pid++) {
        this._RenderPlayerCards(Pid);
      }
    }
  }

  private _RenderPlayerCards(PlayerId: PlayerId): void {
    const Hand = this._Store.GetCardHand(PlayerId);
    if (Hand.length === 0) return;

    const ShowFace = this._ShouldShowFace(PlayerId);
    const Label = PlayerPalette.LabelShort(PlayerId);

    if (!ShowFace && this._Mode === 'single') {
      const Back = El({
        Tag: 'div', Class: 'card-face card-back', Parent: this._CardsRow,
        Style: 'width:100px;height:auto;min-width:unset;padding:10px 8px;border-color:#A68A3C;opacity:0.6;',
      });
      Back.innerHTML =
        '<div style="font-size:22px;text-align:center;opacity:0.5;">\uD83C\uDCCF</div>' +
        '<div style="font-size:10px;text-align:center;color:var(--text-muted);margin-top:4px;">' +
        Label + ' \u00D7' + Hand.length + '</div>';
      return;
    }

    for (let I = 0; I < Hand.length; I++) {
      const Card = Hand[I];
      const Def = Card.Definition;
      const CanPlay = ShowFace && this._Store.CanPlayCard(PlayerId, Card.InstanceId);
      const SuitColor = SUIT_COLORS[Def.Suit] ?? '#888';

      const CardEl = El({
        Tag: 'div',
        Class: 'card-face ' + Def.Rarity.toLowerCase() +
          (CanPlay ? ' card-playable' : ' card-locked'),
        Style: CanPlay ? 'border-left:3px solid ' + SuitColor + ';' : '',
        Parent: this._CardsRow,
      });

      const Effect = Def.EffectDescription.length > 18
        ? Def.EffectDescription.slice(0, 18) + '\u2026' : Def.EffectDescription;

      CardEl.innerHTML =
        '<div class="card-suit">' + (SUIT_SYMBOLS[Def.Suit] ?? '?') + '</div>' +
        '<div class="card-name">' + Def.NameCn + '</div>' +
        '<div class="card-cost-hint">' + Def.ApCost + ' AP</div>' +
        '<div class="card-effect">' + Effect + '</div>';

      if (ShowFace) {
        this._CardListeners.push(On(CardEl, 'mouseenter', () => {
          this._ShowTooltip(CardEl, Def, SuitColor);
        }));
        this._CardListeners.push(On(CardEl, 'mouseleave', () => {
          this._HideTooltip();
        }));
      }

      if (CanPlay) {
        const Btn = El({
          Tag: 'button', Class: 'card-play-btn-mini', Parent: CardEl,
          Text: Def.Type === CardType.Counter ? '\u26A1' : '\u25B6',
        });
        this._CardListeners.push(On(Btn, 'click', (E: Event) => {
          E.stopPropagation();
          this._OnPlayCard(Card.InstanceId);
        }));
      }
    }
  }

  private _GetTooltip(): HTMLElement {
    if (!this._Tooltip) {
      this._Tooltip = El({
        Tag: 'div', Class: 'card-detail-tooltip',
      });
      document.body.appendChild(this._Tooltip);
    }
    return this._Tooltip;
  }

  private _ShowTooltip(
    Source: HTMLElement,
    Def: { NameCn: string; NameEn: string; ApCost: number; EffectDescription: string; Keywords: string; Lore: string; Type: string; Suit: string },
    SuitColor: string,
  ): void {
    const Tip = this._GetTooltip();
    const Rect = Source.getBoundingClientRect();
    const TW = 300;
    const TH_MIN = 200;

    let Left = Rect.right + 14;
    let Top = Rect.top - 20;

    if (Left + TW > window.innerWidth - 8) {
      Left = Rect.left - TW - 14;
    }
    if (Left < 8) Left = 8;

    const ViewH = window.innerHeight;
    if (Top + TH_MIN > ViewH - 8) {
      Top = ViewH - TH_MIN - 8;
    }
    if (Top < 8) Top = 8;

    const TypeLabel: Record<string, string> = {
      Command: '\u6307\u4EE4', Counter: '\u53CD\u5236', Constant: '\u6052\u5E38',
    };

    Tip.style.cssText =
      'display:block;position:fixed;z-index:9999;pointer-events:none;' +
      'left:' + Left + 'px;top:' + Top + 'px;width:' + TW + 'px;' +
      'background:var(--nm-bg);box-shadow:var(--nm-raised-lg);' +
      'border-radius:var(--nm-radius-container);' +
      'padding:16px 18px;' +
      'border-left:4px solid ' + SuitColor + ';';

    Tip.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
        '<span style="font-size:24px;">' + (SUIT_SYMBOLS[Def.Suit] ?? '?') + '</span>' +
        '<div>' +
          '<div style="font-size:16px;font-weight:700;color:var(--text);">' + Def.NameCn + '</div>' +
          '<div style="font-size:11px;color:var(--text-dim);">' + Def.NameEn + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:10px;align-items:center;">' +
        '<span style="display:inline-block;padding:3px 10px;border-radius:var(--nm-radius-element);' +
          'background:var(--nm-bg);box-shadow:var(--nm-pressed);font-size:10px;color:var(--text-dim);">' +
          (TypeLabel[Def.Type] ?? Def.Type) + '</span>' +
        '<span style="display:inline-block;padding:3px 10px;border-radius:var(--nm-radius-element);' +
          'background:var(--nm-bg);box-shadow:var(--nm-pressed);font-size:10px;color:var(--text-dim);">' +
          Def.Suit + '</span>' +
        '<span style="font-size:14px;font-weight:700;color:' + SuitColor + ';margin-left:auto;">' +
          Def.ApCost + ' AP</span>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--text);line-height:1.65;margin-bottom:10px;' +
        'padding:10px;border-radius:var(--nm-radius-element);' +
        'background:var(--nm-bg);box-shadow:var(--nm-pressed);">' +
        Def.EffectDescription + '</div>' +
      '<div style="font-size:10px;color:var(--text-dim);margin-bottom:6px;">' +
        Def.Keywords + '</div>' +
      '<div style="font-size:10px;color:var(--text-dim);opacity:0.5;line-height:1.5;font-style:italic;">' +
        Def.Lore + '</div>';
  }

  private _HideTooltip(): void {
    if (this._Tooltip) {
      this._Tooltip.style.display = 'none';
    }
  }
}
