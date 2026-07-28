/**
 * src/UI/Components/SettingsPanel.ts
 * 操作类型：新建
 *
 * 设置面板：主题切换 + 动画速度 + 音效 + CRT 效果 + 字号 + FPS 显示
 * 飞船控制台风格，从右侧滑入
 */
import { El, On } from '../Dom';
import { Component } from './Component';
import { ThemeManagerInstance, type ThemeMode } from '@/UI/ThemeManager';
import { AccessibilitySettings } from '@/Audio/AccessibilitySettings';

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
    this._BuildContent(Panel);

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

  private _BuildContent(Panel: HTMLElement): void {
    const Body = El({
      Tag: 'div',
      Class: 'settings-body',
      Parent: Panel,
    });

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

    if (this._Callbacks.OnRequestQuit) {
      this._BuildQuitButton(Body);
    }
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
