/**
 * src/Audio/Synthesizer.ts
 * 操作类型：修改（错误处理加固）
 *
 * 程序化音效合成器
 *
 * 设计要点：
 * 1. 每个预设独立函数，便于单独调试和替换为外部采样
 * 2. 优先使用振荡器 + 增益包络，避免节点长期存活
 * 3. 白噪声通过 AudioBuffer 生成，用于骰子/崩坏等质感音
 * 4. 所有节点在音效结束后自动 disconnect，防止内存泄漏
 * 5. 所有 Web Audio API 调用带防护：检查 context 状态 + try-catch
 */
import type { SoundPreset } from './SoundMap';

/** 白噪声缓冲缓存（按 context 记忆） */
const _NoiseCache = new WeakMap<AudioContext, AudioBuffer>();

/** 音色参数组（减少函数参数数量） */
interface ToneParams {
  readonly Freq: number;
  readonly Peak: number;
  readonly AttackSec: number;
  readonly DecaySec: number;
}

/**
 * 检查 AudioContext 是否可用
 */
function _IsCtxValid(Ctx: AudioContext): boolean {
  return Ctx.state !== 'closed';
}

/**
 * 获取或创建 1 秒白噪声缓冲
 */
function _GetNoiseBuffer(Ctx: AudioContext): AudioBuffer | null {
  if (!_IsCtxValid(Ctx)) return null;
  let Buf = _NoiseCache.get(Ctx);
  if (Buf) return Buf;

  try {
    const Samples = Ctx.sampleRate;
    Buf = Ctx.createBuffer(1, Samples, Ctx.sampleRate);
    const Data = Buf.getChannelData(0);
    for (let I = 0; I < Samples; I += 1) {
      Data[I] = Math.random() * 2 - 1;
    }
    _NoiseCache.set(Ctx, Buf);
    return Buf;
  } catch {
    return null;
  }
}

/**
 * 简单 ADSR 包络：快速起音 + 指数衰减
 */
function _ApplyEnvelope(
  Ctx: AudioContext,
  Gain: GainNode,
  Peak: number,
  AttackSec: number,
  DecaySec: number,
): void {
  try {
    const Now = Ctx.currentTime;
    Gain.gain.setValueAtTime(0, Now);
    Gain.gain.linearRampToValueAtTime(Peak, Now + AttackSec);
    Gain.gain.exponentialRampToValueAtTime(0.001, Now + AttackSec + DecaySec);
  } catch {
    // 静默：context 可能在调度期间关闭
  }
}

/**
 * 播放白噪声脉冲
 */
function _PlayNoise(
  Ctx: AudioContext,
  Dest: AudioNode,
  Peak: number,
  AttackSec: number,
  DecaySec: number,
): void {
  if (!_IsCtxValid(Ctx)) return;
  try {
    const Buf = _GetNoiseBuffer(Ctx);
    if (!Buf) return;
    const Src = Ctx.createBufferSource();
    Src.buffer = Buf;

    const Gain = Ctx.createGain();
    _ApplyEnvelope(Ctx, Gain, Peak, AttackSec, DecaySec);

    Src.connect(Gain);
    Gain.connect(Dest);

    Src.start(Ctx.currentTime);
    Src.stop(Ctx.currentTime + AttackSec + DecaySec + 0.05);
  } catch {
    // 静默：context 可能已关闭
  }
}

/**
 * 创建带包络的振荡器节点（复用 OscillatorNode 创建逻辑）
 */
function _CreateOscWithEnvelope(
  Ctx: AudioContext,
  Dest: AudioNode,
  Type: OscillatorType,
  Freq: number,
  Peak: number,
  AttackSec: number,
  DecaySec: number,
): OscillatorNode | null {
  if (!_IsCtxValid(Ctx)) return null;
  try {
    const Osc = Ctx.createOscillator();
    Osc.type = Type;
    Osc.frequency.setValueAtTime(Freq, Ctx.currentTime);

    const Gain = Ctx.createGain();
    _ApplyEnvelope(Ctx, Gain, Peak, AttackSec, DecaySec);

    Osc.connect(Gain);
    Gain.connect(Dest);

    const Dur = AttackSec + DecaySec + 0.05;
    Osc.start(Ctx.currentTime);
    Osc.stop(Ctx.currentTime + Dur);
    return Osc;
  } catch {
    return null;
  }
}

/**
 * 播放正弦波短音
 */
function _PlayTone(Ctx: AudioContext, Dest: AudioNode, Params: ToneParams): void {
  _CreateOscWithEnvelope(Ctx, Dest, 'sine', Params.Freq, Params.Peak, Params.AttackSec, Params.DecaySec);
}

