/**
 * src/UI/Theme.ts
 * 操作类型：重写（新拟态UI重构）
 *
 * 新拟态配色规范 + CSS 变量定义
 *
 * 设计要点：
 * 1. 纯粹新拟态（Soft UI）：同色系双阴影模拟凸起/凹陷
 * 2. 暗色 #202020 底色 + 柔和白 #d0d0d0 文字
 * 3. 亮色 #e0e0e0 底色 + #202020 文字
 * 4. 绿洲青 #00F5D4 仅作文字/选中态强调
 * 5. 阵营色降饱和度（S 打 7 折）
 * 6. JS 常量供 Canvas 引用，CSS 变量供 DOM 引用
 */

/**
 * 颜色常量（Canvas 渲染层直接引用）
 */
export const COLORS = {
  // 新拟态底色
  NmBg: '#202020',
  NmShadowDark: '#141414',
  NmShadowLight: '#2c2c2c',
  NmText: '#d0d0d0',
  NmTextSecondary: '#909090',
  NmTextDim: '#606060',

  // 绿洲强调色（仅文字/选中态）
  OasisAccent: '#00F5D4',

  // 4 阵营色（饱和度降至原色约 70%）
  Faction0: '#2563EB',
  Faction1: '#7C3AED',
  Faction2: '#D97706',
  Faction3: '#DB2777',

  // 战术语义色
  Safe: '#10B981',
  Hazard: '#FF6B00',
  Alert: '#EF4444',
  Pass: '#6B7280',
} as const;

/**
 * 4 阵营色数组（按 PlayerId 索引）
 */
export const FACTION_COLORS: readonly string[] = [
  COLORS.Faction0,
  COLORS.Faction1,
  COLORS.Faction2,
  COLORS.Faction3,
];

/**
 * 日志级别对应的颜色
 * 关联：BattleLogTerminal
 */
export const LOG_LEVEL_COLORS: Record<string, string> = {
  Info: COLORS.NmTextSecondary,
  Dice: COLORS.OasisAccent,
  Occupy: COLORS.Safe,
  Robbery: COLORS.Faction1,
  Collapse: COLORS.Alert,
  Overload: COLORS.Hazard,
  Launch: COLORS.Faction0,
  Tiebreaker: COLORS.Faction2,
  GameOver: COLORS.OasisAccent,
  Tax: COLORS.Faction3,
  Sprint: COLORS.Alert,
  Revenge: COLORS.Faction1,
};

/**
 * CSS 变量定义字符串
 * 由 StyleInjector 一次性注入 :root
 * 双主题支持：data-theme="dark" (默认) / data-theme="light"
 */
export const CSS_VARIABLES = `
  /* ===== 暗色主题��默认）===== */
  :root,
  [data-theme="dark"] {
    --nm-bg: #202020;
    --nm-shadow-dark: #141414;
    --nm-shadow-light: #2c2c2c;
    --nm-text: #d0d0d0;
    --nm-text-secondary: #909090;
    --nm-text-dim: #606060;

    --nm-raised-sm: 4px 4px 8px var(--nm-shadow-dark), -4px -4px 8px var(--nm-shadow-light);
    --nm-raised-md: 8px 8px 16px var(--nm-shadow-dark), -8px -8px 16px var(--nm-shadow-light);
    --nm-raised-lg: 12px 12px 24px var(--nm-shadow-dark), -12px -12px 24px var(--nm-shadow-light);
    --nm-pressed-sm: inset 3px 3px 6px var(--nm-shadow-dark), inset -3px -3px 6px var(--nm-shadow-light);
    --nm-pressed-md: inset 6px 6px 12px var(--nm-shadow-dark), inset -6px -6px 12px var(--nm-shadow-light);

    --nm-radius-container: 8px;
    --nm-radius-element: 4px;

    --faction-0: #2563EB;
    --faction-1: #7C3AED;
    --faction-2: #D97706;
    --faction-3: #DB2777;

    --safe: #10B981;
    --hazard: #FF6B00;
    --alert: #EF4444;
    --pass: #6B7280;
    --oasis-accent: #00F5D4;
  }

  /* ===== 亮色主题 ===== */
  [data-theme="light"] {
    --nm-bg: #e0e0e0;
    --nm-shadow-dark: #bebebe;
    --nm-shadow-light: #ffffff;
    --nm-text: #202020;
    --nm-text-secondary: #404040;
    --nm-text-dim: #5e5e5e;

    --nm-raised-sm: 4px 4px 8px var(--nm-shadow-dark), -4px -4px 8px var(--nm-shadow-light);
    --nm-raised-md: 8px 8px 16px var(--nm-shadow-dark), -8px -8px 16px var(--nm-shadow-light);
    --nm-raised-lg: 12px 12px 24px var(--nm-shadow-dark), -12px -12px 24px var(--nm-shadow-light);
    --nm-pressed-sm: inset 3px 3px 6px var(--nm-shadow-dark), inset -3px -3px 6px var(--nm-shadow-light);
    --nm-pressed-md: inset 6px 6px 12px var(--nm-shadow-dark), inset -6px -6px 12px var(--nm-shadow-light);

    --nm-radius-container: 8px;
    --nm-radius-element: 4px;

    --faction-0: #2563EB;
    --faction-1: #7C3AED;
    --faction-2: #D97706;
    --faction-3: #DB2777;

    --safe: #059669;
    --hazard: #EA580C;
    --alert: #DC2626;
    --pass: #6B7280;
    --oasis-accent: #202020;
  }
`;

/**
 * 阵营色 CSS 变量名（按 PlayerId）
 * 用于组件动态引用
 */
export function FactionVar(Id: number): string {
  return `var(--faction-${Id})`;
}
