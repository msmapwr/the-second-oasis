/**
 * src/Audio/AudioEngine.test.ts
 * 操作类型：新建
 *
 * 音频引擎测试（使用 mock AudioContext）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioEngine } from './AudioEngine';
import { AccessibilitySettings } from './AccessibilitySettings';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _CreateMockCtx(): any {
  const Nodes: any[] = [];

  const Ctx = {
    state: 'suspended',
    currentTime: 0,
    sampleRate: 44100,
    destination: { connect: vi.fn() },

    resume: vi.fn(async () => {
      Ctx.state = 'running';
    }),

    close: vi.fn(async () => {
      Ctx.state = 'closed';
    }),

    createOscillator: vi.fn(() => {
      const Osc: any = {
        type: 'sine',
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        buffer: null,
        connect: vi.fn((Node: any) => {
          Nodes.push(Node);
          return Osc;
        }),
        start: vi.fn(),
        stop: vi.fn(),
      };
      return Osc;
    }),

    createGain: vi.fn(() => {
      const Gain: any = {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        buffer: null,
        connect: vi.fn((Node: any) => {
          Nodes.push(Node);
          return Gain;
        }),
        start: vi.fn(),
        stop: vi.fn(),
      };
      return Gain;
    }),

    createBiquadFilter: vi.fn(() => {
      return {
        type: 'lowpass',
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        buffer: null,
        connect: vi.fn((Node: any) => Node),
        start: vi.fn(),
        stop: vi.fn(),
      };
    }),

    createBuffer: vi.fn((Ch: number, Len: number, Rate: number) => {
      return {
        numberOfChannels: Ch,
        length: Len,
        sampleRate: Rate,
        getChannelData: vi.fn(() => new Float32Array(Len)),
      };
    }),

    createBufferSource: vi.fn(() => {
      return {
        buffer: null,
        connect: vi.fn((Node: any) => Node),
        start: vi.fn(),
        stop: vi.fn(),
      };
    }),
  };

  return Ctx;
}

describe('AudioEngine', () => {
  let Ctx: any;
  let Settings: AccessibilitySettings;

  beforeEach(() => {
    Ctx = _CreateMockCtx();
    Settings = new AccessibilitySettings();
  });

  it('Resume 会恢复 AudioContext', async () => {
    const Engine = new AudioEngine({ Settings, Ctx });
    await Engine.Resume();
    expect(Ctx.resume).toHaveBeenCalled();
    expect(Ctx.state).toBe('running');
    Engine.Dispose();
  });

  it('Play 会触发振荡器 start', () => {
    const Engine = new AudioEngine({ Settings, Ctx });
    Engine.Play('DiceSettle');

    const OscCalls = (Ctx.createOscillator as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(OscCalls).toBeGreaterThan(0);
    Engine.Dispose();
  });

  it('静音时 Play 不创建节点', () => {
    Settings.SetMuted(true);
    const Engine = new AudioEngine({ Settings, Ctx });
    Engine.Play('DiceSettle');

    expect(Ctx.createOscillator).not.toHaveBeenCalled();
    Engine.Dispose();
  });

  it('Resume 后 muted 变化会调整 MasterGain', () => {
    const Engine = new AudioEngine({ Settings, Ctx });
    const Master = (Ctx.createGain as ReturnType<typeof vi.fn>).mock.results[0].value;

    Settings.SetMuted(true);
    expect(Master.gain.value).toBe(0);

    Settings.SetMuted(false);
    expect(Master.gain.value).toBe(1);
    Engine.Dispose();
  });

  it('Dispose 会关闭 AudioContext', () => {
    const Engine = new AudioEngine({ Settings, Ctx });
    Engine.Dispose();
    expect(Ctx.close).toHaveBeenCalled();
  });
});