/**
 * 播放三角波短音（更偏金属/游戏感）
 */
function _PlayTriangle(Ctx: AudioContext, Dest: AudioNode, Params: ToneParams): void {
  _CreateOscWithEnvelope(Ctx, Dest, 'triangle', Params.Freq, Params.Peak, Params.AttackSec, Params.DecaySec);
}

/**
 * 在 AudioContext 中创建定时调度的振荡器（用于琶音/和弦等自定义编排）
 * 返回 null 表示 context 已关闭或创建失败
 */
function _CreateScheduledOsc(
  Ctx: AudioContext,
  Dest: AudioNode,
  Type: OscillatorType,
  Freq: number,
  StartTime: number,
  Duration: number,
  Peak: number,
): OscillatorNode | null {
  if (!_IsCtxValid(Ctx)) return null;
  try {
    const Osc = Ctx.createOscillator();
    Osc.type = Type;
    Osc.frequency.setValueAtTime(Freq, StartTime);
    const Gain = Ctx.createGain();
    Gain.gain.setValueAtTime(0, StartTime);
    Gain.gain.linearRampToValueAtTime(Peak, StartTime + 0.02);
    Gain.gain.exponentialRampToValueAtTime(0.001, StartTime + Duration);
    Osc.connect(Gain);
    Gain.connect(Dest);
    Osc.start(StartTime);
    Osc.stop(StartTime + Duration + 0.02);
    return Osc;
  } catch {
    return null;
  }
}

export class Synthesizer {
  /**
   * 根据预设名称分发到具体合成函数
   */
  Play(Ctx: AudioContext, Dest: AudioNode, Preset: SoundPreset): void {
    if (!_IsCtxValid(Ctx)) return;
    try {
      switch (Preset) {
        case 'DiceRoll':
          this._DiceRoll(Ctx, Dest);
          break;
        case 'DiceSettle':
          this._DiceSettle(Ctx, Dest);
          break;
        case 'OccupyUp':
          this._OccupyUp(Ctx, Dest);
          break;
        case 'OccupyDown':
          this._OccupyDown(Ctx, Dest);
          break;
        case 'ChainX2':
          this._ChainX2(Ctx, Dest);
          break;
        case 'ChainX3':
          this._ChainX3(Ctx, Dest);
          break;
        case 'ChainBreak':
          this._ChainBreak(Ctx, Dest);
          break;
        case 'RobberyStart':
          this._RobberyStart(Ctx, Dest);
          break;
        case 'RobberyWin':
          this._RobberyWin(Ctx, Dest);
          break;
        case 'RobberyLose':
          this._RobberyLose(Ctx, Dest);
          break;
        case 'Collapse':
          this._Collapse(Ctx, Dest);
          break;
        case 'LaunchSuccess':
          this._LaunchSuccess(Ctx, Dest);
          break;
        case 'LaunchFail':
          this._LaunchFail(Ctx, Dest);
          break;
        case 'GameOver':
          this._GameOver(Ctx, Dest);
          break;
        case 'CardFlip':
          this._CardFlip(Ctx, Dest);
          break;
        case 'CardCommand':
          this._CardCommand(Ctx, Dest);
          break;
        case 'CardCounter':
          this._CardCounter(Ctx, Dest);
          break;
        case 'CardConstant':
          this._CardConstant(Ctx, Dest);
          break;
        case 'CardConstantExpire':
          this._CardConstantExpire(Ctx, Dest);
          break;
        case 'CardShuffle':
          this._CardShuffle(Ctx, Dest);
          break;
        case 'CounterTrigger':
          this._CounterTrigger(Ctx, Dest);
          break;
        default: {
          const _Exhaustive: never = Preset;
          void _Exhaustive;
        }
      }
    } catch {
      // AudioContext 可能在使用过程中被关闭，静默吞下
    }
  }

  private _DiceRoll(Ctx: AudioContext, Dest: AudioNode): void {
    _PlayNoise(Ctx, Dest, 0.25, 0.01, 0.08);
    _PlayTriangle(Ctx, Dest, { Freq: 180, Peak: 0.12, AttackSec: 0.01, DecaySec: 0.06 });
  }

  private _DiceSettle(Ctx: AudioContext, Dest: AudioNode): void {
    _PlayTone(Ctx, Dest, { Freq: 880, Peak: 0.2, AttackSec: 0.01, DecaySec: 0.18 });
  }

  private _OccupyUp(Ctx: AudioContext, Dest: AudioNode): void {
    if (!_IsCtxValid(Ctx)) return;
    const Now = Ctx.currentTime;
    [440, 554, 659].forEach((Freq, I) => {
      _CreateScheduledOsc(Ctx, Dest, 'sine', Freq, Now + I * 0.04, 0.18, 0.15);
    });
  }

