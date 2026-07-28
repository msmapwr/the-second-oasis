/**
 * src/Render/Animation/AnimationCoordinator.test.ts
 * 操作类型：新建
 *
 * 动画编排器测试：验证事件订阅与动画/音频触发链路
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnimationCoordinator, type ICoordProvider } from './AnimationCoordinator';
import { AnimationManager } from './AnimationManager';
import { AudioEngine } from '@/Audio/AudioEngine';
import { AccessibilitySettings } from '@/Audio/AccessibilitySettings';
import { GameStore } from '@/Store/GameStore';
import { CreateDefaultConfig } from '@/Types/GameConfig';
import { InstallFakeDom, ResetFakeDom, FakeElement } from './TestDom';

function _FakeRect(): DOMRect {
  return {
    x: 10,
    y: 20,
    width: 80,
    height: 40,
    top: 20,
    left: 10,
    right: 90,
    bottom: 60,
    toJSON: () => '',
  } as DOMRect;
}

function _CreateMockCoordProvider(): ICoordProvider {
  const Seats: Record<number, FakeElement> = {};
 const Public = new FakeElement('span');
  Public.getBoundingClientRect = () => _FakeRect();
  Public.textContent = '100';

  for (let I = 0; I < 2; I += 1) {
    const El = new FakeElement('div');
    El.getBoundingClientRect = () => _FakeRect();
    Seats[I] = El;
  }

  return {
    GetSeatValueEl: (Id) => Seats[Id] as unknown as HTMLElement,
    GetPublicNumEl: () => Public as unknown as HTMLElement,
    GetMountEl: () => document.body as unknown as HTMLElement,
  };
}

function _CreateAudioMock(): AudioEngine {
  return {
    Play: vi.fn(),
    Resume: vi.fn(async () => {}),
    Dispose: vi.fn(),
  } as unknown as AudioEngine;
}

describe('AnimationCoordinator', () => {
  let Store: GameStore;
  let Manager: AnimationManager;
  let Audio: AudioEngine;
  let Coords: ICoordProvider;

  beforeEach(() => {
    ResetFakeDom();
    InstallFakeDom();
    const Settings = new AccessibilitySettings();
    Store = new GameStore(CreateDefaultConfig(2, 42));
    Manager = new AnimationManager(Settings);
    Audio = _CreateAudioMock();
    Coords = _CreateMockCoordProvider();
  });

  it('订阅 Store 事件后不报错', () => {
    const Coord = new AnimationCoordinator(Store, Manager, Audio, Coords);
    expect(Coord).toBeDefined();
    Coord.Dispose();
  });

  it('Launch 事件触发音频', () => {
    const Coord = new AnimationCoordinator(Store, Manager, Audio, Coords);
    Store.Start();
    Store.AttemptLaunch();

    const PlayCalls = (Audio.Play as ReturnType<typeof vi.fn>).mock.calls;
    expect(PlayCalls.length).toBeGreaterThan(0);
    Coord.Dispose();
  });

  it('Turn 事件触发音频和动画', () => {
    const Coord = new AnimationCoordinator(Store, Manager, Audio, Coords);
    Store.Start();
    // 让所有玩家完成发射序章
    while (Store.Phase === 'LaunchPhase' as never) {
      Store.AttemptLaunch();
    }

    Store.PlayTurn('Steady' as never);

    const PlayCalls = (Audio.Play as ReturnType<typeof vi.fn>).mock.calls;
    expect(PlayCalls.length).toBeGreaterThan(0);
    expect(Manager.HasActive).toBe(true);
    Coord.Dispose();
  });

  it('Dispose 后取消订阅', () => {
    const Coord = new AnimationCoordinator(Store, Manager, Audio, Coords);
    Coord.Dispose();
    Store.Start();

    expect((Audio.Play as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});
