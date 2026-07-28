/**
 * 开发链状态机——处理连续对子的倍率与开发过度
 * 关联规则：计划书 §9 连击机制、Q4（翻倍基数）、Q8（计数清零）、冲突点 2（小对子）
 *
 * 设计要点：
 * 1. 每玩家独立一个 DevChain 实例（GameState 持有 Map<PlayerId, DevChain>）
 * 2. 纯状态机，无随机源依赖，状态由 Advance 调用推进
 * 3. Q8：任何非对子结果（含 None 模式、Steady 单骰）都清零连击
 */
import { DiceMode } from '@/Types/Dice';
import { DevMultiplier } from '@/Types/DevChain';
import type { DevChainOutcome } from '@/Types/DevChain';
import { DEV_CHAIN_OVERLOAD_THRESHOLD } from './Constants';

export class DevChain {
  /** 连续对子计数 0..2（达到 3 触发开发过度后归 0） */
  private _ConsecutiveDoubles: number;

  constructor(InitialCount: number = 0) {
    this._ConsecutiveDoubles = InitialCount;
  }

  /** 当前连击计数（只读） */
  get ConsecutiveDoubles(): number {
    return this._ConsecutiveDoubles;
  }

  /**
   * 根据本回合掷骰结果推进状态机
   * @param IsDouble 是否对子（DiceRoller.IsDouble；None/Steady 恒 false）
   * @param Mode 本回合模式（None 也算"非对子"→ 清零，Q8）
   * @returns 结算输出（倍率 / 是否过度 / 新连击计数）
   */
  Advance(IsDouble: boolean, Mode: DiceMode): DevChainOutcome {
    // Q8：None 模式 = 未掷出对子 = 清零连击
    if (Mode === DiceMode.None) {
      this._ConsecutiveDoubles = 0;
      return {
        Multiplier: DevMultiplier.None,
        IsOverload: false,
        NewConsecutiveDoubles: 0,
      };
    }

    // 非对子（含 Steady 单骰）→ 清零连击
    if (!IsDouble) {
      this._ConsecutiveDoubles = 0;
      return {
        Multiplier: DevMultiplier.None,
        IsOverload: false,
        NewConsecutiveDoubles: 0,
      };
    }

    // 对子（仅 Aggressive 双骰相同，含冲突点 2 的小对子 (1,1)/(2,2)/(3,3)）
    this._ConsecutiveDoubles += 1;

    if (this._ConsecutiveDoubles >= DEV_CHAIN_OVERLOAD_THRESHOLD) {
      // 第 3 次连续对子 → 开发过度：清零连击，触发 Overload
      this._ConsecutiveDoubles = 0;
      return {
        // Overload 时倍率不使用（调用方应跳过占领），返回 None 标识
        Multiplier: DevMultiplier.None,
        IsOverload: true,
        NewConsecutiveDoubles: 0,
      };
    }

    if (this._ConsecutiveDoubles === 1) {
      // 第 1 次连续对子 → 开发 ×2
      return {
        Multiplier: DevMultiplier.Dev,
        IsOverload: false,
        NewConsecutiveDoubles: 1,
      };
    }

    // 第 2 次连续对子 → 大开发 ×3
    return {
      Multiplier: DevMultiplier.BigDev,
      IsOverload: false,
      NewConsecutiveDoubles: 2,
    };
  }

  /**
   * 强制重置连击计数
   * 用于：开发过度后（虽 Advance 已归 0，显式调用保险）、重新发射后
   */
  Reset(): void {
    this._ConsecutiveDoubles = 0;
  }
}
