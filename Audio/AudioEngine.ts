/**
 * src/Audio/AudioEngine.ts
 * 操作类型：新建
 *
 * 原生 Web Audio API 音频引擎
 *
 * 设计要点：
 * 1. 零第三方运行时依赖，所有音效程序合成
 * 2. 采用 MasterGain 统一管理音量，静音时直接切断增益
 * 3. AudioContext 首次播放时懒创建，但必须在用户手势后 Resume
 * 4. 支持外部注入 AudioContext，便于测试环境 mock
 * 5. 所有短音效播放后自动清理节点，防止内存泄漏
 */
import { AccessibilitySettings } from './AccessibilitySettings';
import { Synthesizer } from './Synthesizer';
import type { SoundPreset } from './SoundMap';

export interface AudioEngineOptions {
  /** 可访问性设置，默认新建一个 */
  Settings?: AccessibilitySettings;
  /** 可注入的 AudioContext（测试用） */
  Ctx?: AudioContext;
}

/**
 * 原生 Web Audio 引擎
 *
 * 用法：
 *   const Audio = new AudioEngine({ Settings });
 *   await Audio.Resume(); // 用户首次交互后调用
 *   Audio.Play('DiceRoll');
 */
export class AudioEngine {
  private readonly _Settings: AccessibilitySettings;
  private readonly _Synth: Synthesizer;
  private readonly _Ctx: AudioContext | null;
  private readonly _Master: GainNode | null;
  private readonly _UnsubMuted: () => void;
  private _Started = false;

  constructor(Opts: AudioEngineOptions = {}) {
    this._Settings = Opts.Settings ?? new AccessibilitySettings();
    this._Synth = new Synthesizer();

    if (Opts.Ctx) {
      this._Ctx = Opts.Ctx;
    } else if (typeof AudioContext !== 'undefined') {
      this._Ctx = new AudioContext();
    } else {
      this._Ctx = null;
    }

    if (this._Ctx) {
      this._Master = this._Ctx.createGain();
      this._Master.gain.value = this._Settings.Muted ? 0 : 1;
      this._Master.connect(this._Ctx.destination);
    } else {
      this._Master = null;
    }

    this._UnsubMuted = this._Settings.On('MutedChanged', (Val) => {
      if (this._Master) {
        this._Master.gain.value = Val ? 0 : 1;
      }
    });
  }

  /**
   * 在用户手势后恢复 AudioContext
   * 静默失败：浏览器不支持或已 running 时不抛错
   */
  async Resume(): Promise<void> {
    if (!this._Ctx) {
      this._Started = true;
      return;
    }
    try {
      await this._Ctx.resume();
      this._Started = true;
    } catch (Err) {
      // 某些浏览器可能在非用户手势下拒绝 resume，不影响游戏逻辑
      console.warn('[AudioEngine] Resume 失败:', Err);
    }
  }

  /**
   * 是否已完成首次 Resume
   */
  get IsStarted(): boolean {
    return this._Started;
  }

  /**
   * 播放一个音效预设
   */
  Play(Preset: SoundPreset): void {
    if (!this._Ctx || !this._Master || this._Settings.Muted) return;
    // 浏览器策略要求 AudioContext 在用户手势后 resume；若未 running，
    // 先尝试恢复，但即使失败也不阻塞游戏逻辑。
    if (this._Ctx.state === 'suspended' || this._Ctx.state === 'interrupted') {
      void this.Resume();
    }

    this._Synth.Play(this._Ctx, this._Master, Preset);
  }

  /**
   * 释放资源
   */
  Dispose(): void {
    this._UnsubMuted();
    if (this._Ctx && this._Ctx.state !== 'closed') {
      void this._Ctx.close();
    }
  }
}
