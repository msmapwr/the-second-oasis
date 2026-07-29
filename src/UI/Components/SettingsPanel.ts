/**
 * src/UI/Components/SettingsPanel.ts
 * 操作类型：新建
 *
 * 设置面板：主题切换 + 动画速度 + 音效 + CRT 效果 + 字号 + FPS 显示
 * 飞船控制台风格，从右侧滑入
 */
import { El, On, Clear } from '../Dom';
import { Component } from './Component';
import { ThemeManagerInstance, type ThemeMode } from '@/UI/ThemeManager';
import { AccessibilitySettings } from '@/Audio/AccessibilitySettings';
import { RunSimulation } from '@/Core/MonteCarloSimulation';
import { ALL_TAROT_CARDS } from '@/Core/Card/CardData';
import type { CardDefinition } from '@/Types/Card';

export interface SettingsCallbacks {
  OnClose: () => void;
  OnSpeedModeChange: (V: boolean) => void;
  IsSpeedMode: () => boolean;
  OnRequestQuit?: () => void;
}

export class SettingsPanel extends Component {
  private readonly _Callbacks: SettingsCallbacks;
  private readonly _Accessibility: AccessibilitySettings;
  private _CleanupFns: (() => void)[] = [];
  private _ActiveTab: 'general' | 'datalab' = 'general';
  private _ContentBody: HTMLElement | null = null;

  constructor(Callbacks: SettingsCallbacks, Accessibility: AccessibilitySettings) {
    super();
    this._Callbacks = Callbacks;
    this._Accessibility = Accessibility;
  }

  Mount(Parent: HTMLElement): void {
    const Overlay = El({
      Tag: 'div',
      Class: 'settings-overlay',
      Parent,
      Style: 'position:fixed;inset:0;z-index:500;display:flex;align-items:center;justify-content:center;',
    });
    this.SetRoot(Overlay);

    this._CleanupFns.push(
      On(Overlay, 'click', (E) => {
        if (E.target === Overlay) this._Callbacks.OnClose();
      }),
    );

    const Panel = El({
      Tag: 'div',
      Class: 'settings-panel',
      Parent: Overlay,
    });

    this._BuildHeader(Panel);
    this._BuildTabs(Panel);
    this._ContentBody = El({ Tag: 'div', Class: 'settings-body', Parent: Panel });
    this._BuildGeneral(this._ContentBody);

    this._CleanupFns.push(
      On(document, 'keydown', (E: Event) => {
        if ((E as KeyboardEvent).key === 'Escape') this._Callbacks.OnClose();
      }),
    );
  }

  private _BuildHeader(Panel: HTMLElement): void {
    const Header = El({
      Tag: 'div',
      Class: 'settings-header',
      Parent: Panel,
    });
    El({
      Tag: 'span',
      Class: 'font-display',
      Parent: Header,
      Style: 'font-size:16px;font-weight:900;color:var(--oasis);letter-spacing:2px;',
      Text: '设置 SETTINGS',
    });
    const CloseBtn = El({
      Tag: 'button',
      Class: 'settings-close',
      Parent: Header,
      Text: '✕',
    }) as HTMLButtonElement;
    this._CleanupFns.push(On(CloseBtn, 'click', () => this._Callbacks.OnClose()));
  }

  private _BuildTabs(Panel: HTMLElement): void {
    const TabRow = El({
      Tag: 'div',
      Parent: Panel,
      Style: 'display:flex;gap:0;border-bottom:1px solid var(--space-border);',
    });
    const GeneralTab = El({
      Tag: 'button',
      Class: 'settings-tab active',
      Parent: TabRow,
      Text: '通用',
    }) as HTMLButtonElement;
    const DataLabTab = El({
      Tag: 'button',
      Class: 'settings-tab',
      Parent: TabRow,
      Text: '数据实验室',
    }) as HTMLButtonElement;

    this._CleanupFns.push(On(GeneralTab, 'click', () => {
      this._ActiveTab = 'general';
      GeneralTab.classList.add('active');
      DataLabTab.classList.remove('active');
      this._RenderCurrentTab();
    }));
    this._CleanupFns.push(On(DataLabTab, 'click', () => {
      this._ActiveTab = 'datalab';
      DataLabTab.classList.add('active');
      GeneralTab.classList.remove('active');
      this._RenderCurrentTab();
    }));
  }

