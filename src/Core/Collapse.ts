/**
 * 崩坏结算模块——第二次抢夺触发时的全局惩罚
 * 关联规则：计划书 §11、Q6（随机分配）、冲突点 4（私有不足）、冲突点 5（公共clamp）
 *
 * 设计要点：
 * 1. Q6：每位非发起者独立随机损失 [0, floor((x·m2)/4)]，发起者承担剩余 = (x·m2) − 其他人之和
 * 2. 冲突点 4：非发起者私有不足时 clamp，缺口累加发起者；发起者也不足则 IsConserved=false
 * 3. 冲突点 5：公共 −x，clamp 至 0，=0 触发终局
 * 4. 系数 x 初值 2，每次崩坏 +1，跨回合持久
 * 5. 非发起者按 PlayerId 升序处理，保证联机随机序列一致
 */
import type { IRandomSource } from '@/Utils/Random/IRandomSource';
import type { PlayerId, PlayerSnapshot } from '@/Types/Player';
import type { CollapsePlayerLoss, CollapseResult } from '@/Types/Collapse';
import { COLLAPSE_INITIAL_X } from './Constants';

export class Collapse {
  /** 崩坏系数 x，初值 2，每次崩坏 +1 */
  private _X: number;

  constructor(
    private readonly _Random: IRandomSource,
    InitialX: number = COLLAPSE_INITIAL_X,
  ) {
    this._X = InitialX;
  }

  /** 当前系数 x（只读） */
  get X(): number {
    return this._X;
  }

  /**
   * 执行崩坏结算
   * @param InitiatorId 发起者 p（本回合占领溢出者）
   * @param Players 所有玩家快照
   * @param OverflowM2 本次溢出量 m2
   * @param PublicBefore 崩坏前公共领土
   * @returns 崩坏结果（含每玩家损失、公共变化、新 x）
   */
  Resolve(
    InitiatorId: PlayerId,
    Players: readonly PlayerSnapshot[],
    OverflowM2: number,
    PublicBefore: number,
  ): CollapseResult {
    const CurrentX = this._X;
    const TotalTarget = CurrentX * OverflowM2; // 守恒目标
    const PerCap = Math.floor(TotalTarget / 4); // 每位非发起者随机上限

    // 1. 处理非发起者：按 PlayerId 升序，保证联机随机序列一致
    const Losses: CollapsePlayerLoss[] = [];
    let OthersSum = 0;

    for (const P of Players) {
      if (P.Id === InitiatorId) continue;

      const RandomLoss = this._Random.NextInt(0, PerCap);
      const ActualLoss = Math.min(RandomLoss, P.PrivateTerritory);
      const AfterPrivate = P.PrivateTerritory - ActualLoss;

      Losses.push({
        Id: P.Id,
        RandomLoss,
        ActualLoss,
        BeforePrivate: P.PrivateTerritory,
        AfterPrivate,
      });
      OthersSum += ActualLoss;
    }

    // 2. 发起者承担剩余（Q6）
    const InitiatorSnapshot = Players[InitiatorId];
    const InitiatorRandomLoss = TotalTarget - OthersSum;
    const InitiatorActualLoss = Math.min(
      InitiatorRandomLoss,
      InitiatorSnapshot.PrivateTerritory,
    );
    const InitiatorAfterPrivate =
      InitiatorSnapshot.PrivateTerritory - InitiatorActualLoss;

    // 发起者记录插入到列表头部（便于 UI 展示"罪魁祸首"）
    Losses.unshift({
      Id: InitiatorId,
      RandomLoss: InitiatorRandomLoss,
      ActualLoss: InitiatorActualLoss,
      BeforePrivate: InitiatorSnapshot.PrivateTerritory,
      AfterPrivate: InitiatorAfterPrivate,
    });

    // 3. 汇总
    const TotalLoss = OthersSum + InitiatorActualLoss;
    const IsConserved = TotalLoss === TotalTarget;

    // 4. 公共 −x，clamp 至 0（冲突点 5）
    const PublicDelta = -Math.min(CurrentX, PublicBefore);

    // 5. 系数自增
    const NextX = CurrentX + 1;
    this._X = NextX;

    return {
      CoefficientX: CurrentX,
      TotalLoss,
      IsConserved,
      PlayerLosses: Losses,
      InitiatorId,
      PublicDelta,
      NextX,
    };
  }
}
