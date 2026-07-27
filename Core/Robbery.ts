/**
 * 抢夺裁决模块——占领溢出时发起者与私有最高者的掷骰争夺
 * 关联规则：计划书 §10、Q1（阈值）、Q5（平手重掷）、冲突点 1/3/6
 *
 * 设计要点：
 * 1. 抢夺掷骰用单骰 1~6（冲突点 6：裁决性质，快速分胜负）
 * 2. 平手双方重掷直至分高低（Q5），全记录在 RollHistory
 * 3. 冲突点 3 方案 E 守恒：Transfer = min(m2, 低者私有)，r = min(r, Transfer)
 */
import type { IRandomSource } from '@/Utils/Random/IRandomSource';
import type { PlayerId, PlayerSnapshot } from '@/Types/Player';
import { RobberyRole } from '@/Types/Robbery';
import type { RobberyRollRecord, RobberyResult } from '@/Types/Robbery';

export class Robbery {
  constructor(private readonly _Random: IRandomSource) {}

  /**
   * 执行抢夺裁决
   * @param InitiatorId 发起者 p（占领溢出者）
   * @param Players 所有玩家快照（含发起者）
   * @param OverflowM2 溢出量 m2 = m − 公共原值（冲突点 1）
   * @returns 抢夺结果（含所有重掷记录）
   */
  Resolve(
    InitiatorId: PlayerId,
    Players: readonly PlayerSnapshot[],
    OverflowM2: number,
  ): RobberyResult {
    // 1. 选防守者：除发起者外私有最高者（并列选 ID 最小者，保证确定性）
    const DefenderId = this.SelectDefender(InitiatorId, Players);
    const DefenderSnapshot = Players[DefenderId];
    const InitiatorSnapshot = Players[InitiatorId];

    // 2. 掷骰循环（冲突点 6：单骰 1~6），平手重掷（Q5）
    const RollHistory = this.RollUntilDecided();

    // 确定胜方：最后一次（非平手）记录的较高方
    const LastRoll = RollHistory[RollHistory.length - 1];
    const InitiatorWon = LastRoll.InitiatorRoll > LastRoll.DefenderRoll;
    const Winner = InitiatorWon ? RobberyRole.Initiator : RobberyRole.Defender;

    // 3. 生成 r：随机回归公共量，0 < r ≤ m2（计划书 §10）
    // 但冲突点 3：r 受 Transfer 上限约束，避免负数
    const RawR = this._Random.NextInt(1, OverflowM2);

    // 4. 计算实际转移（冲突点 3 方案 E 守恒）
    // 低者 = 输家，高者 = 赢家
    const LoserPrivate = InitiatorWon
      ? DefenderSnapshot.PrivateTerritory
      : InitiatorSnapshot.PrivateTerritory;

    const Transfer = Math.min(OverflowM2, LoserPrivate);
    const R = Math.min(RawR, Transfer);

    // 低者 −Transfer（扣至 0），高者 +(Transfer − r)，公共 +r
    // 注意：用 `0 - Transfer` 避免 -0（负零）问题
    let InitiatorDelta: number;
    let DefenderDelta: number;

    if (InitiatorWon) {
      // 发起者赢：发起者 +（Transfer − r），防守者 −Transfer
      InitiatorDelta = Transfer - R;
      DefenderDelta = 0 - Transfer;
    } else {
      // 防守者赢：防守者 +（Transfer − r），发起者 −Transfer
      InitiatorDelta = 0 - Transfer;
      DefenderDelta = Transfer - R;
    }

    return {
      OverflowM2,
      Defender: DefenderId,
      RollHistory,
      Winner,
      RandomReturn: R,
      Transfer,
      InitiatorDelta,
      DefenderDelta,
      PublicDelta: R,
    };
  }

  /**
   * 选防守者：除发起者外私有最高者
   * 并列时选 ID 最小者（确定性，保证联机同步一致）
   */
  private SelectDefender(
    InitiatorId: PlayerId,
    Players: readonly PlayerSnapshot[],
  ): PlayerId {
    let BestId: PlayerId = -1;
    let BestPrivate = -1;

    for (const P of Players) {
      if (P.Id === InitiatorId) continue;
      // 严格大于才更新，保证并列时保留 ID 较小者
      if (P.PrivateTerritory > BestPrivate) {
        BestPrivate = P.PrivateTerritory;
        BestId = P.Id;
      }
    }

    // 理论上不会发生（至少有 1 名非发起者玩家）
    if (BestId < 0) {
      throw new Error('抢夺异常：无有效防守者');
    }
    return BestId;
  }

  /**
   * 掷骰循环：双方各掷单骰，平手则重掷，直至分出高低（Q5）
   * 全部记录在 RollHistory，含平手的中间轮次
   */
  private RollUntilDecided(): RobberyRollRecord[] {
    const History: RobberyRollRecord[] = [];

    // 安全上限：理论上单骰 6 面平手概率 1/6，期望 1.2 次分胜负
    // 设 1000 次硬上限防御异常（正常永远不会触及）
    const MaxRounds = 1000;

    for (let I = 0; I < MaxRounds; I++) {
      const InitiatorRoll = this._Random.NextDie();
      const DefenderRoll = this._Random.NextDie();
      const IsTie = InitiatorRoll === DefenderRoll;

      History.push({ InitiatorRoll, DefenderRoll, IsTie });

      if (!IsTie) {
        return History;
      }
      // 平手则继续重掷
    }

    // 极端情况：1000 次全平手（概率约 1e-778，实际不可能）
    // 返回最后一次记录，按发起者赢处理（避免无限循环）
    return History;
  }
}