  private _RenderCurrentTab(): void {
    if (!this._ContentBody) return;
    Clear(this._ContentBody);
    if (this._ActiveTab === 'general') {
      this._BuildGeneral(this._ContentBody);
    } else {
      this._BuildDataLab(this._ContentBody);
    }
  }

  private _BuildGeneral(Body: HTMLElement): void {
    this._BuildToggle(Body,
      '⚡ 急速模式',
      '跳过全部动画（骰子/看板/震屏/席位闪烁），以最快速度完成对局',
      (V) => { this._Callbacks.OnSpeedModeChange(V); },
      () => this._Callbacks.IsSpeedMode(),
    );

    this._BuildThemeSection(Body);

    this._BuildToggle(Body, '音效', '开关游戏音效（含骰子、崩坏等）', (V) => {
      this._Accessibility.SetMuted(!V);
    }, () => !this._Accessibility.Muted);

    this._BuildSelect(Body, '动画速度', '控制动画播放速度', [
      { Label: '正常', Value: 'normal' },
      { Label: '快速', Value: 'fast' },
      { Label: '关闭', Value: 'off' },
    ], (V) => {
      this._Accessibility.SetReducedMotion(V === 'off');
      document.documentElement.setAttribute('data-anim-speed', V);
      try { localStorage.setItem('second-oasis-anim-speed', V); } catch { /* noop */ }
    }, () => {
      return document.documentElement.getAttribute('data-anim-speed') || 'normal';
    });

    this._BuildSelect(Body, '字号', '调整界面文字大小', [
      { Label: '小', Value: 'small' },
      { Label: '标准', Value: 'normal' },
      { Label: '大', Value: 'large' },
    ], (V) => {
      document.documentElement.setAttribute('data-font-size', V);
      try { localStorage.setItem('second-oasis-font-size', V); } catch { /* noop */ }
    }, () => {
      return document.documentElement.getAttribute('data-font-size') || 'normal';
    });

    this._BuildToggle(Body, 'FPS 显示', '在角落显示实时帧率', (V) => {
      document.documentElement.setAttribute('data-show-fps', String(V));
      try { localStorage.setItem('second-oasis-show-fps', String(V)); } catch { /* noop */ }
    }, () => {
      return document.documentElement.getAttribute('data-show-fps') === 'true';
    });

    this._BuildToggle(Body, '匿名数据收集', '在数据实验室中汇总匿名统计数据（本地开关，默认关闭）', (V) => {
      try { localStorage.setItem('second-oasis-anon-data', String(V)); } catch { /* noop */ }
    }, () => {
      return localStorage.getItem('second-oasis-anon-data') === 'true';
    });

    this._BuildPerfMonitor(Body);

    if (this._Callbacks.OnRequestQuit) {
      this._BuildQuitButton(Body);
    }
  }

