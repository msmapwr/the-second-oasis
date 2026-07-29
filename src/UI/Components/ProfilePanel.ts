/**
 * src/UI/Components/ProfilePanel.ts
 * 操作类型：新建
 *
 * 玩家档案面板——展示累局统计、胜率、花色分布、最常用牌。
 */

import { El, On } from '../Dom';
import { Component } from './Component';
import { GetStats, GetWinRate, GetTopCards, GetSuitBreakdown, ClearStats } from '@/Store/StatsStore';

export class ProfilePanel extends Component {
  private readonly _OnClose: () => void;
  private _CleanupFns: Array<() => void> = [];
  private _Cleared = false;

  constructor(OnClose: () => void) {
    super();
    this._OnClose = OnClose;
  }

  Mount(Parent: HTMLElement): void {
    const Root = El({
      Tag: 'div',
      Class: 'cockpit mp-lobby',
      Parent,
      Style: 'position:absolute;inset:0;z-index:100;',
    });
    this.SetRoot(Root);

    const Top = El({ Tag: 'div', Class: 'cockpit-topbar', Parent: Root });
    El({
      Tag: 'div',
      Class: 'cockpit-title font-display',
      Parent: Top,
      Html: '玩家档案<span class="sub">PROFILE · ARCHIVE</span>',
    });

    const Content = El({
      Tag: 'div',
      Class: 'mp-content',
      Parent: Root,
      Style: 'overflow-y:auto;',
    });
    this._RenderContent(Content);

    const BtnRow = El({
      Tag: 'div',
      Class: 'mp-action-row',
      Parent: Root,
      Style: 'position:absolute;bottom:24px;left:24px;right:24px;',
    });
    const BackBtn = El({
      Tag: 'button',
      Class: 'mp-back font-mono',
      Parent: BtnRow,
      Text: '← 返回主菜单',
    }) as HTMLButtonElement;
    this._CleanupFns.push(On(BackBtn, 'click', () => this._OnClose()));

    const ClearBtn = El({
      Tag: 'button',
      Class: 'console-btn aggressive',
      Parent: BtnRow,
      Text: '清除统计',
      Style: 'font-size:11px;margin-left:12px;',
    }) as HTMLButtonElement;
    this._CleanupFns.push(On(ClearBtn, 'click', () => this._DoClear(Content)));
  }

  private _RenderContent(Content: HTMLElement): void {
    Content.innerHTML = '';

    if (this._Cleared) {
      El({
        Tag: 'div',
        Class: 'font-mono',
        Parent: Content,
        Style: 'padding:40px;text-align:center;color:var(--text-dim);',
        Text: '统计数据已清空。开始你的第一局吧！',
      });
      return;
    }

    const Stats = GetStats();
    if (Stats.TotalGames === 0) {
      El({
        Tag: 'div',
        Class: 'font-mono',
        Parent: Content,
        Style: 'padding:40px;text-align:center;color:var(--text-dim);',
        Text: '暂无游戏记录。完成一局对局后自动开始统计。',
      });
      return;
    }

    // 总览
    El({
      Tag: 'div',
      Class: 'mp-section-label',
      Parent: Content,
      Text: '总览 · OVERVIEW',
    });
    const Grid = El({
      Tag: 'div',
      Parent: Content,
      Style: 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;',
    });
    this._StatCard(Grid, '总局数', String(Stats.TotalGames));
    this._StatCard(Grid, '胜率', GetWinRate());
    this._StatCard(Grid, '最大领土', String(Stats.MaxTerritory));
    this._StatCard(Grid, '最长开发链', Stats.MaxDevChain > 0 ? `${Stats.MaxDevChain}x` : '—');
    this._StatCard(Grid, '最多抢夺胜', Stats.MaxRobberyWins > 0 ? String(Stats.MaxRobberyWins) : '—');
    this._StatCard(Grid, '最长对局', Stats.LongestGame > 0 ? `${Stats.LongestGame} 回合` : '—');

    // 花色分布
    El({
      Tag: 'div',
      Class: 'mp-section-label',
      Parent: Content,
      Text: '花色使用 · SUIT BREAKDOWN',
    });
    const Suits = GetSuitBreakdown();
    const SuitSection = El({
      Tag: 'div',
      Parent: Content,
      Style: 'display:flex;flex-direction:column;gap:6px;margin-bottom:20px;',
    });
    for (const S of Suits) {
      const Row = El({
        Tag: 'div',
        Parent: SuitSection,
        Style: 'display:flex;align-items:center;gap:10px;',
      });
      El({
        Tag: 'span',
        Class: 'font-mono',
        Parent: Row,
        Style: 'width:80px;font-size:12px;color:var(--text-secondary);',
        Text: S.Label,
      });
      const Bar = El({
        Tag: 'div',
        Parent: Row,
        Style: `flex:1;height:14px;background:var(--nm-bg);border-radius:4px;overflow:hidden;`,
      });
      const Pct = S.Pct;
      const PctNum = parseFloat(Pct);
      El({
        Tag: 'div',
        Parent: Bar,
        Style: `width:${Math.max(PctNum, 3)}%;height:100%;background:var(--oasis);border-radius:4px;`,
      });
      El({
        Tag: 'span',
        Class: 'font-mono',
        Parent: Row,
        Style: 'width:50px;font-size:11px;color:var(--text-dim);text-align:right;',
        Text: `${S.Count} (${Pct})`,
      });
    }

    // TOP 5 卡牌
    El({
      Tag: 'div',
      Class: 'mp-section-label',
      Parent: Content,
      Text: '最常用牌 · TOP 5',
    });
    const TopCards = GetTopCards(5);
    if (TopCards.length > 0) {
      const CardList = El({
        Tag: 'div',
        Parent: Content,
        Style: 'display:flex;flex-direction:column;gap:4px;',
      });
      for (let I = 0; I < TopCards.length; I++) {
        const C = TopCards[I];
        El({
          Tag: 'div',
          Class: 'font-mono',
          Parent: CardList,
          Style: 'display:flex;justify-content:space-between;padding:4px 8px;font-size:12px;',
          Text: `#${I + 1} ${C.Name} × ${C.Count}`,
        });
      }
    }
  }

  private _StatCard(Parent: HTMLElement, Label: string, Value: string): void {
    const Card = El({
      Tag: 'div',
      Parent,
      Style: 'padding:12px;background:var(--nm-bg);box-shadow:var(--nm-raised);border-radius:var(--nm-radius-container);text-align:center;',
    });
    El({
      Tag: 'div',
      Class: 'font-mono',
      Parent: Card,
      Style: 'font-size:10px;color:var(--text-dim);margin-bottom:4px;',
      Text: Label,
    });
    El({
      Tag: 'div',
      Class: 'font-display',
      Parent: Card,
      Style: 'font-size:22px;font-weight:700;color:var(--oasis);',
      Text: Value,
    });
  }

  private _DoClear(Content: HTMLElement): void {
    ClearStats();
    this._Cleared = true;
    this._RenderContent(Content);
  }

  protected _OnUnmount(): void {
    this._CleanupFns.forEach((Fn) => Fn());
    this._CleanupFns = [];
  }
}
