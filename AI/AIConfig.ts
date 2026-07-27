/**
 * src/AI/AIConfig.ts
 * 操作类型：新建
 *
 * AI 对手配置类型与工厂
 * 关联：D 优先级 AI 对手模块 §Phase 1
 *
 * 设计要点：
 * 1. AI 层不依赖 UI/Store，AIPlayerConfig 自持 Name/Color，避免循环引用
 * 2. 难度与性格为纯数据，便于序列化和测试
 * 3. 提供从主菜单 PlayerConfig 到 AI 配置的映射工厂
 */
import type { PlayerId } from '@/Types/Player';
import { AIDifficulty } from '@/Types/AI';
import type { AIPersonality } from '@/Types/AI';

export { AIDifficulty } from '@/Types/AI';
export type { AIPersonality } from '@/Types/AI';

/**
 * 单个 AI 玩家的配置
 * 自持 Name/Color，不依赖 Store/PlayerPalette 中的类型，保证 AI 层可独立测试
 */
export interface AIPlayerConfig {
  readonly Id: PlayerId;
  readonly Name: string;
  readonly Color: string;
  readonly IsAI: boolean;
  readonly Difficulty: AIDifficulty;
  readonly Personality: AIPersonality;
}

/**
 * 一局游戏的 AI 配置
 */
export interface AIGameConfig {
  readonly PlayerCount: 2 | 3 | 4;
  readonly Seed: number;
  readonly Players: AIPlayerConfig[];
}

/**
 * 从主菜单传下来的原始乘员配置（含可选 AI 字段）映射为 AI 层配置
 * 主菜单中的 PlayerConfig 已携带 IsAI / Difficulty / Personality 可选字段
 */
export interface RawPlayerConfig {
  readonly Name: string;
  readonly Color: string;
  readonly IsAI?: boolean;
  readonly Difficulty?: AIDifficulty;
  readonly Personality?: AIPersonality;
}

/**
 * 将原始玩家配置列表转换为 AI 层所需的完整配置
 * 未指定 AI 相关字段时默认：人类 + Rookie + 平衡性格
 */
export function CreateAIGameConfig(
  PlayerCount: 2 | 3 | 4,
  Seed: number,
  Players: readonly RawPlayerConfig[],
): AIGameConfig {
  const Trimmed = Players.slice(0, PlayerCount);
  const Filled: AIPlayerConfig[] = [];
  for (let I = 0; I < PlayerCount; I++) {
    const Raw = Trimmed[I] ?? { Name: `玩家${I + 1}`, Color: '#ffffff' };
    Filled.push({
      Id: I as PlayerId,
      Name: Raw.Name || `玩家${I + 1}`,
      Color: Raw.Color || '#ffffff',
      IsAI: Raw.IsAI ?? false,
      Difficulty: Raw.Difficulty ?? AIDifficulty.Rookie,
      Personality: Raw.Personality ?? {
        Aggressiveness: 0.5,
        RiskTolerance: 0.5,
        Vengefulness: 0.5,
        Patience: 0.5,
      },
    });
  }
  return { PlayerCount, Seed, Players: Filled };
}

/**
 * 判断某席位是否为 AI
 */
export function IsAIPlayer(Config: AIGameConfig, PlayerId: PlayerId): boolean {
  return Config.Players[PlayerId]?.IsAI ?? false;
}

/**
 * 获取某席位的 AI 配置，非 AI 时返回 null
 */
export function GetAIPlayerConfig(
  Config: AIGameConfig,
  PlayerId: PlayerId,
): AIPlayerConfig | null {
  const P = Config.Players[PlayerId];
  return P && P.IsAI ? P : null;
}
