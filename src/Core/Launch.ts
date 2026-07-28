/**
 * 发射序章模块——首轮序章与开发过度后的重新发射
 * 关联规则：计划书 §12 发射回合
 *
 * 设计要点：
 * 1. 发射固定用双骰（Aggressive 双骰），但只看 Sum≥7，不触发倒扣（发射不涉及占领）
 * 2. 成功 +2 私有领土，失败下回合继续尝试
 * 3. 全员成功才进主循环（IsAllLaunched 静态判定）
 */
import { DiceRoller } from './DiceRoller';
import { DiceMode } from '@/Types/Dice';
import { LaunchStatus } from '@/Types/Launch';
import type { LaunchResult } from '@/Types/Launch';
import type { PlayerId, PlayerSnapshot } from '@/Types/Player';
import { LAUNCH_THRESHOLD, LAUNCH_REWARD } from './Constants';

export class Launch {
  constructor(private readonly _Dice: DiceRoller) {}

  /**
   * 玩家执行一次发射尝试
   * @param PlayerId 玩家 ID
   * @returns 发射结果（成功 +2 / 失败 0）
   */
  Attempt(PlayerId: PlayerId): LaunchResult {
    // 发射用 Aggressive 双骰，但只取 Sum 判定 ≥7，不关心倒扣/对子
    const Roll = this._Dice.Roll(DiceMode.Aggressive);
    const D1 = Roll.Dice[0];
    const D2 = Roll.Dice[1];
    const Sum = D1 + D2;

    const IsSuccess = Sum >= LAUNCH_THRESHOLD;
    return {
      PlayerId,
      Dice: [D1, D2],
      Sum,
      Status: IsSuccess ? LaunchStatus.Success : LaunchStatus.Failure,
      PrivateDelta: IsSuccess ? LAUNCH_REWARD : 0,
    };
  }

  /**
   * 判断是否全员发射成功（主循环开启条件）
   * @param Players 所有玩家快照
   * @returns 全员 IsLaunched=true 时返回 true
   */
  static IsAllLaunched(Players: readonly PlayerSnapshot[]): boolean {
    return Players.every((P) => P.IsLaunched);
  }
}