  private async _BuildDataLab(Body: HTMLElement): Promise<void> {
    Body.innerHTML = '';
    El({
      Tag: 'div',
      Parent: Body,
      Style: 'padding:12px;font-size:13px;color:var(--text-dim);text-align:center;margin-bottom:8px;',
      Text: '正在运行蒙特卡洛仿真...',
    });

    const Results: Array<{
      Label: string;
      PlayerCount: number;
      AvgTurns: number;
      WinRates: number[];
      RobberyRate: number;
      CollapseRate: number;
      SuitUsage: Array<{ Label: string; Pct: number }>;
    }> = [];

    // 仿真 2/3/4 人局，各 100 局
    for (const PC of [2, 3, 4] as const) {
      const R = RunSimulation(PC, 100, 'Aggressive' as unknown as import('@/Types/Dice').DiceMode, Date.now() + PC * 100, true, true);
      const CardMeta = new Map<string, CardDefinition>(ALL_TAROT_CARDS.map((C) => [C.Id, C]));
      const SuitMap = new Map<string, number>();
      let SuitTotal = 0;
      for (const U of R.CardUsageList) {
        const Suit = CardMeta.get(U.CardId)?.Suit ?? 'Unknown';
        SuitMap.set(Suit, (SuitMap.get(Suit) ?? 0) + U.Uses);
        SuitTotal += U.Uses;
      }
      const SuitOrder = ['Major', 'Swords', 'Wands', 'Cups', 'Pentacles'];
      const Suits = SuitOrder.map((S) => ({
        Label: S,
        Pct: SuitTotal > 0 ? (SuitMap.get(S) ?? 0) / SuitTotal * 100 : 0,
      }));

      Results.push({
        Label: `${PC} 人局`,
        PlayerCount: PC,
        AvgTurns: R.AvgTurns,
        WinRates: R.WinRates,
        RobberyRate: R.RobberyRate,
        CollapseRate: R.CollapseRate,
        SuitUsage: Suits,
      });
    }

    Body.innerHTML = '';

    // 胜率分布
    this._AddDataLabChart(Body, '胜率分布 · WIN RATES', Results, (R) => {
      const Bars = R.WinRates.map((W, I) =>
        `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
          <span style="font-size:11px;color:var(--text-dim);width:28px;">P${I + 1}</span>
          <div style="flex:1;height:16px;background:var(--nm-bg);border-radius:3px;">
            <div style="width:${(W * 100).toFixed(0)}%;height:100%;background:var(--oasis);border-radius:3px;"></div>
          </div>
          <span style="font-size:11px;color:var(--text-dim);width:40px;">${(W * 100).toFixed(1)}%</span>
        </div>`
      ).join('');
      return Bars;
    });

    // 回合数分布
    this._AddDataLabChart(Body, '平均回合数 · TURNS', Results, (R) => {
      const MaxT = Math.max(...Results.map((X) => X.AvgTurns));
      const BarW = MaxT > 0 ? (R.AvgTurns / MaxT * 100).toFixed(0) : '0';
      return `<div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:11px;color:var(--text-dim);width:32px;">${R.Label}</span>
        <div style="flex:1;height:16px;background:var(--nm-bg);border-radius:3px;">
          <div style="width:${BarW}%;height:100%;background:var(--oasis);border-radius:3px;"></div>
        </div>
        <span style="font-size:11px;color:var(--text-dim);width:44px;">${R.AvgTurns.toFixed(1)} 回合</span>
      </div>`;
    });

    // 抢夺/崩坏率
    this._AddDataLabChart(Body, '抢夺 / 崩坏触发率', Results, (R) => {
      return `<div style="font-size:11px;color:var(--text-dim);margin-bottom:2px;">
        ${R.Label}：抢夺 ${(R.RobberyRate * 100).toFixed(1)}% · 崩坏 ${(R.CollapseRate * 100).toFixed(1)}%
      </div>`;
    });

    // 花色使用
    if (Results[0]) {
      this._AddDataLabChart(Body, '花色使用率 · SUIT USAGE', Results, (R) => {
        return R.SuitUsage.map((S) => {
          return `<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;">
            <span style="font-size:10px;color:var(--text-dim);width:48px;">${S.Label}</span>
            <div style="flex:1;height:12px;background:var(--nm-bg);border-radius:2px;">
              <div style="width:${Math.max(S.Pct, 3).toFixed(0)}%;height:100%;background:var(--oasis);border-radius:2px;"></div>
            </div>
            <span style="font-size:10px;color:var(--text-dim);width:40px;">${S.Pct.toFixed(1)}%</span>
          </div>`;
        }).join('');
      });
    }

    El({
      Tag: 'div',
      Parent: Body,
      Style: 'font-size:10px;color:var(--text-dim);text-align:center;margin-top:16px;',
      Text: '基于 300 局（2/3/4 人各 100 局）含卡牌全模式仿真',
    });
  }

