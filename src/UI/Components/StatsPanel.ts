import { html, render, type TemplateResult } from 'lit-html';
import { Component } from './Component';

export interface StatsPanelCallbacks {
  OnClose: () => void;
}

interface StatsRecord {
  GamesPlayed: number;
  Wins: number;
  AvgTurns: number;
  FavoriteMode: string;
  MaxPrivate: number;
  Achievements: string[];
}

const STORAGE_KEY = 'second-oasis-stats';

function LoadStats(): StatsRecord {
  try {
    const Raw = localStorage.getItem(STORAGE_KEY);
    if (Raw) return JSON.parse(Raw) as StatsRecord;
  } catch {
    // ignore
  }
  return {
    GamesPlayed: 0,
    Wins: 0,
    AvgTurns: 0,
    FavoriteMode: '-',
    MaxPrivate: 0,
    Achievements: [],
  };
}

export class StatsPanel extends Component {
  private readonly _Callbacks: StatsPanelCallbacks;
  private readonly _Stats: StatsRecord;

  constructor(Callbacks: StatsPanelCallbacks) {
    super();
    this._Callbacks = Callbacks;
    this._Stats = LoadStats();
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
    const WinRate = this._Stats.GamesPlayed > 0 ? Math.round((this._Stats.Wins / this._Stats.GamesPlayed) * 100) : 0;
    return html`
      <div class="absolute inset-0 z-[200] flex items-center justify-center bg-black/70 p-4" @click=${() => this._Callbacks.OnClose()}>
        <div class="w-full max-w-md rounded-xl border border-nm-shadow-light bg-nm-bg p-6 shadow-2xl" @click=${(E: Event) => E.stopPropagation()}>
          <div class="mb-4 flex items-center justify-between">
            <div class="font-display text-xl font-bold text-nm-text">成就与统计</div>
            <button class="text-nm-text-dim hover:text-nm-text" @click=${() => this._Callbacks.OnClose()}>✕</button>
          </div>
          <div class="mb-4 grid grid-cols-2 gap-3">
            <div class="rounded-lg border border-nm-shadow-light bg-nm-bg p-3 text-center">
              <div class="font-mono text-2xl font-bold text-oasis-accent">${this._Stats.GamesPlayed}</div>
              <div class="font-mono text-xs text-nm-text-dim">对局数</div>
            </div>
            <div class="rounded-lg border border-nm-shadow-light bg-nm-bg p-3 text-center">
              <div class="font-mono text-2xl font-bold text-safe">${WinRate}%</div>
              <div class="font-mono text-xs text-nm-text-dim">胜率</div>
            </div>
            <div class="rounded-lg border border-nm-shadow-light bg-nm-bg p-3 text-center">
              <div class="font-mono text-2xl font-bold text-nm-text">${this._Stats.AvgTurns}</div>
              <div class="font-mono text-xs text-nm-text-dim">平均回合</div>
            </div>
            <div class="rounded-lg border border-nm-shadow-light bg-nm-bg p-3 text-center">
              <div class="font-mono text-2xl font-bold text-hazard">${this._Stats.MaxPrivate}</div>
              <div class="font-mono text-xs text-nm-text-dim">最高私有</div>
            </div>
          </div>
          <div class="mb-4 rounded-lg border border-nm-shadow-light bg-nm-bg p-3">
            <div class="mb-1 font-mono text-xs text-nm-text-dim">偏好模式</div>
            <div class="font-display font-bold text-nm-text">${this._Stats.FavoriteMode}</div>
          </div>
          <div class="mb-6 rounded-lg border border-nm-shadow-light bg-nm-bg p-3">
            <div class="mb-2 font-mono text-xs text-nm-text-dim">成就</div>
            ${this._Stats.Achievements.length > 0 ? html`
              <div class="flex flex-wrap gap-2">
                ${this._Stats.Achievements.map((A) => html`
                  <span class="rounded-full border border-oasis-accent px-3 py-1 font-mono text-xs text-oasis-accent">${A}</span>
                `)}
              </div>
            ` : html`
              <div class="font-mono text-xs text-nm-text-secondary">暂无成就，开始一局游戏解锁。</div>
            `}
          </div>
          <button
            class="w-full rounded border border-nm-shadow-light bg-nm-bg py-2 font-mono text-sm text-nm-text transition hover:border-nm-text"
            @click=${() => this._Callbacks.OnClose()}
          >关闭</button>
        </div>
      </div>
    `;
  }
}
