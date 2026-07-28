import { html, render, type TemplateResult } from 'lit-html';
import { Component } from './Component';
import { GetReplays, DeleteReplay, type ReplayListItem } from '@/Store/ReplayStore';

export interface ReplayPanelCallbacks {
  OnClose: () => void;
}

export class ReplayPanel extends Component {
  private readonly _Callbacks: ReplayPanelCallbacks;
  private readonly _Replays: ReplayListItem[];
  private _SelectedId: string | null = null;

  constructor(Callbacks: ReplayPanelCallbacks) {
    super();
    this._Callbacks = Callbacks;
    this._Replays = GetReplays();
  }

  Mount(Parent: HTMLElement): void {
    const Root = document.createElement('div');
    Root.className = 'absolute inset-0 z-200';
    Parent.appendChild(Root);
    this.SetRoot(Root);
    this.Update();
  }

  Update(): void {
    render(this.Template(), this.Root);
  }

  Template(): TemplateResult {
    const Selected = this._Replays.find((R) => R.Id === this._SelectedId) ?? null;

    return html`
      <div class="absolute inset-0 z-[200] flex items-center justify-center bg-black/70 p-4" @click=${() => this._Callbacks.OnClose()}>
        <div class="flex h-full max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-nm-shadow-light bg-nm-bg shadow-2xl" @click=${(E: Event) => E.stopPropagation()}>
          <div class="flex items-center justify-between border-b border-nm-shadow-light px-4 py-3 md:px-6">
            <div class="font-display text-lg font-bold text-nm-text">战局回放</div>
            <button class="text-nm-text-dim hover:text-nm-text" @click=${() => this._Callbacks.OnClose()}>✕</button>
          </div>
          ${Selected ? this._DetailTemplate(Selected) : this._ListTemplate()}
        </div>
      </div>
    `;
  }

  private _ListTemplate(): TemplateResult {
    return html`
      <div class="flex-1 overflow-y-auto p-4">
        ${this._Replays.length === 0 ? html`
          <div class="flex h-full items-center justify-center font-mono text-sm text-nm-text-dim">
            暂无回放记录，完成一局游戏后自动保存。
          </div>
        ` : html`
          <div class="flex flex-col gap-2">
            ${this._Replays.map((R) => html`
              <div
                class="cursor-pointer rounded-lg border border-nm-shadow-light bg-nm-bg p-3 transition hover:border-nm-text md:p-4"
                @click=${() => { this._SelectedId = R.Id; this.Update(); }}
              >
                <div class="flex items-center justify-between">
                  <div class="font-display font-bold text-nm-text">${R.WinnerName} 胜</div>
                  <div class="font-mono text-xs text-nm-text-dim">${this._FormatTime(R.Timestamp)}</div>
                </div>
                <div class="mt-1 flex gap-3 font-mono text-xs text-nm-text-secondary">
                  <span>${R.PlayerCount}人局</span>
                  <span>种子 ${R.Seed}</span>
                  <span>${R.TotalTurns}回合</span>
                  <span>最高 ${R.WinnerScore}</span>
                </div>
                <div class="mt-2 flex gap-2">
                  <button
                    class="rounded border border-nm-shadow-light px-2 py-1 font-mono text-xs text-nm-text-dim hover:border-alert hover:text-alert"
                    @click=${(E: Event) => { E.stopPropagation(); DeleteReplay(R.Id); this.Update(); }}
                  >删除</button>
                </div>
              </div>
            `)}
          </div>
        `}
      </div>
      <div class="border-t border-nm-shadow-light p-3">
        <button
          class="w-full rounded border border-nm-shadow-light bg-nm-bg py-2 font-mono text-sm text-nm-text transition hover:border-nm-text"
          @click=${() => this._Callbacks.OnClose()}
        >关闭</button>
      </div>
    `;
  }

  private _DetailTemplate(Replay: ReplayListItem): TemplateResult {
    return html`
      <div class="flex items-center justify-between border-b border-nm-shadow-light px-4 py-2">
        <div class="flex items-center gap-3 font-mono text-xs text-nm-text-secondary">
          <span>${Replay.WinnerName} 胜</span>
          <span class="text-nm-text-dim">·</span>
          <span>${Replay.PlayerCount}人</span>
          <span class="text-nm-text-dim">·</span>
          <span>种子 ${Replay.Seed}</span>
          <span class="text-nm-text-dim">·</span>
          <span>${Replay.TotalTurns}回合</span>
        </div>
        <button
          class="font-mono text-xs text-nm-text-dim hover:text-nm-text"
          @click=${() => { this._SelectedId = null; this.Update(); }}
        >← 返回</button>
      </div>
      <div class="flex-1 overflow-y-auto bg-nm-bg p-3">
        <div class="rounded-lg border border-nm-shadow-light bg-nm-bg p-3">
          ${Replay.Log.map((Line) => html`
            <div class="mb-1 font-mono text-[11px] leading-relaxed text-nm-text-secondary">${Line}</div>
          `)}
        </div>
      </div>
      <div class="border-t border-nm-shadow-light p-3 flex gap-2">
        <button
          class="rounded border border-nm-shadow-light bg-nm-bg px-3 py-2 font-mono text-xs text-alert hover:border-alert"
          @click=${() => { DeleteReplay(Replay.Id); this._SelectedId = null; this.Update(); }}
        >删除此回放</button>
        <button
          class="flex-1 rounded border border-nm-shadow-light bg-nm-bg py-2 font-mono text-sm text-nm-text transition hover:border-nm-text"
          @click=${() => this._Callbacks.OnClose()}
        >关闭</button>
      </div>
    `;
  }

  private _FormatTime(Ts: number): string {
    const D = new Date(Ts);
    return `${D.getFullYear()}-${String(D.getMonth() + 1).padStart(2, '0')}-${String(D.getDate()).padStart(2, '0')} ${String(D.getHours()).padStart(2, '0')}:${String(D.getMinutes()).padStart(2, '0')}`;
  }
}