  private _AddDataLabChart(
    Body: HTMLElement,
    Title: string,
    Results: Array<{
      Label: string;
      PlayerCount: number;
      AvgTurns: number;
      WinRates: number[];
      RobberyRate: number;
      CollapseRate: number;
      SuitUsage: Array<{ Label: string; Pct: number }>;
    }>,
    Render: (R: {
      Label: string;
      PlayerCount: number;
      AvgTurns: number;
      WinRates: number[];
      RobberyRate: number;
      CollapseRate: number;
      SuitUsage: Array<{ Label: string; Pct: number }>;
    }) => string,
  ): void {
    const Section = El({
      Tag: 'div',
      Class: 'settings-section',
      Parent: Body,
    });
    El({
      Tag: 'div',
      Class: 'settings-label',
      Parent: Section,
      Text: Title,
    });
    const ChartDiv = El({
      Tag: 'div',
      Parent: Section,
      Style: 'padding:8px 0;',
    });
    for (const R of Results) {
      ChartDiv.innerHTML += Render(R);
    }
  }

  private _BuildPerfMonitor(Body: HTMLElement): void {
    const Section = El({
      Tag: 'div',
      Class: 'settings-section',
      Parent: Body,
    });
    El({ Tag: 'div', Class: 'settings-label', Parent: Section, Text: '性能监控' });
    El({ Tag: 'div', Class: 'settings-desc', Parent: Section, Text: '实时帧率 / 内存占用 / 页面加载时间（仅 Chromium）' });

    const StatsRow = El({
      Tag: 'div',
      Parent: Section,
      Style: 'display:flex;gap:12px;padding:8px 0;',
    });
    const FpsEl = El({
      Tag: 'div',
      Class: 'font-mono',
      Parent: StatsRow,
      Style: 'font-size:11px;color:var(--text-dim);',
      Text: 'FPS: —',
    });
    const MemEl = El({
      Tag: 'div',
      Class: 'font-mono',
      Parent: StatsRow,
      Style: 'font-size:11px;color:var(--text-dim);',
      Text: '内存: —',
    });
    El({
      Tag: 'div',
      Class: 'font-mono',
      Parent: StatsRow,
      Style: 'font-size:11px;color:var(--text-dim);',
      Text: `加载: ${(performance.now() / 1000).toFixed(2)}s`,
    });

    let FpsFrame = 0;
    let FpsLastTs = performance.now();
    const UpdatePerf = (): void => {
      FpsFrame++;
      const Now = performance.now();
      if (Now - FpsLastTs >= 1000) {
        const Fps = Math.round((FpsFrame * 1000) / (Now - FpsLastTs));
        FpsEl.textContent = `FPS: ${Fps}`;
        FpsFrame = 0;
        FpsLastTs = Now;
      }

      const Mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      if (Mem) {
        const Mb = (Mem.usedJSHeapSize / 1048576).toFixed(1);
        MemEl.textContent = `内存: ${Mb} MB`;
      }

      requestAnimationFrame(UpdatePerf);
    };
    this._CleanupFns.push(() => {
      // cleanup handled by _OnUnmount
    });
    requestAnimationFrame(UpdatePerf);
  }

