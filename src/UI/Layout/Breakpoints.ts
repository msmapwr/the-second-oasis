/**
 * src/UI/Layout/Breakpoints.ts
 * 操作类型：新建
 *
 * 响应式断点常量
 * 关联：B 阶段架构方案 §5.8
 *
 * 设计要点：
 * 1. 集中定义断点，便于全局调整
 * 2. 命名语义化：Mobile/Tablet/Desktop
 * 3. 与 UiConstants.MOBILE_BREAKPOINT 一致
 */

/**
 * 布局模式
 * - Desktop：PC 16:9，四角 HUD + 右侧日志
 * - Mobile：竖屏，上下两列 HUD + 日志抽屉
 */
export type LayoutMode = 'Desktop' | 'Mobile';

/**
 * 断点配置
 */
export const BREAKPOINTS = {
  /** 低于此宽度切 Mobile 布局 */
  Mobile: 768,
  /** 平板过渡宽度（预留，当前不单独处理） */
  Tablet: 1024,
} as const;

/**
 * 布局配置快照
 */
export interface LayoutConfig {
  /** 当前布局模式 */
  readonly Mode: LayoutMode;
  /** 视口宽度（CSS px） */
  readonly Width: number;
  /** 视口高度（CSS px） */
  readonly Height: number;
  /** 设备像素比 */
  readonly Dpr: number;
}

/**
 * 根据宽度判定布局模式
 */
export function DetectLayoutMode(Width: number): LayoutMode {
  return Width < BREAKPOINTS.Mobile ? 'Mobile' : 'Desktop';
}
