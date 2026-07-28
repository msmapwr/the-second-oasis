/**
 * src/UI/Components/CardHandView.ts
 * 操作类型：修改
 *
 * 技能卡罗牌手牌栏——底部侧边定位，跟随当前玩家切换
 * 单机：当前玩家回合显示其手牌，AI 回合显示卡背
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
  Major: '#F0C040',
  Swords: '#60A5FA',
  Wands: '#E05555',
  Cups: '#0ECCCE',
  Pentacles: '#3CC080',
};

const SUIT_SYMBOLS: Record<string, string> = {
  Major: '\u2605',
  Swords: '\uD83D\uDDE1',
  Wands: '\uD83E\uDE84',
  Cups: '\uD83C\uDFC6',
  Pentacles: '\uD83E\uDE99',
};

export class CardHandView extends Component {
  private readonly _Store: IGameStore;
  private readonly _Mode: CardViewMode;
  private readonly _MyPlayerId: PlayerId;
  private readonly _OnPlayCard: (InstanceId: number) => void;
  private readonly _IsAI: (PlayerId: PlayerId) => boolean;
  private _CleanupFns: Array<() => void> = [];
  private _CardsRow!: HTMLElement;
  private _Tooltip!: HTMLElement;

  constructor(
    Store: IGameStore,
    Mode: CardViewMode,
    MyPlayerId: PlayerId,
    IsAI: (PlayerId: PlayerId) => boolean,
    OnPlayCard: (InstanceId: number) => void,
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
      Style: `
        position:fixed;bottom:90px;left:16px;
        display:flex;flex-direction:column;align-items:flex-start;
        z-index:50;pointer-events:none;
      `,
    });
    Container.id = 'card-hand-container';

    this._CardsRow = El({
      Tag: 'div',
      Style: 'display:flex;gap:6px;flex-wrap:wrap;pointer-events:auto;',
      Parent: Container,
    });

    this._Tooltip = El({
      Tag: 'div',
      Class: 'card-tooltip',
      Parent: Container,
    });

    this._CleanupFns.push(
      this._Store.On('Snapshot', () => this._Refresh()),
    );

    Parent.appendChild(Container);
    this.SetRoot(Container);
    this._Refresh();
  }

  protected _OnUnmount(): void {
    for (const Fn of this._CleanupFns) Fn();
    this._CleanupFns = [];
  }

  private _CurrentViewPlayer(): PlayerId | null {
    const CurrPlayer = this._Store.CurrentPlayer;
    if (this._Mode === 'multiplayer') return this._MyPlayerId;
    if (this._Mode === 'spectator') return null;
    return CurrPlayer;
  }

  private _ShouldShowFace(PlayerId: PlayerId): boolean {
    if (this._Mode === 'spectator') return true;
    if (this._Mode === 'multiplayer') return PlayerId === this._MyPlayerId;
    return !this._IsAI(PlayerId);
  }

  private _Refresh(): void {
    if (!this._Root || !this._CardsRow) return;

    const TargetPlayer = this._CurrentViewPlayer();
    const Phase = this._Store.Phase;
    const IsCardPhase = Phase === GamePhase.SelectMode || Phase === GamePhase.LaunchPhase;

    if (!this._Store.CardEnabled || !IsCardPhase) {
      this._Root.style.display = 'none';
      return;
    }

    this._Root.style.display = 'flex';
    Clear(this._CardsRow);

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

    if (!ShowFace && Hand.length > 0 && this._Mode === 'single') {
      const BackEl = El({
        Tag: 'div',
        Class: 'card-face card-back',
        Style: 'width:100px;padding:8px;',
        Parent: this._CardsRow,
      });
      BackEl.innerHTML =
        '<div style="font-size:20px;text-align:center;">\uD83C\uDCCF</div>' +
        '<div style="font-size:10px;text-align:center;color:var(--text-muted);margin-top:4px;">' +
          Label + ' \u00D7' + Hand.length +
        '</div>';
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
        Style: 'border-color:' + SuitColor + ';',
        Parent: this._CardsRow,
      });

      const Effect = Def.EffectDescription.length > 20
        ? Def.EffectDescription.slice(0, 20) + '\u2026'
        : Def.EffectDescription;

      CardEl.innerHTML =
        '<div class="card-suit">' + (SUIT_SYMBOLS[Def.Suit] ?? '?') + '</div>' +
        '<div class="card-name">' + Def.NameCn + '</div>' +
        '<div class="card-cost-hint">' + Def.ApCost + ' AP</div>' +
        '<div class="card-effect">' + Effect + '</div>';

      if (ShowFace) {
        CardEl.setAttribute('data-card-id', Def.Id);
        CardEl.setAttribute('data-apcost', String(Def.ApCost));
        CardEl.setAttribute('data-type', Def.Type);
        CardEl.setAttribute('data-keywords', Def.Keywords);
        CardEl.setAttribute('data-lore', Def.Lore);
        CardEl.setAttribute('data-full-effect', Def.EffectDescription);

        this._CleanupFns.push(On(CardEl, 'mouseenter', () => {
          this._ShowTooltip(CardEl, Def, SuitColor, CanPlay);
        }));
        this._CleanupFns.push(On(CardEl, 'mouseleave', () => {
          this._HideTooltip();
        }));
      }

      if (CanPlay) {
        const BtnLabel = Def.Type === CardType.Counter ? '\u26A1' : '\u25B6';
        const PlayBtn = El({
          Tag: 'button',
          Class: 'card-play-btn-mini',
          Text: BtnLabel,
          Parent: CardEl,
        });
        this._CleanupFns.push(On(PlayBtn, 'click', (E: Event) => {
          E.stopPropagation();
          this._OnPlayCard(Card.InstanceId);
        }));
      }
    }
  }

  private _ShowTooltip(
    Source: HTMLElement,
    Def: { NameCn: string; NameEn: string; ApCost: number; EffectDescription: string; Keywords: string; Lore: string; Type: string },
    SuitColor: string,
    _CanPlay: boolean,
  ): void {
    if (!this._Tooltip) return;

    const Rect = Source.getBoundingClientRect();
    const Left = Math.min(Rect.left + Rect.width + 12, window.innerWidth - 310);

    this._Tooltip.style.cssText =
      'display:block;' +
      'position:fixed;' +
      'left:' + Left + 'px;' +
      'top:' + Math.max(16, Rect.top - 40) + 'px;' +
      'width:280px;' +
      'background:linear-gradient(160deg,#0F1923,#111D2E);' +
      'border:2px solid ' + SuitColor + ';' +
      'border-radius:8px;' +
      'padding:14px 16px;' +
      'z-index:200;' +
      'box-shadow:0 0 20px ' + SuitColor + '44, 0 8px 32px rgba(0,0,0,.6);' +
      'pointer-events:none;';

    const TypeLabel: Record<string, string> = {
      Command: '\u6307\u4EE4', Counter: '\u53CD\u5236', Constant: '\u6052\u5E38',
    };

    this._Tooltip.innerHTML =
      '<div style="font-size:16px;font-weight:700;color:#E0EAF5;margin-bottom:2px;">' + Def.NameCn + '</div>' +
      '<div style="font-size:10px;color:var(--text-muted);margin-bottom:8px;">' + Def.NameEn + '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:8px;">' +
        '<span style="font-size:10px;padding:2px 8px;background:rgba(255,255,255,.08);border-radius:3px;">' +
          (TypeLabel[Def.Type] ?? Def.Type) + '</span>' +
        '<span style="font-size:12px;font-weight:700;color:' + SuitColor + ';">' + Def.ApCost + ' AP</span>' +
      '</div>' +
      '<div style="font-size:12px;color:#C0D0E0;line-height:1.6;margin-bottom:8px;">' + Def.EffectDescription + '</div>' +
      '<div style="font-size:10px;color:var(--text-muted);margin-bottom:8px;">' + Def.Keywords + '</div>' +
      '<div style="font-size:10px;color:rgba(255,255,255,.25);line-height:1.5;font-style:italic;">' + Def.Lore + '</div>';
  }

  private _HideTooltip(): void {
    if (this._Tooltip) {
      this._Tooltip.style.display = 'none';
    }
  }
}
