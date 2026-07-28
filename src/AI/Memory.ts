/**
 * src/AI/Memory.ts
 * 操作类型：新建
 *
 * AI 跨回合记仇系统（Grudge System）
 * 关联：D 优先级 AI 对手模块 §Phase 2
 *
 * 设计要点：
 * 1. 只记录“敌意分数”，不记录完整历史，内存开销小
 * 2. 衰减公式：Score *= 0.95 ^ (当前回合 - 最后事件回合)
 * 3. GetGrudgeAgainst 只读，Decay 显式调用，避免查询时产生副作用
 * 4. 事件类型：被抢夺、被崩坏牵连、对方开发过度（喜闻乐见，敌意下降）
 */
import type { PlayerId } from '@/Types/Player';

/**
 * 敌意事件类型
 */
export type GrudgeIncidentType = 'robbery' | 'collapse' | 'overload-benefit';

/**
 * 单条敌意记录
 */
export interface GrudgeRecord {
  readonly TargetId: PlayerId;
  /** 敌意分数，正数表示敌意 */
  Score: number;
  /** 最后事件发生时的回合数 */
  LastIncidentTurn: number;
  /** 事件类型 */
  IncidentType: GrudgeIncidentType;
}

/**
 * 输入 AI 记忆的事件
 */
export interface GrudgeEvent {
  readonly TargetId: PlayerId;
  /** 基础分数（正值为敌意，负值为好感） */
  readonly BaseScore: number;
  readonly IncidentType: GrudgeIncidentType;
}

/**
 * 每回合衰减系数
 */
const DECAY_BASE = 0.95;

/**
 * 敌意登记簿
 */
export class GrudgeRegistry {
  private readonly _Records: GrudgeRecord[] = [];

  /**
   * 记录一起事件
   * 若同一目标已有同类型记录，则累加分数并更新回合
   * 否则新增记录
   */
  Record(Event: GrudgeEvent, CurrentTurn: number): void {
    const Existing = this._Records.find(
      (R) => R.TargetId === Event.TargetId && R.IncidentType === Event.IncidentType,
    );
    if (Existing) {
      Existing.Score = this._ApplyDecay(Existing.Score, CurrentTurn - Existing.LastIncidentTurn);
      Existing.Score += Event.BaseScore;
      Existing.LastIncidentTurn = CurrentTurn;
    } else {
      this._Records.push({
        TargetId: Event.TargetId,
        Score: Event.BaseScore,
        LastIncidentTurn: CurrentTurn,
        IncidentType: Event.IncidentType,
      });
    }
  }

  /**
   * 查询对某目标的当前敌意（按需衰减，不写回）
   */
  GetGrudgeAgainst(TargetId: PlayerId, CurrentTurn: number): number {
    let Total = 0;
    for (const Record of this._Records) {
      if (Record.TargetId === TargetId) {
        Total += this._ApplyDecay(Record.Score, CurrentTurn - Record.LastIncidentTurn);
      }
    }
    return Total;
  }

  /**
   * 对所有记录应用衰减并写回
   * AIDirector 每回合调用一次
   */
  Decay(CurrentTurn: number): void {
    for (const Record of this._Records) {
      Record.Score = this._ApplyDecay(Record.Score, CurrentTurn - Record.LastIncidentTurn);
      Record.LastIncidentTurn = CurrentTurn;
    }
    // 移除可忽略的敌意（避免数组无限增长）
    for (let I = this._Records.length - 1; I >= 0; I--) {
      if (Math.abs(this._Records[I].Score) < 0.01) {
        this._Records.splice(I, 1);
      }
    }
  }

  /**
   * 获取快照（用于透明日志展示）
   */
  Snapshot(CurrentTurn: number): GrudgeRecord[] {
    return this._Records.map((R) => ({
      TargetId: R.TargetId,
      Score: this._ApplyDecay(R.Score, CurrentTurn - R.LastIncidentTurn),
      LastIncidentTurn: R.LastIncidentTurn,
      IncidentType: R.IncidentType,
    }));
  }

  /**
   * 清空记忆（新局开始时）
   */
  Clear(): void {
    this._Records.length = 0;
  }

  /**
   * 内部：应用衰减公式
   */
  private _ApplyDecay(Score: number, TurnsPassed: number): number {
    if (TurnsPassed <= 0) return Score;
    return Score * Math.pow(DECAY_BASE, TurnsPassed);
  }
}

/**
 * 预置分数参考值（事件强度）
 */
export const GRUDGE_SCORES = {
  /** 自己被抢夺：高敌意 */
  RobberyVictim: 3.0,
  /** 崩坏中受损：按损失比例缩放后使用 */
  CollapseDamage: 1.0,
  /** 对方开发过度（私有清零）：轻微幸灾乐祸，降低敌意 */
  OverloadBenefit: -0.5,
} as const;
