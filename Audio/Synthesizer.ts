/**
 * src/Audio/Synthesizer.ts
 * 操作类型：新建
 *
 * 程序化音效合成器
 *
 * 设计要点：
 * 1. 每个预设独立函数，便于单独调试和替换为外部采样
 * 2. 优先使用振荡器 + 增益包络，避免节点长期存活
 * 3. 白噪声通过 AudioBuffer 生成，用于骰子/崩坏等质感音
 * 4. 所有节点在音效结束后自动 disconnect，防止内存泄漏
 */
import type { SoundPreset } from './SoundMap';

/** 白噪声缓冲缓存（按 context 记忆） */
const _NoiseCache = new WeakMap<AudioContext, AudioBuffer>();

/**
 * 获取或创建 1 秒白噪声缓冲
 */
function _GetNoiseBuffer(Ctx: AudioContext): AudioBuffer {
  let Buf = _NoiseCache.get(Ctx);
  if (Buf) return Buf;

  const Samples = Ctx.sampleRate;
  Buf = Ctx.createBuffer(1, Samples, Ctx.sampleRate);
  const Data = Buf.getChannelData(0);
  for (let I = 0; I < Samples; I += 1) {
    Data[I] = Math.random() * 2 - 1;
  }
  _NoiseCache.set(Ctx, Buf);
  return Buf;
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
  const Now = Ctx.currentTime;
  Gain.gain.setValueAtTime(0, Now);
  Gain.gain.linearRampToValueAtTime(Peak, Now + AttackSec);
  Gain.gain.exponentialRampToValueAtTime(0.001, Now + AttackSec + DecaySec);
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
  const Src = Ctx.createBufferSource();
  Src.buffer = _GetNoiseBuffer(Ctx);

  const Gain = Ctx.createGain();
  _ApplyEnvelope(Ctx, Gain, Peak, AttackSec, DecaySec);

  Src.connect(Gain);
  Gain.connect(Dest);

  Src.start(Ctx.currentTime);
  Src.stop(Ctx.currentTime + AttackSec + DecaySec + 0.05);
}

/**
 * 播放正弦波短音
 */
function _PlayTone(
  Ctx: AudioContext,
  Dest: AudioNode,
  Freq: number,
  Peak: number,
  AttackSec: number,
  DecaySec: number,
): void {
  const Osc = Ctx.createOscillator();
  Osc.type = 'sine';
  Osc.frequency.setValueAtTime(Freq, Ctx.currentTime);

  const Gain = Ctx.createGain();
  _ApplyEnvelope(Ctx, Gain, Peak, AttackSec, DecaySec);

  Osc.connect(Gain);
  Gain.connect(Dest);

  const Dur = AttackSec + DecaySec + 0.05;
  Osc.start(Ctx.currentTime);
  Osc.stop(Ctx.currentTime + Dur);
}

/**
 * 播放三角波短音（更偏金属/游戏感）
 */
function _PlayTriangle(
  Ctx: AudioContext,
  Dest: AudioNode,
  Freq: number,
  Peak: number,
  AttackSec: number,
  DecaySec: number,
): void {
  const Osc = Ctx.createOscillator();
  Osc.type = 'triangle';
  Osc.frequency.setValueAtTime(Freq, Ctx.currentTime);

  const Gain = Ctx.createGain();
  _ApplyEnvelope(Ctx, Gain, Peak, AttackSec, DecaySec);

  Osc.connect(Gain);
  Gain.connect(Dest);

  const Dur = AttackSec + DecaySec + 0.05;
  Osc.start(Ctx.currentTime);
  Osc.stop(Ctx.currentTime + Dur);
}