  private _BuildThemeSection(Body: HTMLElement): void {
    const Section = El({
      Tag: 'div',
      Class: 'settings-section',
      Parent: Body,
    });

    El({
      Tag: 'div',
      Class: 'settings-label',
      Parent: Section,
      Text: '主题',
    });
    El({
      Tag: 'div',
      Class: 'settings-desc',
      Parent: Section,
      Text: '在深色太空主题与明亮日间主题之间切换',
    });

    const ToggleRow = El({
      Tag: 'div',
      Class: 'theme-toggle-row',
      Parent: Section,
    });

    const DarkBtn = El({
      Tag: 'button',
      Class: 'theme-opt' + (ThemeManagerInstance.IsDark ? ' active' : ''),
      Parent: ToggleRow,
      Html: '🌙 暗色',
    }) as HTMLButtonElement;
    const LightBtn = El({
      Tag: 'button',
      Class: 'theme-opt' + (ThemeManagerInstance.IsLight ? ' active' : ''),
      Parent: ToggleRow,
      Html: '☀️ 亮色',
    }) as HTMLButtonElement;

    const UpdateBtns = (Mode: ThemeMode): void => {
      DarkBtn.classList.toggle('active', Mode === 'dark');
      LightBtn.classList.toggle('active', Mode === 'light');
    };

    this._CleanupFns.push(On(DarkBtn, 'click', () => {
      ThemeManagerInstance.Set('dark');
      UpdateBtns('dark');
    }));
    this._CleanupFns.push(On(LightBtn, 'click', () => {
      ThemeManagerInstance.Set('light');
      UpdateBtns('light');
    }));
    this._CleanupFns.push(ThemeManagerInstance.OnChange(UpdateBtns));
  }

  private _BuildToggle(
    Body: HTMLElement,
    Label: string,
    Desc: string,
    OnChange: (V: boolean) => void,
    GetValue: () => boolean,
  ): void {
    const Section = El({
      Tag: 'div',
      Class: 'settings-section',
      Parent: Body,
    });
    El({ Tag: 'div', Class: 'settings-label', Parent: Section, Text: Label });
    El({ Tag: 'div', Class: 'settings-desc', Parent: Section, Text: Desc });

    const Switch = El({
      Tag: 'label',
      Class: 'settings-switch',
      Parent: Section,
    });
    const Input = El({
      Tag: 'input',
      Parent: Switch,
      Attrs: { type: 'checkbox' },
    }) as HTMLInputElement;
    Input.checked = GetValue();
    El({ Tag: 'span', Class: 'switch-slider', Parent: Switch });

    this._CleanupFns.push(
      On(Input, 'change', () => {
        OnChange(Input.checked);
      }),
    );
  }

  private _BuildSelect(
    Body: HTMLElement,
    Label: string,
    Desc: string,
    Options: { Label: string; Value: string }[],
    OnChange: (V: string) => void,
    GetValue: () => string,
  ): void {
    const Section = El({
      Tag: 'div',
      Class: 'settings-section',
      Parent: Body,
    });
    El({ Tag: 'div', Class: 'settings-label', Parent: Section, Text: Label });
    El({ Tag: 'div', Class: 'settings-desc', Parent: Section, Text: Desc });

    const Row = El({
      Tag: 'div',
      Class: 'settings-option-row',
      Parent: Section,
    });

    const CurrentVal = GetValue();
    for (const Opt of Options) {
      const Btn = El({
        Tag: 'button',
        Class: 'settings-opt-btn' + (Opt.Value === CurrentVal ? ' active' : ''),
        Parent: Row,
        Text: Opt.Label,
      }) as HTMLButtonElement;

      this._CleanupFns.push(
        On(Btn, 'click', () => {
          Row.querySelectorAll('.settings-opt-btn').forEach((B) => B.classList.remove('active'));
          Btn.classList.add('active');
          OnChange(Opt.Value);
        }),
      );
    }
  }

  private _BuildQuitButton(Body: HTMLElement): void {
    const Section = El({
      Tag: 'div',
      Class: 'settings-section',
      Parent: Body,
    });
    El({ Tag: 'div', Class: 'settings-label', Parent: Section, Text: '游戏控制' });
    El({ Tag: 'div', Class: 'settings-desc', Parent: Section, Text: '放弃当前对局，返回主菜单' });

    const Btn = El({
      Tag: 'button',
      Class: 'settings-quit-btn',
      Parent: Section,
      Text: '退出游戏',
    }) as HTMLButtonElement;
    this._CleanupFns.push(On(Btn, 'click', () => {
      this._Callbacks.OnClose();
      this._Callbacks.OnRequestQuit?.();
    }));
  }

  protected _OnUnmount(): void {
    this._CleanupFns.forEach((Fn) => Fn());
    this._CleanupFns = [];
  }
}
