/**
 * src/AI/Memory.test.ts
 * 操作类型：新建
 *
 * 记仇系统测试
 * 使用 vitest globals
 */
import { GrudgeRegistry, GRUDGE_SCORES } from './Memory';

describe('GrudgeRegistry', () => {
  it('应记录并查询敌意', () => {
    const Memory = new GrudgeRegistry();
    Memory.Record(
      { TargetId: 1, BaseScore: GRUDGE_SCORES.RobberyVictim, IncidentType: 'robbery' },
      5,
    );
    expect(Memory.GetGrudgeAgainst(1, 5)).toBeCloseTo(GRUDGE_SCORES.RobberyVictim);
    expect(Memory.GetGrudgeAgainst(2, 5)).toBe(0);
  });

  it('同目标同类型事件应累加分数', () => {
    const Memory = new GrudgeRegistry();
    Memory.Record(
      { TargetId: 1, BaseScore: GRUDGE_SCORES.RobberyVictim, IncidentType: 'robbery' },
      1,
    );
    Memory.Record(
      { TargetId: 1, BaseScore: GRUDGE_SCORES.RobberyVictim, IncidentType: 'robbery' },
      2,
    );
    const Score = Memory.GetGrudgeAgainst(1, 2);
    expect(Score).toBeGreaterThan(GRUDGE_SCORES.RobberyVictim);
  });

  it('不同类型事件应独立记录', () => {
    const Memory = new GrudgeRegistry();
    Memory.Record(
      { TargetId: 1, BaseScore: GRUDGE_SCORES.RobberyVictim, IncidentType: 'robbery' },
      1,
    );
    Memory.Record(
      { TargetId: 1, BaseScore: GRUDGE_SCORES.CollapseDamage, IncidentType: 'collapse' },
      1,
    );
    const Score = Memory.GetGrudgeAgainst(1, 1);
    expect(Score).toBeCloseTo(
      GRUDGE_SCORES.RobberyVictim + GRUDGE_SCORES.CollapseDamage,
    );
  });

  it('敌意应随回合衰减', () => {
    const Memory = new GrudgeRegistry();
    Memory.Record(
      { TargetId: 1, BaseScore: GRUDGE_SCORES.RobberyVictim, IncidentType: 'robbery' },
      1,
    );
    const Early = Memory.GetGrudgeAgainst(1, 1);
    const Later = Memory.GetGrudgeAgainst(1, 11);
    expect(Later).toBeLessThan(Early);
    expect(Later).toBeCloseTo(Early * Math.pow(0.95, 10));
  });

  it('Decay 应写回衰减并清理小分数记录', () => {
    const Memory = new GrudgeRegistry();
    Memory.Record(
      { TargetId: 1, BaseScore: 0.02, IncidentType: 'robbery' },
      1,
    );
    Memory.Decay(50);
    expect(Memory.Snapshot(50).length).toBe(0);
  });

  it('开发过度利好事件应降低敌意', () => {
    const Memory = new GrudgeRegistry();
    Memory.Record(
      { TargetId: 1, BaseScore: GRUDGE_SCORES.RobberyVictim, IncidentType: 'robbery' },
      1,
    );
    Memory.Record(
      { TargetId: 1, BaseScore: GRUDGE_SCORES.OverloadBenefit, IncidentType: 'overload-benefit' },
      1,
    );
    const Score = Memory.GetGrudgeAgainst(1, 1);
    expect(Score).toBeCloseTo(
      GRUDGE_SCORES.RobberyVictim + GRUDGE_SCORES.OverloadBenefit,
    );
  });
});
