/**
 * src/Core/DiceRoller.ts
 * 操作类型：修改
 *
 * 掷骰模块——处理稳健/激进/不开发/复仇四种模式与倒扣逻辑
 * 关联规则：计划书 §7 掷骰机制、§8 模式选择、冲突点 2（小对子倒扣）
 */
import type { IRandomSource } from '@/Utils/Random/IRandomSource';
import { DiceMode } from '@/Types/Dice';
import type { DiceRollResult, RevengeRollResult, DieFace } from '@/Types/Dice';
import { InvalidDiceModeError } from './Errors';

export class DiceRoller {
  constructor(private readonly _Random: IRandomSource) {}

  Roll(Mode: DiceMode): DiceRollResult {
    switch (Mode) {
      case DiceMode.Steady:
        return this.RollSteady();
      case DiceMode.Aggressive:
        return this.RollAggressive();
      case DiceMode.None:
        return this.RollNone();
      case DiceMode.Revenge:
        return this.RollRevenge();
      default:
        throw new InvalidDiceModeError(`未知的掷骰模式: ${String(Mode)}`);
    }
  }

  RollRevengeResult(
    SuccessThreshold: number,
    StealFormula: (Die: DieFace) => number,
    FailureCost: number,
  ): RevengeRollResult {
    const Die = this._Random.NextDie();
    const IsSuccess = Die >= SuccessThreshold;
    const StealAmount = IsSuccess ? Math.max(0, StealFormula(Die)) : 0;
    const SelfLoss = IsSuccess ? 0 : FailureCost;
    return { Die, IsSuccess, StealAmount, SelfLoss };
  }

  private RollSteady(): DiceRollResult {
    const Die = this._Random.NextDie();
    return {
      Mode: DiceMode.Steady,
      Dice: [Die],
      Sum: Die,
      IsDouble: false,
      IsDeducted: false,
      RawGain: Die,
    };
  }

  private RollAggressive(): DiceRollResult {
    const D1: DieFace = this._Random.NextDie();
    const D2: DieFace = this._Random.NextDie();
    const Sum = D1 + D2;
    const IsDouble = D1 === D2;
    const IsDeducted = Sum <= 6;
    const RawGain = IsDeducted ? -Sum : Sum;

    return {
      Mode: DiceMode.Aggressive,
      Dice: [D1, D2],
      Sum,
      IsDouble,
      IsDeducted,
      RawGain,
    };
  }

  private RollNone(): DiceRollResult {
    return {
      Mode: DiceMode.None,
      Dice: [],
      Sum: 0,
      IsDouble: false,
      IsDeducted: false,
      RawGain: 0,
    };
  }

  private RollRevenge(): DiceRollResult {
    const Die = this._Random.NextDie();
    return {
      Mode: DiceMode.Revenge,
      Dice: [Die],
      Sum: Die,
      IsDouble: false,
      IsDeducted: false,
      RawGain: 0,
    };
  }
}
