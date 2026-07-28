import { El } from '../Dom';
import { Component } from './Component';
import { PlayerPalette } from '@/Store/PlayerPalette';
import { TweenNumber } from '@/UI/Anim/Tween';

export class HeaderHud extends Component {
  private _PublicNum!: HTMLElement;
  private _PhaseLabel!: HTMLElement;
  private _CollapseLabel!: HTMLElement;
  private _RobberyLabel!: HTMLElement;
  private _RoundLabel!: HTMLElement;
  private _FirstPlayerLabel!: HTMLElement;

  Mount(Parent: HTMLElement): void {
    const Header = El({
      Tag: 'div',
      Class: 'stage-header panel-surface',
      Parent,
    });
    El({
      Tag: 'div',
      Class: 'font-display',
      Parent: Header,
      Style: 'font-size:16px;font-weight:900;color:var(--oasis);letter-spacing:1px;',
      Text: '第二绿洲 · 作战沙盘',
    });
    const Stats = El({ Tag: 'div', Class: 'stage-stats', Parent: Header });

    this._PhaseLabel = El({
      Tag: 'span', Class: 'font-mono', Parent: Stats,
      Style: 'font-size:12px;color:var(--text-secondary);',
      Text: '阶段: -',
    });
    const Pl = El({
      Tag: 'span', Class: 'font-mono text-oasis', Parent: Stats,
      Style: 'font-size:14px;font-weight:bold;',
      Text: '公共: ',
    });
    this._PublicNum = El({ Tag: 'span', Parent: Pl, Text: '100' });

    this._CollapseLabel = El({
      Tag: 'span', Class: 'font-mono text-hazard', Parent: Stats,
      Style: 'font-size:12px;',
      Text: '崩坏 x2',
    });
    this._RobberyLabel = El({
      Tag: 'span', Class: 'font-mono text-dim', Parent: Stats,
      Style: 'font-size:12px;',
      Text: '抢夺: 0',
    });
    this._RoundLabel = El({
      Tag: 'span', Class: 'font-mono text-dim', Parent: Stats,
      Style: 'font-size:12px;',
      Text: '轮次: 1',
    });
    this._FirstPlayerLabel = El({
      Tag: 'span', Class: 'font-mono text-dim', Parent: Stats,
      Style: 'font-size:12px;',
      Text: '先手: -',
    });

    this.SetRoot(Header);
  }

  SetPhase(Phase: string): void {
    this._PhaseLabel.textContent = `阶段: ${Phase}`;
  }

  Refresh(
    PublicTerritory: number,
    CollapseX: number,
    RobberyTriggeredCount: number,
    RoundIndex: number,
    FirstPlayerIndex: number,
  ): void {
    TweenNumber(this._PublicNum, PublicTerritory);
    this._CollapseLabel.textContent = `崩坏 x${CollapseX}`;
    this._RobberyLabel.textContent = `抢夺: ${RobberyTriggeredCount}`;
    this._RoundLabel.textContent = `轮次: ${RoundIndex + 1}`;
    this._FirstPlayerLabel.textContent = `先手: ${PlayerPalette.LabelShort(FirstPlayerIndex)}`;
  }

  GetPublicNumEl(): HTMLElement {
    return this._PublicNum;
  }

  GetRoundLabel(): HTMLElement {
    return this._RoundLabel;
  }
}