  private _OccupyDown(Ctx: AudioContext, Dest: AudioNode): void {
    if (!_IsCtxValid(Ctx)) return;
    try {
      const Now = Ctx.currentTime;
      const Osc = Ctx.createOscillator();
      Osc.type = 'sawtooth';
      Osc.frequency.setValueAtTime(300, Now);
      Osc.frequency.exponentialRampToValueAtTime(80, Now + 0.3);

      const Filter = Ctx.createBiquadFilter();
      Filter.type = 'lowpass';
      Filter.frequency.setValueAtTime(600, Now);
      Filter.frequency.exponentialRampToValueAtTime(120, Now + 0.3);

      const Gain = Ctx.createGain();
      Gain.gain.setValueAtTime(0.2, Now);
      Gain.gain.exponentialRampToValueAtTime(0.001, Now + 0.3);

      Osc.connect(Filter);
      Filter.connect(Gain);
      Gain.connect(Dest);

      Osc.start(Now);
      Osc.stop(Now + 0.35);
    } catch {
      // 静默
    }
  }

  private _ChainX2(Ctx: AudioContext, Dest: AudioNode): void {
    _PlayTone(Ctx, Dest, { Freq: 523, Peak: 0.18, AttackSec: 0.02, DecaySec: 0.25 });
    _PlayTone(Ctx, Dest, { Freq: 659, Peak: 0.18, AttackSec: 0.02, DecaySec: 0.25 });
  }

  private _ChainX3(Ctx: AudioContext, Dest: AudioNode): void {
    if (!_IsCtxValid(Ctx)) return;
    const Now = Ctx.currentTime;
    [523, 659, 784].forEach((Freq, I) => {
      _CreateScheduledOsc(Ctx, Dest, 'triangle', Freq, Now + I * 0.03, 0.4, 0.15);
    });
  }

  private _ChainBreak(Ctx: AudioContext, Dest: AudioNode): void {
    _PlayNoise(Ctx, Dest, 0.35, 0.01, 0.25);
    if (!_IsCtxValid(Ctx)) return;
    try {
      const Now = Ctx.currentTime;
      const Osc = Ctx.createOscillator();
      Osc.type = 'sawtooth';
      Osc.frequency.setValueAtTime(800, Now);
      Osc.frequency.exponentialRampToValueAtTime(50, Now + 0.25);
      const Gain = Ctx.createGain();
      Gain.gain.setValueAtTime(0.2, Now);
      Gain.gain.exponentialRampToValueAtTime(0.001, Now + 0.25);
      Osc.connect(Gain);
      Gain.connect(Dest);
      Osc.start(Now);
      Osc.stop(Now + 0.3);
    } catch {
      // 静默
    }
  }

  private _RobberyStart(Ctx: AudioContext, Dest: AudioNode): void {
    if (!_IsCtxValid(Ctx)) return;
    const Now = Ctx.currentTime;
    [0, 0.35].forEach((Offset) => {
      _CreateScheduledOsc(Ctx, Dest, 'sine', 60, Now + Offset, 0.25, 0.35);
    });
  }

  private _RobberyWin(Ctx: AudioContext, Dest: AudioNode): void {
    _PlayTone(Ctx, Dest, { Freq: 784, Peak: 0.2, AttackSec: 0.02, DecaySec: 0.3 });
    _PlayTone(Ctx, Dest, { Freq: 988, Peak: 0.18, AttackSec: 0.02, DecaySec: 0.3 });
  }

  private _RobberyLose(Ctx: AudioContext, Dest: AudioNode): void {
    _PlayTone(Ctx, Dest, { Freq: 150, Peak: 0.25, AttackSec: 0.02, DecaySec: 0.35 });
  }

  private _Collapse(Ctx: AudioContext, Dest: AudioNode): void {
    _PlayNoise(Ctx, Dest, 0.45, 0.05, 0.8);
    if (!_IsCtxValid(Ctx)) return;
    const Now = Ctx.currentTime;
    [0, 0.2, 0.4].forEach((Offset) => {
      _CreateScheduledOsc(Ctx, Dest, 'square', 880, Now + Offset, 0.12, 0.12);
    });
  }

  private _LaunchSuccess(Ctx: AudioContext, Dest: AudioNode): void {
    if (!_IsCtxValid(Ctx)) return;
    try {
      const Now = Ctx.currentTime;
      const Osc = Ctx.createOscillator();
      Osc.type = 'sine';
      Osc.frequency.setValueAtTime(220, Now);
      Osc.frequency.exponentialRampToValueAtTime(880, Now + 0.5);
      const Gain = Ctx.createGain();
      Gain.gain.setValueAtTime(0.2, Now);
      Gain.gain.linearRampToValueAtTime(0.001, Now + 0.5);
      Osc.connect(Gain);
      Gain.connect(Dest);
      Osc.start(Now);
      Osc.stop(Now + 0.55);
    } catch {
      // 静默
    }
  }

