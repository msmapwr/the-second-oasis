/**
 * src/Render/Animation/NumberPopAnimation.ts
 * 操作类型：新建
 *
 * 领土数字弹出动画（DOM 层）
 *
 * 设计要点：
 * 1. 在 DOM overlay 层创建 fixed 元素，从目标数字位置向上飘出并淡出
 * 2. 正数用绿洲青，负数用警戒红，与 UI 主题一致
 * 3. 使用 transform 而非 top/left 以保证 60fps 合成层性能
 * 4. 动画结束自动移除 DOM，避免泄漏
 */
import { Animation } from './Animation';
import { COLORS } from '@/UI/Theme';

const DURATION_MS = 700;

/**
 * 数字弹出动画
 *
 * 用法：
 *   const Anim = new NumberPopAnimation(document.body, 100, 200, 5);
 *   Manager.Add(Anim);
 */
export class NumberPopAnimation extends Animation {
  private readonly _El: HTMLElement;
  private readonly _StartX: number;
  private readonly _StartY: number;

  constructor(Mount: HTMLElement, X: number, Y: number, Value: number, OnDone?: () => void) {
    super(DURATION_MS, OnDone);
    this._StartX = X;
    this._StartY = Y;

    const El = document.createElement('div');
    El.textContent = Value >= 0 ? `+${Value}` : `${Value}`;
    El.style.cssText = `
      position: fixed;
      left: 0;
      top: 0;
      transform: translate(${X}px, ${Y}px) scale(1);
      transform-origin: center center;
      font-family: monospace;
      font-weight: bold;
      font-size: 18px;
      color: ${Value >= 0 ? COLORS.OasisAccent : COLORS.Alert};
      pointer-events: none;
      z-index: 100;
      opacity: 1;
      white-space: nowrap;
    `;
    this._El = El;
    Mount.appendChild(El);
  }

  Update(Dt: number): void {
    super.Update(Dt);
    const T = this._Progress;
    const { Transform, Opacity } = this._ComputeStyle(T);
    this._El.style.transform = Transform;
    this._El.style.opacity = String(Opacity);
  }

  Render(): void {
    // DOM 动画无需 Canvas 绘制
  }

  Dispose(): void {
    if (this._El.parentNode) {
      this._El.remove();
    }
  }

  /**
   * 根据进度 0-1 计算 transform 字符串和透明度
   */
  private _ComputeStyle(T: number): { Transform: string; Opacity: number } {
    const Lift = -40 * T;
    const Scale = 1 + 0.3 * Math.sin(Math.PI * T);
    const Opacity = 1 - Math.pow(T, 2);
    return {
      Transform: `translate(${this._StartX}px, ${this._StartY + Lift}px) scale(${Scale})`,
      Opacity,
    };
  }
}
