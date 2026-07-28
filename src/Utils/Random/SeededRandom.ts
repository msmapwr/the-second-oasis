/**
 * 种子随机源实现（mulberry32 算法）
 * 用途：联机（服务端下发 Seed）、测试（断言精确值）、蒙特卡洛模拟（可复现）
 *
 * 关键不变量：相同 Seed + 相同调用序列 → 完全相同输出
 * Core 层零第三方依赖，PRNG 自带实现
 */
import type { DieFace } from '@/Types/Dice';
import type { IRandomSource } from './IRandomSource';

export class SeededRandom implements IRandomSource {
  /** 内部状态（32 位无符号整数，随每次 Next 演进） */
  private _State: number;

  constructor(Seed: number) {
    // 种子归一化到 32 位无符号
    this._State = Seed >>> 0;
  }

  /**
   * mulberry32 PRNG 核心
   * 产出 [0, 1) 区间均匀分布的浮点数
   * 算法来源：公开领域，确定性、分布良好、实现简单
   */
  private Next(): number {
    // state 推进：加常数并掩码到 32 位
    this._State = (this._State + 0x6d2b79f5) | 0;
    let T: number = this._State;
    // 两轮 imul 混淆，提升高位低位熵分布
    T = Math.imul(T ^ (T >>> 15), T | 1);
    T ^= T + Math.imul(T ^ (T >>> 7), T | 61);
    // 最终归一化到 [0, 1)
    return ((T ^ (T >>> 14)) >>> 0) / 4294967296;
  }

  /** 掷一颗骰子 1..6 */
  NextDie(): DieFace {
    return (Math.floor(this.Next() * 6) + 1) as DieFace;
  }

  /** 闭区间 [Min, Max] 均匀随机整数（含两端） */
  NextInt(Min: number, Max: number): number {
    return Min + Math.floor(this.Next() * (Max - Min + 1));
  }
}
