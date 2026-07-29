/**
 * src/UI/Components/ReplayPlayer.ts
 * 操作类型：新建
 *
 * 回放播放器——底部控制条 + 进度条 + 速度切换，内嵌 GameStageView 和 ReplayEngine。
 */

import { El, On, Clear } from '../Dom';
import { Component } from './Component';
import { GameStageView } from './GameStageView';
import { ReplayEngine } from '@/Store/ReplayEngine';
import type { StoredReplay } from '@/Types/Replay';
import { InputGate } from '@/App/InputGate';
import { CreateNullAIDirector } from '@/AI';
import { AnimationManager } from '@/Render/Animation/AnimationManager';
import { AudioEngine } from '@/Audio/AudioEngine';
import { AccessibilitySettings } from '@/Audio/AccessibilitySettings';
import { AnimationCoordinator } from '@/Render/Animation/AnimationCoordinator';

export interface ReplayPlayerCallbacks {
  OnClose: () => void;
  OnSaveAgain: () => void;
}

export class ReplayPlayer extends Component {
  private readonly _Callbacks: ReplayPlayerCallbacks;
  private readonly _Engine: ReplayEngine;
  private readonly _Input: InputGate;
  private readonly _Accessibility: AccessibilitySettings;
  private readonly _Audio: AudioEngine;
  private readonly _AnimManager: AnimationManager;
  private _AnimCoordinator: AnimationCoordinator | null = null;
  private _Stage: GameStageView | null = null;
  private _Playing = false;
  private _Speed: 1 | 2 | 4 = 1;
  private _PlayTimer: number | null = null;
  private _ControlBar: HTMLElement | null = null;
  private _ProgressBar: HTMLInputElement | null = null;
  private _CleanupFns: Array<() => void> = [];

  constructor(Replay: StoredReplay, Callbacks: ReplayPlayerCallbacks) {
    super();
    this._Callbacks = Callbacks;
    this._Engine = new ReplayEngine(Replay);
    this._Input = new InputGate();
    this._Accessibility = new AccessibilitySettings();
    this._Audio = new AudioEngine({ Settings: this._Accessibility });
    this._AnimManager = new AnimationManager(this._Accessibility);
  }

  /** 暴露回放引擎，供 AppController 将 Canvas 看板绑定到回放状态 */
  get Engine(): ReplayEngine {
    return this._Engine;
  }

  Mount(Parent: HTMLElement): void {
    const Root = El({
      Tag: 'div',
      Parent,
      Style: 'position:absolute;inset:0;z-index:100;',
    });
    this.SetRoot(Root);

    // 游戏舞台（spectator 模式）
    this._Stage = new GameStageView({
      Store: this._Engine,
      Input: this._Input,
      AIDirector: CreateNullAIDirector(),
      Mode: 'spectator',
      IsSpectator: true,
      IsAI: () => false,
    });
    this._Stage.Mount(Root);

    this._AnimCoordinator = new AnimationCoordinator(
      this._Engine,
      this._AnimManager,
      this._Audio,
      this._Stage,
    );

    // 底部控制条
    this._ControlBar = El({
      Tag: 'div',
      Parent: Root,
      Style: 'position:absolute;bottom:0;left:0;right:0;height:56px;background:var(--nm-bg);box-shadow:var(--nm-raised);display:flex;align-items:center;gap:10px;padding:0 16px;z-index:50;',
    });

    this._RenderControls();
  }

  private _RenderControls(): void {
    if (!this._ControlBar) return;
    Clear(this._ControlBar);

    // 上一回合
    const PrevBtn = this._Button('<<');
    this._CleanupFns.push(On(PrevBtn, 'click', () => {
      this._Pause();
      this._Engine.StepBackward();
      this._UpdateProgress();
    }));

    // 播放/暂停
    const PlayPauseBtn = this._Button(this._Playing ? '||' : '>');
    this._CleanupFns.push(On(PlayPauseBtn, 'click', () => {
      if (this._Playing) {
        this._Pause();
      } else {
        this._Play();
      }
    }));

    // 下一回合
    const NextBtn = this._Button('>>');
    this._CleanupFns.push(On(NextBtn, 'click', () => {
      this._Pause();
      this._Engine.StepForward();
      this._UpdateProgress();
    }));

    // 进度条
    this._ProgressBar = El({
      Tag: 'input',
      Parent: this._ControlBar,
    }) as HTMLInputElement;
    this._ProgressBar.type = 'range';
    this._ProgressBar.min = '0';
    this._ProgressBar.max = String(this._Engine.TotalEvents);
    this._ProgressBar.value = String(this._Engine.CurrentIndex);
    this._ProgressBar.style.flex = '1';
    this._CleanupFns.push(On(this._ProgressBar, 'input', () => {
      this._Pause();
      this._Engine.JumpTo(Number(this._ProgressBar!.value));
    }));

    // 速度
    for (const S of [1, 2, 4] as const) {
      const SpeedBtn = El({
        Tag: 'button',
        Class: 'console-btn' + (this._Speed === S ? ' steady' : ' pass'),
        Parent: this._ControlBar,
        Text: `${S}x`,
        Style: 'font-size:11px;padding:4px 10px;',
      }) as HTMLButtonElement;
      this._CleanupFns.push(On(SpeedBtn, 'click', () => {
        this._Speed = S;
        this._RenderControls();
      }));
    }

    // 关闭
    const CloseBtn = this._Button('X');
    CloseBtn.style.color = 'var(--text-dim)';
    this._CleanupFns.push(On(CloseBtn, 'click', () => {
      this._Pause();
      this._Callbacks.OnClose();
    }));

    this._UpdateProgress();
  }

  private _Button(Label: string): HTMLButtonElement {
    if (!this._ControlBar) return document.createElement('button');
    const Btn = El({
      Tag: 'button',
      Class: 'console-btn pass',
      Parent: this._ControlBar,
      Text: Label,
      Style: 'font-size:14px;padding:6px 14px;min-width:40px;',
    }) as HTMLButtonElement;
    return Btn;
  }

  private _Play(): void {
    if (this._Engine.IsAtEnd) return;
    this._Playing = true;
    this._RenderControls();
    this._StepLoop();
  }

  private _Pause(): void {
    this._Playing = false;
    if (this._PlayTimer !== null) {
      clearTimeout(this._PlayTimer);
      this._PlayTimer = null;
    }
    this._RenderControls();
  }

  private _StepLoop(): void {
    if (!this._Playing) return;
    if (this._Engine.IsAtEnd) {
      this._Pause();
      return;
    }
    this._Engine.StepForward();
    this._UpdateProgress();

    const Delay = 1000 / this._Speed;
    this._PlayTimer = window.setTimeout(() => this._StepLoop(), Delay);
  }

  private _UpdateProgress(): void {
    if (this._ProgressBar) {
      this._ProgressBar.value = String(this._Engine.CurrentIndex);
    }
  }

  protected _OnUnmount(): void {
    this._Pause();
    this._CleanupFns.forEach((Fn) => Fn());
    this._CleanupFns = [];
    this._AnimCoordinator?.Dispose();
    this._AnimCoordinator = null;
    this._Stage?.Unmount();
    this._Stage = null;
    this._Audio.Dispose();
  }
}
