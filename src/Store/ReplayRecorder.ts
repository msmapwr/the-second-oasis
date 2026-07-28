/**
 * src/Store/ReplayRecorder.ts
 * 操作类型：新建
 *
 * 回放录制器——订阅 GameStore 事件流，构造不可变的事件数组。
 * 使用方式：AppController 在开局时挂载，终局时通过 GetReplay 取回完整 StoredReplay。
 */

import type { IGameStore } from '@/Store/GameStore';
import type { ReplayHeader, ReplayEvent, StoredReplay } from '@/Types/Replay';

export class ReplayRecorder {
  private readonly _Header: ReplayHeader;
  private readonly _Events: ReplayEvent[] = [];
  private _Started = false;
  private _Unsubs: Array<() => void> = [];

  constructor(Header: ReplayHeader) {
    this._Header = Header;
  }

  Start(Store: IGameStore): void {
    if (this._Started) return;
    this._Started = true;

    this._Unsubs.push(Store.On('Launch', ({ Result }) => {
      this._Events.push({ type: 'Launch', payload: Result });
    }));

    this._Unsubs.push(Store.On('Turn', ({ Result }) => {
      this._Events.push({ type: 'Turn', payload: Result });
    }));

    this._Unsubs.push(Store.On('Tiebreaker', ({ Round }) => {
      this._Events.push({ type: 'Tiebreaker', payload: Round });
    }));

    this._Unsubs.push(Store.On('CardUsed', ({ Record, InstanceId }) => {
      this._Events.push({ type: 'CardUsed', payload: { Record, InstanceId } });
    }));

    this._Unsubs.push(Store.On('GameOver', (Result) => {
      this._Events.push({ type: 'GameOver', payload: Result });
    }));

    this._Unsubs.push(Store.On('PhaseChange', ({ From, To }) => {
      this._Events.push({ type: 'PhaseChange', payload: { from: From, to: To } });
    }));

    this._Unsubs.push(Store.On('RoundChange', ({ RoundIndex, FirstPlayerIndex }) => {
      this._Events.push({ type: 'RoundChange', payload: { roundIndex: RoundIndex, firstPlayerIndex: FirstPlayerIndex } });
    }));

    this._Unsubs.push(Store.On('Snapshot', (Snap) => {
      if (this._Events.length > 0 && this._Events.length % 50 === 0) {
        this._Events.push({ type: 'Keyframe', payload: Snap });
      }
    }));
  }

  Stop(): void {
    for (const Unsub of this._Unsubs) {
      Unsub();
    }
    this._Unsubs = [];
    this._Started = false;
  }

  GetEvents(): readonly ReplayEvent[] {
    return this._Events;
  }

  BuildReplay(Id: string): StoredReplay {
    return {
      id: Id,
      header: this._Header,
      events: this._Events,
      compressed: false,
    };
  }
}
