import { html, render, type TemplateResult } from 'lit-html';
import { Component } from './Component';

export interface RulebookPanelCallbacks {
  OnClose: () => void;
}

interface RuleSection {
  Title: string;
  Body: string;
}

const SECTIONS: RuleSection[] = [
  {
    Title: '1. 游戏目标',
    Body: '公共领土从 100 开始，被玩家占领、抢夺、崩坏消耗至 0 时游戏结束。此时私有领土最高者获胜。若平局则进入加赛。',
  },
  {
    Title: '2. 发射阶段',
    Body: '每局开始所有玩家需进行发射：掷双骰，点数和 ≥7 成功，获得 +2 私有领土并进入主循环；失败则继续尝试发射。',
  },
  {
    Title: '3. 回合选择',
    Body: '稳健模式：掷单骰 1-6，安全占领。激进模式：掷双骰 2-12，若和 ≤6 则私有领土倒扣回公共。不开发：跳过掷骰但清零连击。',
  },
  {
    Title: '4. 开发链',
    Body: '连续掷出对子可触发连击：第 1 次 ×2、第 2 次 ×3、第 3 次开发过度，私有清零并变为荒地，需重新发射。',
  },
  {
    Title: '5. 抢夺',
    Body: '当占领后公共领土将低于 0 时触发抢夺。发起者与私有最高者掷单骰对决，胜者从败者处获得领土，败者部分领土回归公共。',
  },
  {
    Title: '6. 崩坏',
    Body: '第二次抢夺后触发崩坏。所有玩家随机损失领土，崩坏系数逐次递增。损失守恒，私有不足者由发起者承担缺口。',
  },
  {
    Title: '7. 终局与加赛',
    Body: '公共归零时比较私有领土；最高者胜。若最高者并列，则进入加赛：平手者双骰对决，直至分出胜负。',
  },
];

export class RulebookPanel extends Component {
  private readonly _Callbacks: RulebookPanelCallbacks;
  private _OpenIndex = 0;

  constructor(Callbacks: RulebookPanelCallbacks) {
    super();
    this._Callbacks = Callbacks;
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
    return html`
      <div class="absolute inset-0 z-[200] flex items-center justify-center bg-black/70 p-4" @click=${() => this._Callbacks.OnClose()}>
        <div class="flex h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-nm-shadow-light bg-nm-bg p-6 shadow-2xl" @click=${(E: Event) => E.stopPropagation()}>
          <div class="mb-4 flex items-center justify-between">
            <div class="font-display text-xl font-bold text-nm-text">规则书</div>
            <button class="text-nm-text-dim hover:text-nm-text" @click=${() => this._Callbacks.OnClose()}>✕</button>
          </div>
          <div class="flex-1 overflow-y-auto pr-2">
            ${SECTIONS.map((S, I) => html`
              <div class="mb-2 rounded-lg border border-nm-shadow-light bg-nm-bg">
                <button
                  class="flex w-full items-center justify-between px-4 py-3 text-left font-display font-bold text-nm-text"
                  @click=${() => { this._OpenIndex = this._OpenIndex === I ? -1 : I; this.Update(); }}
                >
                  <span>${S.Title}</span>
                  <span class="text-nm-text-dim">${this._OpenIndex === I ? '▴' : '▾'}</span>
                </button>
                ${this._OpenIndex === I ? html`
                  <div class="px-4 pb-4 font-mono text-sm leading-relaxed text-nm-text-secondary">${S.Body}</div>
                ` : null}
              </div>
            `)}
          </div>
          <button
            class="mt-4 rounded border border-nm-shadow-light bg-nm-bg py-2 font-mono text-sm text-nm-text transition hover:border-nm-text"
            @click=${() => this._Callbacks.OnClose()}
          >关闭</button>
        </div>
      </div>
    `;
  }
}
