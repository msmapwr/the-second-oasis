/**
 * src/UI/TouchGestures.ts
 * 操作类型：新建
 *
 * 触屏手势检测——滑动选择模式、长按卡牌详情、禁用默认缩放与长按菜单。
 */

export type SwipeDirection = 'up' | 'down' | 'left' | 'right' | null;

export interface SwipeResult {
  Direction: SwipeDirection;
  StartX: number;
  StartY: number;
  EndX: number;
  EndY: number;
  Distance: number;
}

export interface TouchCallbacks {
  OnSwipe?: (R: SwipeResult) => void;
  OnLongPress?: (X: number, Y: number) => void;
  OnTap?: (X: number, Y: number) => void;
}

const SWIPE_MIN_DISTANCE = 40;
const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_TOLERANCE = 10;

let _GlobalSetup = false;

export function SetupGlobalTouch(): void {
  if (_GlobalSetup) return;
  _GlobalSetup = true;

  document.documentElement.style.touchAction = 'manipulation';
  document.documentElement.style.webkitUserSelect = 'none';
  document.documentElement.style.userSelect = 'none';

  document.addEventListener('touchstart', (E) => {
    if (E.touches.length > 1) return;
  }, { passive: true });

  document.addEventListener('contextmenu', (E) => {
    E.preventDefault();
  });
}

export class TouchDetector {
  private _StartX = 0;
  private _StartY = 0;
  private _Moved = false;
  private _LongPressTimer: number | null = null;
  private _Callbacks: TouchCallbacks;
  private _El: HTMLElement;

  constructor(El: HTMLElement, Callbacks: TouchCallbacks) {
    this._El = El;
    this._Callbacks = Callbacks;

    El.addEventListener('touchstart', this._OnStart, { passive: false });
    El.addEventListener('touchmove', this._OnMove, { passive: false });
    El.addEventListener('touchend', this._OnEnd, { passive: false });
    El.addEventListener('mousedown', this._OnMouseStart as EventListener);
    El.addEventListener('mouseup', this._OnMouseEnd as EventListener);
  }

  private _OnStart = (E: TouchEvent): void => {
    const T = E.touches[0];
    this._StartX = T.clientX;
    this._StartY = T.clientY;
    this._Moved = false;

    this._ClearLongPress();
    this._LongPressTimer = window.setTimeout(() => {
      this._LongPressTimer = null;
      if (!this._Moved) {
        this._Callbacks.OnLongPress?.(this._StartX, this._StartY);
      }
    }, LONG_PRESS_MS);
  };

  private _OnMove = (E: TouchEvent): void => {
    const T = E.touches[0];
    const Dx = Math.abs(T.clientX - this._StartX);
    const Dy = Math.abs(T.clientY - this._StartY);
    if (Dx > LONG_PRESS_MOVE_TOLERANCE || Dy > LONG_PRESS_MOVE_TOLERANCE) {
      this._Moved = true;
      this._ClearLongPress();
    }
    if (this._Moved) {
      E.preventDefault();
    }
  };

  private _OnEnd = (E: TouchEvent): void => {
    this._ClearLongPress();
    const T = E.changedTouches[0];
    const Dx = T.clientX - this._StartX;
    const Dy = T.clientY - this._StartY;
    const Dist = Math.sqrt(Dx * Dx + Dy * Dy);

    if (Dist >= SWIPE_MIN_DISTANCE) {
      const AbsDx = Math.abs(Dx);
      const AbsDy = Math.abs(Dy);
      let Dir: SwipeDirection = null;
      if (AbsDx > AbsDy) {
        Dir = Dx > 0 ? 'right' : 'left';
      } else {
        Dir = Dy > 0 ? 'down' : 'up';
      }
      this._Callbacks.OnSwipe?.({
        Direction: Dir,
        StartX: this._StartX,
        StartY: this._StartY,
        EndX: T.clientX,
        EndY: T.clientY,
        Distance: Dist,
      });
    } else if (!this._Moved) {
      this._Callbacks.OnTap?.(T.clientX, T.clientY);
    }
  };

  private _OnMouseStart = (E: MouseEvent): void => {
    this._StartX = E.clientX;
    this._StartY = E.clientY;
    this._Moved = false;

    this._ClearLongPress();
    this._LongPressTimer = window.setTimeout(() => {
      this._LongPressTimer = null;
      if (!this._Moved) {
        this._Callbacks.OnLongPress?.(this._StartX, this._StartY);
      }
    }, LONG_PRESS_MS);
  };

  private _OnMouseEnd = (E: MouseEvent): void => {
    this._ClearLongPress();
    const Dx = E.clientX - this._StartX;
    const Dy = E.clientY - this._StartY;
    const Dist = Math.sqrt(Dx * Dx + Dy * Dy);

    if (Dist >= SWIPE_MIN_DISTANCE) {
      const AbsDx = Math.abs(Dx);
      const AbsDy = Math.abs(Dy);
      let Dir: SwipeDirection = null;
      if (AbsDx > AbsDy) {
        Dir = Dx > 0 ? 'right' : 'left';
      } else {
        Dir = Dy > 0 ? 'down' : 'up';
      }
      this._Callbacks.OnSwipe?.({
        Direction: Dir,
        StartX: this._StartX,
        StartY: this._StartY,
        EndX: E.clientX,
        EndY: E.clientY,
        Distance: Dist,
      });
    } else {
      this._Callbacks.OnTap?.(E.clientX, E.clientY);
    }
  };

  private _ClearLongPress(): void {
    if (this._LongPressTimer !== null) {
      clearTimeout(this._LongPressTimer);
      this._LongPressTimer = null;
    }
  }

  Dispose(): void {
    this._ClearLongPress();
    this._El.removeEventListener('touchstart', this._OnStart);
    this._El.removeEventListener('touchmove', this._OnMove);
    this._El.removeEventListener('touchend', this._OnEnd);
    this._El.removeEventListener('mousedown', this._OnMouseStart as EventListener);
    this._El.removeEventListener('mouseup', this._OnMouseEnd as EventListener);
  }
}
