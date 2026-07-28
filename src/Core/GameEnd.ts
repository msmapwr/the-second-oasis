/**
 * 终局判定 + 加赛模块
 * 关联规则：计划书 §3 胜负、Q1（公共归零即终局）、Q7（平局加赛）
 *
 * 设计要点：
 * 1. IsGameOver：公共 ≤0 即终局（实际永远 ≥0，clamp 后 =0 即终局）
 * 2. ComputeWinners：私有最高者获胜；并列则全部返回（>1 = 平手需加赛）
 * 3. RunTiebreakerRound（Q7）：仅平手者参与，每人掷双骰，点数高者胜，仍平手继续
 */
import type { IRandomSource } from '@/Utils/Random/IRandomSource';
import type { PlayerId, PlayerSnapshot } from '@/Types/Player';
import type { Winner, TiebreakerRound } from '@/Types/GameResult';

export class GameEnd {
  constructor(private readonly _Random: IRandomSource) {}

  /**
   * 判断是否终局（公共 = 0）
   * 关联：Q1 公共恰好归零 = 终局
   */
  static IsGameOver(PublicTerritory: number): boolean {
    return PublicTerritory <= 0;
  }

  /**
   * 计算胜者（私有最高者）
   * @param Players 所有玩家快照
   * @returns Winner 列表（长度 1 = 唯一胜者；>1 = 平手需加赛）
   *
   * 说明：荒地玩家私有=0，若有人私有>0 则自然不入选；
   * 若全员私有=0（全员荒地），则全员并列 0，触发加赛。
   */
  static ComputeWinners(Players: readonly PlayerSnapshot[]): Winner[] {
    if (Players.length === 0) return [];

    let MaxPrivate = -1;
    for (const P of Players) {
      if (P.PrivateTerritory > MaxPrivate) {
        MaxPrivate = P.PrivateTerritory;
      }
    }

    // 所有等于最高值的玩家都是胜者候选
    return Players.filter((P) => P.PrivateTerritory === MaxPrivate).map((P) => ({
      Id: P.Id,
      PrivateTerritory: P.PrivateTerritory,
    }));
  }

  /**
   * 执行一轮加赛（Q7：仅平手者，每人掷双骰，点数高者胜）
   * @param Participants 平手者 ID 列表
   * @returns 本轮加赛记录（含本轮最高者；若仍多个 = 仍平手，需继续）
   */
  /**
   * 判断是否仅剩一名活跃玩家（淘汰触发终局）
   * @returns true 表示仅剩 <= 1 名非淘汰且已发射的活跃玩家
   */
  static IsLastPlayerStanding(Players: readonly PlayerSnapshot[]): boolean {
    let ActiveCount = 0;
    for (const P of Players) {
      if (P.Status !== 'Eliminated' && P.IsLaunched) {
        ActiveCount += 1;
      }
    }
    return ActiveCount <= 1;
  }

  RunTiebreakerRound(Participants: readonly PlayerId[]): TiebreakerRound {
    const Rolls = Participants.map((Id) => {
      const D1 = this._Random.NextDie();
      const D2 = this._Random.NextDie();
      return { Id, Dice: [D1, D2] as readonly [typeof D1, typeof D2], Sum: D1 + D2 };
    });

    // 找最大 Sum
    let MaxSum = -1;
    for (const R of Rolls) {
      if (R.Sum > MaxSum) {
        MaxSum = R.Sum;
      }
    }

    // 本轮最高者（可能多个 = 仍平手）
    const WinnersThisRound = Rolls.filter((R) => R.Sum === MaxSum).map((R) => R.Id);
    const IsFinal = WinnersThisRound.length === 1;

    return {
      Participants,
      Rolls,
      WinnersThisRound,
      IsFinal,
    };
  }
}
