/**
 * 默认随机源实现（Math.random）
 * 用途：单机 / 开发期。不可复现。
 * 联机或测试请用 SeededRandom。
 */
import type { DieFace } from '@/Types/Dice';
import type { IRandomSource } from './IRandomSource';

export class DefaultRandom implements IRandomSource {
  /** 掷一颗骰子 1..6 */
  NextDie(): DieFace {
    return (Math.floor(Math.random() * 6) + 1) as DieFace;
  }

  /** 闭区间 [Min, Max] 均匀随机整数 */
  NextInt(Min: number, Max: number): number {
    return Math.floor(Math.random() * (Max - Min + 1)) + Min;
  }
}
