/**
 * src/AI/Personality.test.ts
 * 操作类型：新建
 *
 * AI 性格生成器测试
 * 使用 vitest globals
 */
import { AIDifficulty } from '@/Types/AI';
import {
  CreatePersonality,
  GetArchetypeLabel,
  GetArchetypeDisplayName,
  GetAllArchetypes,
} from './Personality';
import { SeededRandom } from '@/Utils/Random/SeededRandom';

describe('CreatePersonality', () => {
  it('生成的四维值应在 [0,1] 内', () => {
    const R = new SeededRandom(123);
    const P = CreatePersonality(AIDifficulty.Rookie, 'Random', R);
    expect(P.Aggressiveness).toBeGreaterThanOrEqual(0);
    expect(P.Aggressiveness).toBeLessThanOrEqual(1);
    expect(P.RiskTolerance).toBeGreaterThanOrEqual(0);
    expect(P.RiskTolerance).toBeLessThanOrEqual(1);
    expect(P.Vengefulness).toBeGreaterThanOrEqual(0);
    expect(P.Vengefulness).toBeLessThanOrEqual(1);
    expect(P.Patience).toBeGreaterThanOrEqual(0);
    expect(P.Patience).toBeLessThanOrEqual(1);
  });

  it('保守者原型应具有低侵略性和高风险厌恶', () => {
    const R = new SeededRandom(1);
    const P = CreatePersonality(AIDifficulty.Master, 'Conservative', R);
    expect(P.Aggressiveness).toBeLessThan(0.5);
    expect(P.RiskTolerance).toBeLessThan(0.5);
  });

  it('赌徒原型应具有高侵略性和高风险容忍', () => {
    const R = new SeededRandom(2);
    const P = CreatePersonality(AIDifficulty.Master, 'Gambler', R);
    expect(P.Aggressiveness).toBeGreaterThan(0.5);
    expect(P.RiskTolerance).toBeGreaterThan(0.5);
  });

  it('复仇者原型应具有高报复心', () => {
    const R = new SeededRandom(3);
    const P = CreatePersonality(AIDifficulty.Master, 'Avenger', R);
    expect(P.Vengefulness).toBeGreaterThan(0.5);
  });
});

describe('GetArchetypeLabel', () => {
  it('应识别保守者', () => {
    const Label = GetArchetypeLabel({
      Aggressiveness: 0.1,
      RiskTolerance: 0.1,
      Vengefulness: 0.3,
      Patience: 0.7,
    });
    expect(Label).toBe('Conservative');
  });

  it('应识别赌徒', () => {
    const Label = GetArchetypeLabel({
      Aggressiveness: 0.8,
      RiskTolerance: 0.8,
      Vengefulness: 0.2,
      Patience: 0.3,
    });
    expect(Label).toBe('Gambler');
  });
});

describe('GetArchetypeDisplayName / GetAllArchetypes', () => {
  it('应返回中文名', () => {
    expect(GetArchetypeDisplayName('Avenger')).toBe('复仇者');
  });

  it('应包含所有原型', () => {
    const Archetypes = GetAllArchetypes();
    expect(Archetypes).toContain('Balanced');
    expect(Archetypes).toContain('Random');
  });
});
