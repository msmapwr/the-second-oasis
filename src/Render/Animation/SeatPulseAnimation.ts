/**
 * src/Render/Animation/SeatPulseAnimation.ts
 * 操作类型：新建
 *
 * 当前玩家席位脉冲光环（DOM 层）
 *
 * 设计要点：
 * 1. 从目标席位中心向外扩散的光环，提示当前行动者
 * 2. 使用 transform 缩放 + 透明度淡出，保证合成层流畅
 * 3. 一回合仅触发一次，避免持续闪烁干扰思考
 */
import { Animation } from './Animation';
import { COLORS } from '@/UI/Theme';

const DURATION_MS = 600;

/**
 * 席位脉冲动画
 *
 * 用法：
 *   const Anim = new SeatPulseAnimation(document.body, 100, 100, 80, 40, '#00F5D4');
 *   Manager.Add(Anim);
 */
export class SeatPulseAnimation extends Animation {
  private readonly _El: HTMLElement;
  private readonly _BaseX: number;
  private readonly _BaseY: number;
  private readonly _Width: number;
  private readonly _Height: number;

  constructor(
    Mount: HTMLElement,
    CenterX: number,
    CenterY: number,
    Width: number,
    Height: number,
    Color: string = COLORS.OasisAccent,
    OnDone?: () => void,
  ) {
    super(DURATION_MS, OnDone);
    this._BaseX = CenterX - Width / 2;
    this._BaseY = CenterY - Height / 2;
    this._Width = Width;
    this._Height = Height;

    const El = document.createElement('div');
    El.style.cssText = `
      position: fixed;
      left: 0;
      top: 0;
      width: ${Width}px;
      height: ${Height}px;
      transform: translate(${this._BaseX}px, ${this._BaseY}px) scale(1);
      transform-origin: center center;
      border: 2px solid ${Color};
      border-radius: 4px;
      box-shadow: 0 0 12px ${Color};
      opacity: 0.6;
      pointer-events: none;
      z-index: 90;
    `;
    this._El = El;
    Mount.appendChild(El);
  }

  Update(Dt: number): void {
    super.Update(Dt);
    const T = this._Progress;
    const Scale = 1 + 0.4 * T;
    const Opacity = 0.6 * (1 - T);
    // 缩放以中心为原点，translate 需反向补偿，避免光环偏移
    const OffsetX = (this._Width * Scale - this._Width) / 2;
    const OffsetY = (this._Height * Scale - this._Height) / 2;

    this._El.style.transform =
      `translate(${this._BaseX - OffsetX}px, ${this._BaseY - OffsetY}px) scale(${Scale})`;
    this._El.style.opacity = String(Opacity);
  }

  Render(): void {
    // DOM 动画无需 Canvas 绘制
  }

  Dispose(): void {
    this._El.remove();
  }
}
