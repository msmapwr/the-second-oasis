import { El } from '../Dom';
import { Component } from './Component';
import { PlayerPalette } from '@/Store/PlayerPalette';
import { TweenNumber } from '@/UI/Anim/Tween';
import type { PlayerId } from '@/Types/Player';
import type { PlayerSnapshot } from '@/Types/Player';

interface PlayerSeat {
  Root: HTMLElement;
  Value: HTMLElement;
  Combo: HTMLElement;
  Flags: HTMLElement;
}

export class PlayerHudGrid extends Component {
  private _Seats: PlayerSeat[] = [];
  private _PrevPrivate: number[] = [];
  private readonly _PlayerCount: number;

  constructor(PlayerCount: number) {
    super();
    this._PlayerCount = PlayerCount;
  }

  Mount(Parent: HTMLElement): void {
    const Root = El({ Tag: 'div', Class: 'seat-layer', Parent });
    for (let Id = 0; Id < this._PlayerCount; Id++) {
      const Seat = this._BuildSeat(Root, Id);
      this._Seats.push(Seat);
    }
    El({ Tag: 'div', Class: 'board-spacer', Parent });
    this.SetRoot(Root);
  }

  private _BuildSeat(Root: HTMLElement, Id: number): PlayerSeat {
    const Color = PlayerPalette.Color(Id);
    const Seat = El({
      Tag: 'div',
      Class: `player-seat seat-${Id} panel-surface`,
      Parent: Root,
    });
    Seat.style.setProperty('--c', Color);

    El({ Tag: 'div', Class: 'seat-bar', Parent: Seat, Style: `background:${Color};height:4px;` });

    const Head = El({ Tag: 'div', Class: 'seat-head', Parent: Seat });
    El({
      Tag: 'span', Class: 'font-mono', Parent: Head,
      Style: `font-size:13px;font-weight:bold;color:${Color};`,
      Text: PlayerPalette.LabelLong(Id),
    });
    const Combo = El({
      Tag: 'span', Class: 'combo-badge font-mono', Parent: Head,
      Style: 'font-size:10px;',
      Text: '',
    });

    const Value = El({
      Tag: 'div', Class: 'font-display seat-value', Parent: Seat,
      Style: 'font-size:26px;font-weight:900;color:var(--text-primary);',
      Text: '0',
    });

    const Flags = El({
      Tag: 'div', Class: 'font-mono seat-flags', Parent: Seat,
      Style: 'font-size:10px;color:var(--text-dim);min-height:14px;',
      Text: '',
    });

    return { Root: Seat, Value, Combo, Flags };
  }

  Refresh(Players: readonly PlayerSnapshot[], CurrentId: PlayerId): void {
    for (const P of Players) {
      const Seat = this._Seats[P.Id];
      if (!Seat) continue;

      const Prev = this._PrevPrivate[P.Id] ?? P.PrivateTerritory;
      TweenNumber(Seat.Value, P.PrivateTerritory);
      if (P.PrivateTerritory !== Prev) {
        this._FlashValue(Seat.Value, P.PrivateTerritory - Prev);
      }
      this._PrevPrivate[P.Id] = P.PrivateTerritory;

      const Combo = PlayerPalette.ComboLabel(P.ConsecutiveDoubles);
      Seat.Combo.textContent = Combo;
      Seat.Combo.style.color = Combo ? PlayerPalette.Color(P.Id) : 'transparent';
      Seat.Combo.style.borderColor = Combo ? PlayerPalette.Color(P.Id) : 'transparent';

      const Flags: string[] = [];
      if (!P.IsLaunched) Flags.push('待发射');
      if (P.IsWasteland) Flags.push('荒地');
      if (P.Status === 'NeedsRelaunch' as never) Flags.push('需重发射');
      if (P.RevengeToken) Flags.push('复仇令牌');
      Seat.Flags.textContent = Flags.join(' · ');

      if (P.Id === CurrentId) {
        Seat.Root.classList.add('is-current');
      } else {
        Seat.Root.classList.remove('is-current');
      }
    }
  }

  FlashSeats(Ids: number[]): void {
    for (const Id of Ids) {
      const Seat = this._Seats[Id];
      if (!Seat) continue;
      Seat.Root.classList.remove('flash-robbery');
      void Seat.Root.offsetWidth;
      Seat.Root.classList.add('flash-robbery');
      window.setTimeout(() => {
        Seat.Root.classList.remove('flash-robbery');
      }, 720);
    }
  }

  GetSeatValueEl(Id: PlayerId): HTMLElement | null {
    return this._Seats[Id]?.Value ?? null;
  }

  GetSeatRoot(Id: PlayerId): HTMLElement | null {
    return this._Seats[Id]?.Root ?? null;
  }

  private _FlashValue(El: HTMLElement, Delta: number): void {
    El.classList.remove('flash-up', 'flash-down');
    void El.offsetWidth;
    El.classList.add(Delta > 0 ? 'flash-up' : 'flash-down');
  }
}
