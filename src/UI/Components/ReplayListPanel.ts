/**
 * src/UI/Components/ReplayListPanel.ts
 * 操作类型：新建
 *
 * 回放列表面板——从 IndexedDB 加载已保存回放，提供播放/删除/导出操作。
 */

import { El, On } from '../Dom';
import { Component } from './Component';
import { GetReplays, DeleteReplay } from '@/Store/ReplayStore';

export type ReplayListAction =
  | { Kind: 'Play'; Id: string }
  | { Kind: 'Export'; Id: string }
  | { Kind: 'Close' };

export class ReplayListPanel extends Component {
  private readonly _OnAction: (Action: ReplayListAction) => void;
  private _CleanupFns: Array<() => void> = [];

  constructor(OnAction: (Action: ReplayListAction) => void) {
    super();
    this._OnAction = OnAction;
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
      Html: '对局回放<span class="sub">REPLAY ARCHIVE</span>',
    });

    const Content = El({ Tag: 'div', Class: 'mp-content', Parent: Root });
    this._RenderList(Content);

    const Back = El({
      Tag: 'button',
      Class: 'mp-back font-mono',
      Parent: Root,
      Style: 'position:absolute;bottom:24px;left:24px;',
      Text: '← 返回主菜单',
    }) as HTMLButtonElement;
    this._CleanupFns.push(On(Back, 'click', () => this._OnAction({ Kind: 'Close' })));
  }

  private async _RenderList(Content: HTMLElement): Promise<void> {
    Content.innerHTML = '';

    El({
      Tag: 'div',
      Class: 'mp-section-label',
      Parent: Content,
      Text: '已保存回放 · SAVED REPLAYS',
    });

    try {
      const Replays = await GetReplays();
      if (Replays.length === 0) {
        El({
          Tag: 'div',
          Class: 'font-mono text-dim',
          Parent: Content,
          Style: 'padding:20px;text-align:center;',
          Text: '暂无保存的回放',
        });
        return;
      }

      const Grid = El({ Tag: 'div', Class: 'mp-player-grid', Parent: Content });
      for (const R of Replays) {
        const Row = El({ Tag: 'div', Class: 'mp-player-row', Parent: Grid });
        const DateStr = new Date(R.createdAt).toLocaleString('zh-CN');

        El({
          Tag: 'span',
          Class: 'mp-player-name',
          Parent: Row,
          Text: `种子 ${R.seed} · ${R.playerCount}人局 · ${R.totalTurns}回合`,
        });
        El({
          Tag: 'span',
          Class: 'mp-player-tags',
          Parent: Row,
          Html: `<span class="mp-tag" style="font-size:10px;color:var(--text-dim);">${DateStr}</span>`,
        });

        const PlayBtn = El({
          Tag: 'button',
          Class: 'console-btn steady',
          Parent: Row,
          Text: '播放',
          Style: 'font-size:11px;padding:4px 12px;',
        }) as HTMLButtonElement;
        this._CleanupFns.push(On(PlayBtn, 'click', () => this._OnAction({ Kind: 'Play', Id: R.id })));

        const ExportBtn = El({
          Tag: 'button',
          Class: 'console-btn pass',
          Parent: Row,
          Text: '导出',
          Style: 'font-size:11px;padding:4px 12px;',
        }) as HTMLButtonElement;
        this._CleanupFns.push(On(ExportBtn, 'click', () => this._OnAction({ Kind: 'Export', Id: R.id })));

        const DelBtn = El({
          Tag: 'button',
          Class: 'console-btn aggressive',
          Parent: Row,
          Text: '删除',
          Style: 'font-size:11px;padding:4px 12px;',
        }) as HTMLButtonElement;
        this._CleanupFns.push(On(DelBtn, 'click', async () => {
          await DeleteReplay(R.id);
          this._RenderList(Content);
        }));
      }
    } catch (Err) {
      El({
        Tag: 'div',
        Class: 'font-mono text-dim',
        Parent: Content,
        Style: 'padding:20px;text-align:center;',
        Text: `加载回放列表失败: ${(Err as Error).message}`,
      });
    }
  }

  protected _OnUnmount(): void {
    this._CleanupFns.forEach((Fn) => Fn());
    this._CleanupFns = [];
  }
}
