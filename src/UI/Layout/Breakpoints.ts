/**
 * src/UI/Layout/Breakpoints.ts
 * 操作类型：重写
 *
 * 响应式断点常量
 * 关联：v1.4.1 移动端响应式三档布局
 *
 * 设计要点：
 * 1. 三档设备：Phone ≤480px / Tablet 481~1024px / Desktop >1024px
 * 2. DeviceClass 供所有组件查询当前档位
 * 3. 与 UiConstants.MOBILE_BREAKPOINT 保持兼容
 */

export type LayoutMode = 'Desktop' | 'Mobile';

export type DeviceClass = 'Phone' | 'Tablet' | 'Desktop';

export const BREAKPOINTS = {
  /** 手机最大宽度 */
  Phone: 480,
  /** 平板最大宽度 */
  Tablet: 1024,
  /** 旧版兼容（等同于 Tablet） */
  Mobile: 768,
} as const;

export interface LayoutConfig {
  readonly Mode: LayoutMode;
  readonly Device: DeviceClass;
  readonly Width: number;
  readonly Height: number;
  readonly Dpr: number;
}

export function DetectDeviceClass(Width: number): DeviceClass {
  if (Width <= BREAKPOINTS.Phone) return 'Phone';
  if (Width <= BREAKPOINTS.Tablet) return 'Tablet';
  return 'Desktop';
}

export function DetectLayoutMode(Width: number): LayoutMode {
  return Width < BREAKPOINTS.Mobile ? 'Mobile' : 'Desktop';
}
