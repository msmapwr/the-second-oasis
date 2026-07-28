/**
 * src/Render/Animation/ChainBadgeAnimation.ts
 * 操作类型：新建
 *
 * 开发链徽章提示动画（DOM 层）
 *
 * 设计要点：
 * 1. 在玩家席位上方弹出 ×2 / ×3 / 断链徽章
 * 2. 不同等级用不同颜色：×2 绿、×3 橙、断链红
 * 3. 使用 transform 弹出 + 淡出，强化连击反馈
 */
import { Animation } from './Animation';
import { COLORS } from '@/UI/Theme';
import { ThemeManagerInstance } from '@/UI/ThemeManager';

const DURATION_MS = 900;

export type ChainBadgeType = 'X2' | 'X3' | 'Break';

/**
 * 开发链徽章动画
 *
 * 用法：
 *   const Anim = new ChainBadgeAnimation(document.body, 100, 100, 'X3');
 *   Manager.Add(Anim);
 */
export class ChainBadgeAnimation extends Animation {
  private readonly _El: HTMLElement;
  private readonly _BaseX: number;
  private readonly _BaseY: number;

  constructor(
    Mount: HTMLElement,
    CenterX: number,
    CenterY: number,
    Type: ChainBadgeType,
    OnDone?: () => void,
  ) {
    super(DURATION_MS, OnDone);

    const { Text, Color } = _BadgeConfig(Type);
    this._BaseX = CenterX;
    this._BaseY = CenterY;

    // 亮色主题下背景转白（暗色保留深色底），保证徽章在白底上可读
    const BadgeBg =
      ThemeManagerInstance.Current === 'light'
        ? 'rgba(255, 255, 255, 0.92)'
        : 'rgba(0, 0, 0, 0.6)';

    const El = document.createElement('div');
    El.textContent = Text;
    El.style.cssText = `
      position: fixed;
      left: 0;
      top: 0;
      transform: translate(${CenterX}px, ${CenterY}px) translate(-50%, -50%) scale(0.5);
      transform-origin: center center;
      font-family: monospace;
      font-weight: bold;
      font-size: 22px;
      color: ${Color};
      text-shadow: 0 0 10px ${Color};
      padding: 4px 8px;
      border: 2px solid ${Color};
      border-radius: 4px;
      background: ${BadgeBg};
      pointer-events: none;
      z-index: 100;
      opacity: 0;
    `;
    this._El = El;
    Mount.appendChild(El);
  }

  Update(Dt: number): void {
    super.Update(Dt);
    const T = this._Progress;

    // 前 20% 快速弹出，后 80% 保持并淡出
    const Pop = Math.min(1, T / 0.2);
    const Scale = 0.5 + 0.7 * Pop;
    const Lift = -50 * T;
    const Opacity = T < 0.2 ? Pop : 1 - Math.pow((T - 0.2) / 0.8, 2);

    this._El.style.transform =
      `translate(${this._BaseX}px, ${this._BaseY + Lift}px) translate(-50%, -50%) scale(${Scale})`;
    this._El.style.opacity = String(Opacity);
  }

  Render(): void {
    // DOM 动画无需 Canvas 绘制
  }

  Dispose(): void {
    this._El.remove();
  }
}

function _BadgeConfig(Type: ChainBadgeType): { Text: string; Color: string } {
  switch (Type) {
    case 'X2':
      return { Text: '×2', Color: COLORS.Safe };
    case 'X3':
      return { Text: '×3', Color: COLORS.Hazard };
    case 'Break':
      return { Text: '断链', Color: COLORS.Alert };
    default:
      // exhaustive check
      const _Exhaustive: never = Type;
      void _Exhaustive;
      return { Text: '?', Color: COLORS.NmTextSecondary };
  }
}
