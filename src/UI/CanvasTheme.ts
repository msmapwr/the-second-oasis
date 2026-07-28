/**
 * src/UI/CanvasTheme.ts
 * 操作类型：重写（新拟态UI重构）
 *
 * Canvas 新拟态主题感知调色板
 *
 * 设计要点：
 * 1. 暗色底色 #202020，亮色底色 #e0e0e0
 * 2. 所有颜色由调色板集中管理，渲染器通过 CanvasPalette() 实时取色
 * 3. 月球/看板/骰子/星空全部新拟态化
 */

import { ThemeManagerInstance } from './ThemeManager';
import { COLORS } from './Theme';

/**
 * Canvas 绘制所需的全部颜色
 * 命名按用途分组：星空 / 骰子 / 看板 / 月球
 */
export interface CanvasPalette {
  // ===== 星空背景层 =====
  SpaceBg: string;
  Star: string;
  NebulaA: string;
  NebulaB: string;

  // ===== 骰子特效层 =====
  DiceFocus: string;

  // ===== 绿洲看板层 =====
  BoardText: string;
  BoardPublic: string;
  BoardWasteland: string;
  CellStroke: string;
  CurrentHighlight: string;

  // ===== 月球视口 =====
  MoonCore: string;
  MoonInner: string;
  MoonMid: string;
  MoonOuter: string;
  MoonGlow: string;
  MoonOutline: string;
  CraterFill: string;
  CraterStroke: string;
  MoonGrid: string;
  MoonTeal: string;
  MoonPurple: string;
}

/** 暗色套：新拟态 #202020 深色底 */
const DARK: CanvasPalette = {
  SpaceBg: COLORS.NmBg,
  Star: '#909090',
  NebulaA: 'rgba(0, 245, 212, 0.03)',
  NebulaB: 'rgba(37, 99, 235, 0.03)',

  DiceFocus: COLORS.NmBg,

  BoardText: COLORS.NmText,
  BoardPublic: COLORS.OasisAccent,
  BoardWasteland: COLORS.NmTextDim,
  CellStroke: COLORS.NmShadowDark,
  CurrentHighlight: COLORS.OasisAccent,

  MoonCore: '#1a1a1a',
  MoonInner: '#282828',
  MoonMid: '#1e1e1e',
  MoonOuter: '#141414',
  MoonGlow: COLORS.NmShadowDark,
  MoonOutline: COLORS.NmShadowLight,
  CraterFill: 'rgba(144, 144, 144, 0.10)',
  CraterStroke: 'rgba(144, 144, 144, 0.22)',
  MoonGrid: 'rgba(144, 144, 144, 0.14)',
  MoonTeal: '0, 245, 212',
  MoonPurple: '124, 58, 237',
};

/** 亮色套：新拟态 #e0e0e0 亮色底 */
const LIGHT: CanvasPalette = {
  SpaceBg: '#e0e0e0',
  Star: '#606060',
  NebulaA: 'rgba(14, 124, 134, 0.03)',
  NebulaB: 'rgba(37, 99, 235, 0.03)',

  DiceFocus: '#e0e0e0',

  BoardText: '#202020',
  BoardPublic: '#202020',
  BoardWasteland: '#5e5e5e',
  CellStroke: '#bebebe',
  CurrentHighlight: '#202020',

  MoonCore: '#d4d4d4',
  MoonInner: '#ffffff',
  MoonMid: '#e8e8e8',
  MoonOuter: '#bebebe',
  MoonGlow: '#bebebe',
  MoonOutline: '#ffffff',
  CraterFill: 'rgba(14, 124, 134, 0.10)',
  CraterStroke: 'rgba(14, 124, 134, 0.25)',
  MoonGrid: 'rgba(14, 124, 134, 0.15)',
  MoonTeal: '14, 124, 134',
  MoonPurple: '91, 33, 182',
};

/**
 * 取得当前主题对应的 Canvas 调色板
 * 渲染器每帧调用，随 ThemeManager.Current 实时切换
 */
export function CanvasPalette(): CanvasPalette {
  return ThemeManagerInstance.Current === 'light' ? LIGHT : DARK;
}
