/**
 * src/UI/Components/GameOverScreen.ts
 * 操作类型：新建
 *
 * 终局界面：显示胜者 + 终局领土 + 重新开始
 * 关联：B 阶段架构方案 §5
 *
 * 设计要点：
 * 1. 全屏覆盖，胜者阵营色高亮
 * 2. 显示各玩家终局私有领土
 * 3. 加赛历史（若有）
 * 4. 重新开始 / 返回主菜单按钮
 */
import type { GameResult } from '@/Types/GameResult';
import { PlayerPalette } from '@/Store/PlayerPalette';
import { TweenNumber } from '@/UI/Anim/Tween';
import { El } from '../Dom';
import { Component } from './Component';

/**
 * 终局界面回调
 */
export interface GameOverCallbacks {
  OnRestart: () => void;
  OnBackToMenu: () => void;
  OnSaveReplay?: () => void;
}

/**
 * 终局界面
 */
export class GameOverScreen extends Component {
  private readonly _Callbacks: GameOverCallbacks;

  constructor(Callbacks: GameOverCallbacks) {
    super();
    this._Callbacks = Callbacks;
  }

  Mount(Parent: HTMLElement): void {
    const Root = El({
      Tag: 'div',
      Class: 'gameover-screen',
      Parent,
      Style:
        'position:absolute;inset:0;z-index:200;display:flex;' +
        'align-items:center;justify-content:center;' +
        'background:rgba(0,0,0,0.9);',
    });
    this.SetRoot(Root);
  }

  /**
   * 显示终局结果
   * 注意：不命名为 Show 以避免与基类 Component.Show() 签名冲突
   */
  ShowResult(Result: GameResult): void {
    const Root = this.Root;
    Root.innerHTML = '';
    const Winner = Result.Winners[0];
    const WinnerColor = PlayerPalette.Color(Winner.Id);
    const IsTiebreaker = Result.TiebreakerHistory.length > 0;

    const Card = El({
      Tag: 'div',
      Class: 'gameover-card cockpit',
      Parent: Root,
      Style: 'padding:48px 64px;max-width:520px;width:90%;text-align:center;',
    });
    // 注入胜者阵营色供 CSS 角标/描边使用
    Card.style.setProperty('--c', WinnerColor);
    Card.style.setProperty('--c-glow', `${WinnerColor}40`);

    // 标题
    El({
      Tag: 'div',
      Class: 'font-mono',
      Parent: Card,
      Style: 'font-size:12px;color:var(--text-dim);margin-bottom:8px;letter-spacing:3px;',
      Text: 'GAME OVER',
    });

    // 胜者
    El({
      Tag: 'div',
      Class: 'font-display',
      Parent: Card,
      Style:
        `font-size:42px;font-weight:900;color:${WinnerColor};margin-bottom:8px;`,
      Text: PlayerPalette.LabelLong(Winner.Id),
    });
    // 胜者描述（私有领土数字做计数缓动）
    const WinnerLine = El({
      Tag: 'div',
      Class: 'font-mono',
      Parent: Card,
      Style: 'font-size:14px;color:var(--text-secondary);margin-bottom:32px;',
      Text: `${PlayerPalette.Codename(Winner.Id)} · 私有领土 `,
    });
    const WinnerNum = El({ Tag: 'span', Parent: WinnerLine, Text: '0' });
    TweenNumber(WinnerNum, Winner.PrivateTerritory, 900);

    // 加赛标记
    if (IsTiebreaker) {
      El({
        Tag: 'div',
        Class: 'font-mono text-hazard',
        Parent: Card,
        Style: 'font-size:12px;margin-bottom:24px;',
        Text: `经 ${Result.TiebreakerHistory.length} 轮加赛决出胜者`,
      });
    }

    // 终局领土一览
    const Snap = Result.FinalSnapshot;
    const ListEl = El({
      Tag: 'div',
      Parent: Card,
      Style:
        'display:flex;flex-direction:column;gap:6px;margin-bottom:32px;' +
        'padding:16px;background:var(--space-bg);border:1px solid var(--space-border);',
    });
    El({
      Tag: 'div',
      Class: 'font-mono text-dim',
      Parent: ListEl,
      Style: 'font-size:11px;margin-bottom:4px;',
      Text: `公共剩余 ${Snap.PublicTerritory}`,
    });
    // 按私有领土降序排列
    const Sorted = [...Snap.Players].sort((A, B) => B.PrivateTerritory - A.PrivateTerritory);
    for (const P of Sorted) {
      const Color = PlayerPalette.Color(P.Id);
      const Row = El({
        Tag: 'div',
        Parent: ListEl,
        Class: 'font-mono',
        Style:
          `display:flex;justify-content:space-between;` +
          `padding:4px 8px;border-left:3px solid ${Color};`,
      });
      El({
        Tag: 'span',
        Parent: Row,
        Style: `color:${Color};`,
        Text: PlayerPalette.LabelLong(P.Id),
      });
      El({
        Tag: 'span',
        Parent: Row,
        Style: 'color:var(--text-primary);',
        Text: String(P.PrivateTerritory),
      });
    }

    // 按钮
    const BtnRow = El({
      Tag: 'div',
      Parent: Card,
      Style: 'display:flex;gap:12px;',
    });
    const RestartBtn = El({
      Tag: 'button',
      Class: 'go-btn restart font-mono',
      Parent: BtnRow,
      Style: 'padding:14px;font-size:12px;letter-spacing:1px;',
      Text: '再来一局',
    });
    RestartBtn.addEventListener('click', () => this._Callbacks.OnRestart());

    if (this._Callbacks.OnSaveReplay) {
      const SaveBtn = El({
        Tag: 'button',
        Class: 'go-btn menu font-mono',
        Parent: BtnRow,
        Style: 'padding:14px;font-size:12px;letter-spacing:1px;',
        Text: '保存回放',
      });
      SaveBtn.addEventListener('click', () => this._Callbacks.OnSaveReplay!());
    }

    const MenuBtn = El({
      Tag: 'button',
      Class: 'go-btn menu font-mono',
      Parent: BtnRow,
      Style: 'padding:14px;font-size:12px;letter-spacing:1px;',
      Text: '返回菜单',
    });
    MenuBtn.addEventListener('click', () => this._Callbacks.OnBackToMenu());

    Root.style.display = 'flex';
  }

  Hide(): void {
    this.Root.style.display = 'none';
  }
}
