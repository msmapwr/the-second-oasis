/**
 * src/AI/Personality.ts
 * 操作类型：新建
 *
 * AI 性格维度与生成器
 * 关联：D 优先级 AI 对手模块 §Phase 1
 *
 * 设计要点：
 * 1. 四维均在 [0,1] 区间，便于线性加权
 * 2. 在难度允许的 PersonalityVariance 内随机生成，保证同难度不同 AI 有差异
 * 3. 提供命名 archetype，UI 可直接展示“赌徒/保守者/复仇者/平衡者”
 */
import type { AIPersonality, PersonalityArchetype } from '@/Types/AI';
import { AIDifficulty } from '@/Types/AI';
import { GetDifficultyProfile } from './Difficulty';
import type { IRandomSource } from '@/Utils/Random/IRandomSource';
import { DefaultRandom } from '@/Utils/Random/DefaultRandom';

/**
 * 原型基础四维值
 */
const ARCHETYPE_BASE: Record<PersonalityArchetype, AIPersonality> = {
  Balanced: {
    Aggressiveness: 0.5,
    RiskTolerance: 0.5,
    Vengefulness: 0.5,
    Patience: 0.5,
  },
  Conservative: {
    Aggressiveness: 0.2,
    RiskTolerance: 0.2,
    Vengefulness: 0.3,
    Patience: 0.7,
  },
  Gambler: {
    Aggressiveness: 0.8,
    RiskTolerance: 0.8,
    Vengefulness: 0.2,
    Patience: 0.3,
  },
  Avenger: {
    Aggressiveness: 0.6,
    RiskTolerance: 0.5,
    Vengefulness: 0.9,
    Patience: 0.4,
  },
  Random: {
    Aggressiveness: 0.5,
    RiskTolerance: 0.5,
    Vengefulness: 0.5,
    Patience: 0.5,
  },
};

/**
 *  Clamp 到 [0,1]
 */
function Clamp01(V: number): number {
  if (V < 0) return 0;
  if (V > 1) return 1;
  return V;
}

/**
 * 在基础值上加入随机偏移，偏移幅度由难度决定
 * 使用高斯近似：sum of 3 uniform - 1.5，再缩放 variance
 * IRandomSource 只提供整数接口，这里用 NextInt(0, 1000)/1000 近似连续均匀
 */
function AddVariance(
  Base: number,
  Variance: number,
  Random: IRandomSource,
): number {
  const Uniform01 = () => Random.NextInt(0, 1000) / 1000;
  // 三段均匀分布近似正态，均值为 0
  const GaussianLike = Uniform01() + Uniform01() + Uniform01() - 1.5;
  return Clamp01(Base + GaussianLike * Variance);
}

/**
 * 生成一个性格
 * @param Difficulty 难度（决定随机偏移幅度）
 * @param Archetype 原型，默认 Random（完全在 variance 内随机）
 * @param Random 随机源，默认新建 DefaultRandom
 */
export function CreatePersonality(
  Difficulty: AIDifficulty,
  Archetype: PersonalityArchetype = 'Random',
  Random?: IRandomSource,
): AIPersonality {
  const R = Random ?? new DefaultRandom();
  const Variance = GetDifficultyProfile(Difficulty).PersonalityVariance;
  const Base = ARCHETYPE_BASE[Archetype];

  if (Archetype === 'Random') {
    return {
      Aggressiveness: AddVariance(0.5, Variance, R),
      RiskTolerance: AddVariance(0.5, Variance, R),
      Vengefulness: AddVariance(0.5, Variance, R),
      Patience: AddVariance(0.5, Variance, R),
    };
  }

  return {
    Aggressiveness: AddVariance(Base.Aggressiveness, Variance, R),
    RiskTolerance: AddVariance(Base.RiskTolerance, Variance, R),
    Vengefulness: AddVariance(Base.Vengefulness, Variance, R),
    Patience: AddVariance(Base.Patience, Variance, R),
  };
}

/**
 * 根据四维值反推最接近的原型标签（用于 UI 展示）
 */
export function GetArchetypeLabel(Personality: AIPersonality): PersonalityArchetype {
  let Best: PersonalityArchetype = 'Balanced';
  let BestDistance = Number.POSITIVE_INFINITY;

  const Archetypes: PersonalityArchetype[] = [
    'Balanced',
    'Conservative',
    'Gambler',
    'Avenger',
  ];

  for (const Key of Archetypes) {
    const Base = ARCHETYPE_BASE[Key];
    const Distance =
      Math.abs(Personality.Aggressiveness - Base.Aggressiveness) +
      Math.abs(Personality.RiskTolerance - Base.RiskTolerance) +
      Math.abs(Personality.Vengefulness - Base.Vengefulness) +
      Math.abs(Personality.Patience - Base.Patience);
    if (Distance < BestDistance) {
      BestDistance = Distance;
      Best = Key;
    }
  }

  return Best;
}

/**
 * 原型中文标签
 */
export function GetArchetypeDisplayName(Archetype: PersonalityArchetype): string {
  const Names: Record<PersonalityArchetype, string> = {
    Balanced: '平衡者',
    Conservative: '保守者',
    Gambler: '赌徒',
    Avenger: '复仇者',
    Random: '随机',
  };
  return Names[Archetype];
}

/**
 * 所有可选原型列表（UI 下拉框用）
 */
export function GetAllArchetypes(): PersonalityArchetype[] {
  return ['Balanced', 'Conservative', 'Gambler', 'Avenger', 'Random'];
}
