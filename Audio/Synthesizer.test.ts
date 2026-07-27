/**
 * src/Audio/Synthesizer.test.ts
 * 操作类型：新建
 *
 * 合成器测试：验证每个预设至少触发若干音频节点，不抛错
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Synthesizer } from './Synthesizer';
import type { SoundPreset } from './SoundMap';

function _CreateMockCtx(): AudioContext {
  return {
    currentTime: 0,
    sampleRate: 44100,
    destination: {} as AudioDestinationNode,
    createOscillator: vi.fn(() => ({
      type: 'sine',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn((Node) => Node),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createGain: vi.fn(() => ({
      gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn((Node) => Node),
    })),
    createBiquadFilter: vi.fn(() => ({
      type: 'lowpass',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn((Node) => Node),
    })),
    createBuffer: vi.fn((Ch, Len, Rate) => ({
      numberOfChannels: Ch,
      length: Len,
      sampleRate: Rate,
      getChannelData: vi.fn(() => new Float32Array(Len)),
    })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn((Node) => Node),
      start: vi.fn(),
      stop: vi.fn(),
    })),
  } as unknown as AudioContext;
}

describe('Synthesizer', () => {
  const Presets: SoundPreset[] = [
    'DiceRoll',
    'DiceSettle',
    'OccupyUp',
    'OccupyDown',
    'ChainX2',
    'ChainX3',
    'ChainBreak',
    'RobberyStart',
    'RobberyWin',
    'RobberyLose',
    'Collapse',
    'LaunchSuccess',
    'LaunchFail',
    'GameOver',
  ];

  let Ctx: AudioContext;
  let Dest: AudioNode;
  let Synth: Synthesizer;

  beforeEach(() => {
    Ctx = _CreateMockCtx();
    Dest = Ctx.destination;
    Synth = new Synthesizer();
  });

  it.each(Presets)('预设 %s 不抛错且创建节点', (Preset) => {
    Synth.Play(Ctx, Dest, Preset);
    const TotalCalls =
      (Ctx.createOscillator as ReturnType<typeof vi.fn>).mock.calls.length +
      (Ctx.createBufferSource as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(TotalCalls).toBeGreaterThan(0);
  });
});
