import { Component } from './Component';
import { El, On } from '@/UI/Dom';

export interface DiceSelectorConfig {
  readonly Title: string;
  readonly DiceCount: 1 | 2;
  readonly Defaults: [number] | [number, number];
}

export class DiceSelector extends Component {
  private readonly _Config: DiceSelectorConfig;
  private readonly _OnConfirm: (Values: number[]) => void;
  private readonly _OnCancel: () => void;
  private _Values: number[];
  private _Overlay!: HTMLElement;
  private _CleanupFns: Array<() => void> = [];

  constructor(Config: DiceSelectorConfig, OnConfirm: (Values: number[]) => void, OnCancel: () => void) {
    super();
    this._Config = Config;
    this._OnConfirm = OnConfirm;
    this._OnCancel = OnCancel;
    this._Values = [...Config.Defaults];
  }

  Mount(Parent: HTMLElement): void {
    this._Overlay = El({
      Tag: 'div',
      Style: `
        position:fixed;inset:0;z-index:9999;
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
        border-radius:12px;padding:24px 32px;
        text-align:center;
        box-shadow:0 0 40px rgba(0,229,255,.15);
      `,
    });

    El({
      Tag: 'h3', Parent: Dialog,
      Style: 'margin:0 0 16px;font-size:16px;color:var(--oasis,#00E5FF);',
      Text: this._Config.Title,
    });

    const DiceRow = El({
      Tag: 'div',
      Parent: Dialog,
      Style: 'display:flex;gap:16px;justify-content:center;margin-bottom:20px;',
    });

    const RenderDie = (Idx: number) => {
      const DieContainer = El({
        Tag: 'div',
        Parent: DiceRow,
        Style: 'display:flex;flex-direction:column;align-items:center;gap:8px;',
      });

      const DieFace = El({
        Tag: 'div',
        Parent: DieContainer,
        Style: `
          width:80px;height:80px;border-radius:12px;
          background:#fff;border:3px solid #333;
          display:flex;align-items:center;justify-content:center;
          font-size:36px;font-weight:900;color:#0B0E14;
          transition:transform 0.1s;
        `,
        Text: '\u2680',
      });

      const updateFace = () => {
        const faces = ['\u2680', '\u2681', '\u2682', '\u2683', '\u2684', '\u2685'];
        DieFace.textContent = faces[this._Values[Idx] - 1];
      };

      const BtnRow = El({
        Tag: 'div',
        Parent: DieContainer,
        Style: 'display:flex;gap:4px;',
      });

      for (let V = 1; V <= 6; V++) {
        const Btn = El({
          Tag: 'button',
          Parent: BtnRow,
          Text: String(V),
          Style: `
            width:28px;height:28px;font-size:13px;font-weight:700;
            border:1px solid ${this._Values[Idx] === V ? 'var(--oasis,#00E5FF)' : 'var(--text-dim)'};
            border-radius:4px;
            background:${this._Values[Idx] === V ? 'rgba(0,229,255,.15)' : 'transparent'};
            color:${this._Values[Idx] === V ? 'var(--oasis,#00E5FF)' : 'var(--text-dim)'};
            cursor:pointer;
          `,
        });
        this._CleanupFns.push(On(Btn, 'click', () => {
          this._Values[Idx] = V;
          updateFace();
          const AllBtns = BtnRow.querySelectorAll('button');
          AllBtns.forEach((B) => {
            (B as HTMLElement).style.borderColor = 'var(--text-dim)';
            (B as HTMLElement).style.background = 'transparent';
            (B as HTMLElement).style.color = 'var(--text-dim)';
          });
          Btn.style.borderColor = 'var(--oasis,#00E5FF)';
          Btn.style.background = 'rgba(0,229,255,.15)';
          Btn.style.color = 'var(--oasis,#00E5FF)';
        }));
      }

      updateFace();
    };

    RenderDie(0);
    if (this._Config.DiceCount === 2) RenderDie(1);

    const ConfirmBtn = El({
      Tag: 'button',
      Parent: Dialog,
      Text: '确认',
      Style: `
        padding:10px 40px;background:var(--oasis,#00E5FF);
        border:none;border-radius:8px;color:#0B0E14;
        font-size:15px;font-weight:700;cursor:pointer;
      `,
    });
    this._CleanupFns.push(On(ConfirmBtn, 'click', () => {
      this._OnConfirm(this._Values);
    }));

    Parent.appendChild(this._Overlay);
    this.SetRoot(this._Overlay);
  }

  protected _OnUnmount(): void {
    for (const Fn of this._CleanupFns) Fn();
    this._CleanupFns = [];
  }
}
