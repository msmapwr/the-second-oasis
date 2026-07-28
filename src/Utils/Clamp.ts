/**
 * 数值 clamp 工具函数
 * 用途：领土数值不允许负数时的统一处理
 * 所有"扣至 0 为止"的边界都用此工具，保证守恒逻辑一致
 */

/**
 * 将 Value 限制在 [Min, Max] 闭区间
 */
export function Clamp(Value: number, Min: number, Max: number): number {
  if (Value < Min) return Min;
  if (Value > Max) return Max;
  return Value;
}

/**
 * 将 Value 限制 ≥ Min（上不封顶）
 */
export function ClampMin(Value: number, Min: number): number {
  return Value < Min ? Min : Value;
}

/**
 * 将 Value 限制 ≤ Max（下不封顶）
 */
export function ClampMax(Value: number, Max: number): number {
  return Value > Max ? Max : Value;
}
