import { Component } from './Component';
import { El, On } from '@/UI/Dom';
import type { CardInstance } from '@/Types/Card';

const SUIT_COLORS: Record<string, string> = {
  Major: '#F0C040', Swords: '#60A5FA', Wands: '#E05555',
  Cups: '#0ECCCE', Pentacles: '#3CC080',
};

export type SelectorAction = 'pick' | 'arrange' | 'discard';

export interface SelectorConfig {
  readonly Action: SelectorAction;
  readonly Cards: readonly CardInstance[];
  readonly Title: string;
  readonly MaxSelect: number;
}

export class CardSelector extends Component {
  private readonly _Config: SelectorConfig;
  private readonly _OnConfirm: (Selected: CardInstance[]) => void;
  private readonly _OnCancel: () => void;
  private _Selected: CardInstance[] = [];
  private _Overlay!: HTMLElement;
  private _CleanupFns: Array<() => void> = [];

  constructor(Config: SelectorConfig, OnConfirm: (Selected: CardInstance[]) => void, OnCancel: () => void) {
    super();
    this._Config = Config;
    this._OnConfirm = OnConfirm;
    this._OnCancel = OnCancel;
    if (Config.Action === 'pick' && Config.Cards.length > 0) {
      this._Selected = [Config.Cards[0]];
    }
  }

  Mount(Parent: HTMLElement): void {
    this._Overlay = El({
      Tag: 'div',
      Style: `
        position:fixed;inset:0;z-index:999;
        background:rgba(0,0,0,.7);display:flex;
        align-items:center;justify-content:center;
      `,
    });
    this._CleanupFns.push(On(this._Overlay, 'click', (E: Event) => {
      if (E.target === this._Overlay) this._OnCancel();
    }));

    const Dialog = El({
      Tag: 'div',
      Parent: this._Overlay,
      Style: `
        background:var(--space-panel,#1A2230);
        border:2px solid var(--oasis,#00E5FF);
        border-radius:12px;padding:20px 24px;
        max-width:500px;width:90vw;
        box-shadow:0 0 40px rgba(0,229,255,.15);
      `,
    });

    El({ Tag: 'h3', Parent: Dialog,
      Style: 'margin:0 0 4px;font-size:15px;color:var(--oasis,#00E5FF);',
      Text: this._Config.Title,
    });

    const Hint = this._Config.Action === 'pick'
      ? '点选一张牌加入手牌'
      : this._Config.Action === 'arrange'
        ? '拖拽或点选排序，从上到下为牌库顶顺序'
        : '选择一张牌弃入弃牌堆';

    El({ Tag: 'p', Parent: Dialog,
      Style: 'margin:0 0 14px;font-size:11px;color:var(--text-dim);',
      Text: Hint,
    });

    const CardGrid = El({
      Tag: 'div',
      Parent: Dialog,
      Style: 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center;',
    });

    for (const Card of this._Config.Cards) {
      const Def = Card.Definition;
      const SuitColor = SUIT_COLORS[Def.Suit] ?? '#888';
      const IsSel = this._Selected.includes(Card);

      const CardEl = El({
        Tag: 'div',
        Parent: CardGrid,
        Style: `
          width:150px;padding:12px;cursor:pointer;
          background:linear-gradient(160deg,#0F1923,#111D2E);
          border:2px solid ${IsSel ? SuitColor : '#2A3A4D'};
          border-radius:8px;transition:all 0.15s;
          ${IsSel ? 'box-shadow:0 0 12px ' + SuitColor + '44;' : ''}
        `,
      });

      CardEl.innerHTML =
        '<div style="font-size:20px;color:' + SuitColor + ';margin-bottom:4px;">\u2B50</div>' +
        '<div style="font-size:13px;font-weight:700;color:#E0EAF5;">' + Def.NameCn + '</div>' +
        '<div style="font-size:10px;color:var(--text-dim);margin-top:4px;">' + Def.EffectDescription.slice(0, 40) + '</div>' +
        '<div style="font-size:10px;color:' + SuitColor + ';margin-top:4px;">' + Def.ApCost + ' AP</div>';

      this._CleanupFns.push(On(CardEl, 'click', () => {
        this._SelectCard(Card, CardEl);
      }));
    }

    const BtnRow = El({
      Tag: 'div',
      Parent: Dialog,
      Style: 'display:flex;gap:8px;justify-content:flex-end;margin-top:16px;',
    });

    const ConfirmBtn = El({
      Tag: 'button',
      Parent: BtnRow,
      Text: '确认',
      Style: `
        padding:8px 24px;background:var(--oasis,#00E5FF);
        border:none;border-radius:6px;color:#0B0E14;
        font-size:13px;font-weight:700;cursor:pointer;
      `,
    });
    this._CleanupFns.push(On(ConfirmBtn, 'click', () => {
      this._OnConfirm(this._Selected);
    }));

    const CancelBtn = El({
      Tag: 'button',
      Parent: BtnRow,
      Text: '取消',
      Style: `
        padding:8px 24px;background:transparent;
        border:1px solid var(--text-dim);border-radius:6px;
        color:var(--text-dim);font-size:13px;cursor:pointer;
      `,
    });
    this._CleanupFns.push(On(CancelBtn, 'click', () => this._OnCancel()));

    Parent.appendChild(this._Overlay);
    this.SetRoot(this._Overlay);
  }

  private _SelectCard(Card: CardInstance, El: HTMLElement): void {
    if (this._Config.Action === 'pick') {
      this._Selected = [Card];
      const AllCards = El.parentElement!.querySelectorAll<HTMLElement>('[style*="cursor:pointer"]');
      AllCards.forEach((C) => {
        C.style.borderColor = '#2A3A4D';
        C.style.boxShadow = '';
      });
    } else {
      const Idx = this._Selected.indexOf(Card);
      if (Idx >= 0) {
        this._Selected.splice(Idx, 1);
      } else {
        this._Selected.push(Card);
      }
    }
    El.style.borderColor = SUIT_COLORS[Card.Definition.Suit] ?? '#00E5FF';
    El.style.boxShadow = '0 0 12px ' + (SUIT_COLORS[Card.Definition.Suit] ?? '#00E5FF') + '44';
  }

  protected _OnUnmount(): void {
    for (const Fn of this._CleanupFns) Fn();
    this._CleanupFns = [];
  }
}
