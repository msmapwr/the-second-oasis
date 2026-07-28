/**
 * 随机源抽象接口
 * 关联规则：计划书 §13.2 状态与随机数
 *
 * 设计意图：Core 层不直接调用 Math.random，所有随机性经此接口。
 * 联机时服务器下发 Seed + 相同调用顺序 = 双方产生相同随机序列，
 * 保证权威结算一致（防作弊 & 双端同步）。
 *
 * 关键不变量：相同 Seed + 相同调用序列 → 完全相同输出。
 */
import type { DieFace } from '@/Types/Dice';

export interface IRandomSource {
  /**
   * 掷一颗骰子，返回 1..6
   * 用于所有骰子相关判定（占领/发射/抢夺/加赛）
   */
  NextDie(): DieFace;

  /**
   * 闭区间 [Min, Max] 内均匀随机整数（含两端）
   * 用于抢夺 r、崩坏随机损失量等
   * @param Min 下界（含）
   * @param Max 上界（含）
   */
  NextInt(Min: number, Max: number): number;
}