export class Synthesizer {
  /**
   * 根据预设名称分发到具体合成函数
   */
  Play(Ctx: AudioContext, Dest: AudioNode, Preset: SoundPreset): void {
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
      default:
        // exhaustive check
        const _Exhaustive: never = Preset;
        void _Exhaustive;
    }
  }

  private _DiceRoll(Ctx: AudioContext, Dest: AudioNode): void {
    // 骰子碰撞：短促噪声 + 低频三角波模拟塑料/方块感
    _PlayNoise(Ctx, Dest, 0.25, 0.01, 0.08);
    _PlayTriangle(Ctx, Dest, 180, 0.12, 0.01, 0.06);
  }

  private _DiceSettle(Ctx: AudioContext, Dest: AudioNode): void {
    // 落定：清脆金属感正弦，音高固定，营造"落定"明确感
    _PlayTone(Ctx, Dest, 880, 0.2, 0.01, 0.18);
  }

  private _OccupyUp(Ctx: AudioContext, Dest: AudioNode): void {
    // 占领上升：快速琶音，象征领土增长
    const Now = Ctx.currentTime;
    [440, 554, 659].forEach((Freq, I) => {
      const Osc = Ctx.createOscillator();
      Osc.type = 'sine';
      Osc.frequency.setValueAtTime(Freq, Now + I * 0.04);
      const Gain = Ctx.createGain();
      Gain.gain.setValueAtTime(0, Now + I * 0.04);
      Gain.gain.linearRampToValueAtTime(0.15, Now + I * 0.04 + 0.02);
      Gain.gain.exponentialRampToValueAtTime(0.001, Now + I * 0.04 + 0.18);
      Osc.connect(Gain);
      Gain.connect(Dest);
      Osc.start(Now + I * 0.04);
      Osc.stop(Now + I * 0.04 + 0.22);
    });
  }

  private _OccupyDown(Ctx: AudioContext, Dest: AudioNode): void {
    // 倒扣：下降滑音，略带低通滤波
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
  }

  private _ChainX2(Ctx: AudioContext, Dest: AudioNode): void {
    // 双音上升和弦
    _PlayTone(Ctx, Dest, 523, 0.18, 0.02, 0.25);
    _PlayTone(Ctx, Dest, 659, 0.18, 0.02, 0.25);
  }

  private _ChainX3(Ctx: AudioContext, Dest: AudioNode): void {
    // 三音华丽和弦，带轻微延迟营造宽广感
    const Now = Ctx.currentTime;
    [523, 659, 784].forEach((Freq, I) => {
      const Osc = Ctx.createOscillator();
      Osc.type = 'triangle';
      Osc.frequency.setValueAtTime(Freq, Now + I * 0.03);
      const Gain = Ctx.createGain();
      Gain.gain.setValueAtTime(0, Now + I * 0.03);
      Gain.gain.linearRampToValueAtTime(0.15, Now + I * 0.03 + 0.03);
      Gain.gain.exponentialRampToValueAtTime(0.001, Now + I * 0.03 + 0.4);
      Osc.connect(Gain);
      Gain.connect(Dest);
      Osc.start(Now + I * 0.03);
      Osc.stop(Now + I * 0.03 + 0.45);
    });
  }

  private _ChainBreak(Ctx: AudioContext, Dest: AudioNode): void {
    // 玻璃碎裂近似：噪声 + 快速降调
    _PlayNoise(Ctx, Dest, 0.35, 0.01, 0.25);
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
  }

  private _RobberyStart(Ctx: AudioContext, Dest: AudioNode): void {
    // 紧张心跳：低频鼓点，重复两拍
    const Now = Ctx.currentTime;
    [0, 0.35].forEach((Offset) => {
      const Osc = Ctx.createOscillator();
      Osc.type = 'sine';
      Osc.frequency.setValueAtTime(60, Now + Offset);
      const Gain = Ctx.createGain();
      Gain.gain.setValueAtTime(0, Now + Offset);
      Gain.gain.linearRampToValueAtTime(0.35, Now + Offset + 0.02);
      Gain.gain.exponentialRampToValueAtTime(0.001, Now + Offset + 0.25);
      Osc.connect(Gain);
      Gain.connect(Dest);
      Osc.start(Now + Offset);
      Osc.stop(Now + Offset + 0.3);
    });
  }

  private _RobberyWin(Ctx: AudioContext, Dest: AudioNode): void {
    _PlayTone(Ctx, Dest, 784, 0.2, 0.02, 0.3);
    _PlayTone(Ctx, Dest, 988, 0.18, 0.02, 0.3);
  }

  private _RobberyLose(Ctx: AudioContext, Dest: AudioNode): void {
    _PlayTone(Ctx, Dest, 150, 0.25, 0.02, 0.35);
  }

  private _Collapse(Ctx: AudioContext, Dest: AudioNode): void {
    // 低频轰鸣噪声 + 急促告警音
    _PlayNoise(Ctx, Dest, 0.45, 0.05, 0.8);
    const Now = Ctx.currentTime;
    [0, 0.2, 0.4].forEach((Offset) => {
      const Osc = Ctx.createOscillator();
      Osc.type = 'square';
      Osc.frequency.setValueAtTime(880, Now + Offset);
      const Gain = Ctx.createGain();
      Gain.gain.setValueAtTime(0, Now + Offset);
      Gain.gain.linearRampToValueAtTime(0.12, Now + Offset + 0.01);
      Gain.gain.exponentialRampToValueAtTime(0.001, Now + Offset + 0.12);
      Osc.connect(Gain);
      Gain.connect(Dest);
      Osc.start(Now + Offset);
      Osc.stop(Now + Offset + 0.15);
    });
  }

  private _LaunchSuccess(Ctx: AudioContext, Dest: AudioNode): void {
    // 火箭上升滑音 + 轻混响（用短延迟模拟）
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
  }

  private _LaunchFail(Ctx: AudioContext, Dest: AudioNode): void {
    // 短促哑音 + 金属摩擦
    _PlayTone(Ctx, Dest, 120, 0.2, 0.05, 0.2);
    _PlayNoise(Ctx, Dest, 0.15, 0.01, 0.15);
  }

  private _GameOver(Ctx: AudioContext, Dest: AudioNode): void {
    // Pad 和弦收尾
    const Now = Ctx.currentTime;
    [392, 494, 587, 784].forEach((Freq) => {
      const Osc = Ctx.createOscillator();
      Osc.type = 'sine';
      Osc.frequency.setValueAtTime(Freq, Now);
      const Gain = Ctx.createGain();
      Gain.gain.setValueAtTime(0, Now);
      Gain.gain.linearRampToValueAtTime(0.12, Now + 0.3);
      Gain.gain.exponentialRampToValueAtTime(0.001, Now + 2.0);
      Osc.connect(Gain);
      Gain.connect(Dest);
      Osc.start(Now);
      Osc.stop(Now + 2.1);
    });
  }
}
