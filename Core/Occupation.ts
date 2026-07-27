/**
 * src/Core/Occupation.ts
 * 操作类型：修改
 *
 * 占领结算模块——纯计算，不含抢夺/崩坏
 * 关联规则：计划书 §7.2 占领机制、Q4（翻倍基数）、冲突点 1（m2基数）、冲突点 2（倒扣倍率）
 */
import { DevMultiplier } from '@/Types/DevChain';

/**
 * 占领结算输出（不可变）
 */
export interface OccupationOutcome {
  /** 实际占领量 M = RawGain × Multiplier（可为负=倒扣） */
  readonly M: number;
  /** 占领后公共领土（≥0） */
  readonly PublicAfter: number;
  /** 私有领土变化量（正=增加，负=减少/倒扣） */
  readonly PrivateDelta: number;
  /** 是否溢出（M > PublicBefore，触发抢夺/崩坏） */
  readonly IsOverflow: boolean;
  /** 溢出量 m2 = M − PublicBefore（仅 IsOverflow 时有意义，≥1） */
  readonly OverflowM2: number;
  /** 公共领土变化量（正=倒扣回流，负=被占领） */
  readonly PublicDelta: number;
  /** 本回合生效的枯竭冲刺奖励（仅用于显示） */
  readonly SprintBonus: number;
}

export class Occupation {
  Calculate(
    PublicBefore: number,
    PrivateBefore: number,
    RawGain: number,
    Multiplier: DevMultiplier,
    SprintBonus: number = 0,
  ): OccupationOutcome {
    const AdjustedRawGain = RawGain > 0 ? RawGain + SprintBonus : RawGain;
    const M = AdjustedRawGain * Multiplier;

    if (M <= 0) {
      return { ...this.CalculateDeduction(PublicBefore, PrivateBefore, M), SprintBonus };
    }
    return { ...this.CalculateClaim(PublicBefore, M), SprintBonus };
  }

  private CalculateDeduction(
    PublicBefore: number,
    PrivateBefore: number,
    M: number,
  ): Omit<OccupationOutcome, 'SprintBonus'> {
    const DeductionAmount = Math.min(-M, PrivateBefore);

    return {
      M,
      PublicAfter: PublicBefore + DeductionAmount,
      PrivateDelta: 0 - DeductionAmount,
      IsOverflow: false,
      OverflowM2: 0,
      PublicDelta: DeductionAmount,
    };
  }

  private CalculateClaim(
    PublicBefore: number,
    M: number,
  ): Omit<OccupationOutcome, 'SprintBonus'> {
    if (M <= PublicBefore) {
      return {
        M,
        PublicAfter: PublicBefore - M,
        PrivateDelta: M,
        IsOverflow: false,
        OverflowM2: 0,
        PublicDelta: -M,
      };
    }

    const OverflowM2 = M - PublicBefore;
    return {
      M,
      PublicAfter: 0,
      PrivateDelta: PublicBefore,
      IsOverflow: true,
      OverflowM2,
      PublicDelta: -PublicBefore,
    };
  }
}