  private _LaunchFail(Ctx: AudioContext, Dest: AudioNode): void {
    _PlayTone(Ctx, Dest, { Freq: 120, Peak: 0.2, AttackSec: 0.05, DecaySec: 0.2 });
    _PlayNoise(Ctx, Dest, 0.15, 0.01, 0.15);
  }

  private _GameOver(Ctx: AudioContext, Dest: AudioNode): void {
    if (!_IsCtxValid(Ctx)) return;
    const Now = Ctx.currentTime;
    [392, 494, 587, 784].forEach((Freq) => {
      _CreateScheduledOsc(Ctx, Dest, 'sine', Freq, Now, 1.7, 0.12);
    });
  }

  private _CardFlip(Ctx: AudioContext, Dest: AudioNode): void {
    if (!_IsCtxValid(Ctx)) return;
    _PlayNoise(Ctx, Dest, 0.12, 0.005, 0.04);
    _PlayTone(Ctx, Dest, { Freq: 600, Peak: 0.1, AttackSec: 0.003, DecaySec: 0.06 });
  }

  private _CardCommand(Ctx: AudioContext, Dest: AudioNode): void {
    if (!_IsCtxValid(Ctx)) return;
    const Now = Ctx.currentTime;
    _CreateScheduledOsc(Ctx, Dest, 'triangle', 880, Now, 0.1, 0.15);
    _CreateScheduledOsc(Ctx, Dest, 'triangle', 1100, Now + 0.04, 0.1, 0.12);
    _PlayTone(Ctx, Dest, { Freq: 660, Peak: 0.08, AttackSec: 0.01, DecaySec: 0.2 });
  }

  private _CardCounter(Ctx: AudioContext, Dest: AudioNode): void {
    if (!_IsCtxValid(Ctx)) return;
    const Now = Ctx.currentTime;
    _CreateScheduledOsc(Ctx, Dest, 'square', 220, Now, 0.12, 0.1);
    _CreateScheduledOsc(Ctx, Dest, 'square', 330, Now + 0.05, 0.12, 0.1);
    _PlayNoise(Ctx, Dest, 0.08, 0.005, 0.04);
  }

  private _CardConstant(Ctx: AudioContext, Dest: AudioNode): void {
    if (!_IsCtxValid(Ctx)) return;
    const Now = Ctx.currentTime;
    _CreateScheduledOsc(Ctx, Dest, 'sine', 261, Now, 0.6, 0.08);
    _CreateScheduledOsc(Ctx, Dest, 'sine', 329, Now, 0.6, 0.06);
    _CreateScheduledOsc(Ctx, Dest, 'sine', 392, Now, 0.6, 0.04);
  }

  private _CardConstantExpire(Ctx: AudioContext, Dest: AudioNode): void {
    if (!_IsCtxValid(Ctx)) return;
    const Now = Ctx.currentTime;
    _CreateScheduledOsc(Ctx, Dest, 'sine', 392, Now, 0.3, 0.06);
    _CreateScheduledOsc(Ctx, Dest, 'sine', 329, Now + 0.1, 0.3, 0.05);
    _CreateScheduledOsc(Ctx, Dest, 'sine', 261, Now + 0.2, 0.4, 0.04);
    _PlayNoise(Ctx, Dest, 0.06, 0.01, 0.15);
  }

  private _CardShuffle(Ctx: AudioContext, Dest: AudioNode): void {
    if (!_IsCtxValid(Ctx)) return;
    for (let I = 0; I < 12; I++) {
      _PlayNoise(Ctx, Dest, 0.04, 0.002, 0.02);
    }
    _PlayTone(Ctx, Dest, { Freq: 300, Peak: 0.1, AttackSec: 0.02, DecaySec: 0.3 });
  }

  private _CounterTrigger(Ctx: AudioContext, Dest: AudioNode): void {
    if (!_IsCtxValid(Ctx)) return;
    const Now = Ctx.currentTime;
    _CreateScheduledOsc(Ctx, Dest, 'sawtooth', 110, Now, 0.25, 0.12);
    _CreateScheduledOsc(Ctx, Dest, 'sawtooth', 165, Now + 0.08, 0.2, 0.1);
    _PlayNoise(Ctx, Dest, 0.15, 0.005, 0.1);
    _PlayTone(Ctx, Dest, { Freq: 440, Peak: 0.12, AttackSec: 0.01, DecaySec: 0.15 });
  }
}
