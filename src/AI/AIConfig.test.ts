/**
 * src/AI/AIConfig.test.ts
 * 操作类型：新建
 *
 * AI 配置工厂测试
 * 使用 vitest globals（项目 globals:true，import from 'vitest' 在当前 ESM 环境会导致套件丢失）
 */
import {
  AIDifficulty,
  CreateAIGameConfig,
  GetAIPlayerConfig,
  IsAIPlayer,
} from './AIConfig';

describe('CreateAIGameConfig', () => {
  it('应把原始配置转换为完整 AI 配置', () => {
    const Config = CreateAIGameConfig(2, 42, [
      { Name: '人类', Color: '#ff0000' },
      { Name: 'AI', Color: '#00ff00', IsAI: true, Difficulty: AIDifficulty.Master },
    ]);

    expect(Config.PlayerCount).toBe(2);
    expect(Config.Seed).toBe(42);
    expect(Config.Players[0].IsAI).toBe(false);
    expect(Config.Players[1].IsAI).toBe(true);
    expect(Config.Players[1].Difficulty).toBe(AIDifficulty.Master);
  });

  it('缺省字段应补为默认值', () => {
    const Config = CreateAIGameConfig(2, 42, [
      { Name: 'P1', Color: '#000000' },
      { Name: 'P2', Color: '#ffffff' },
    ]);

    expect(Config.Players[0].IsAI).toBe(false);
    expect(Config.Players[0].Difficulty).toBe(AIDifficulty.Rookie);
    expect(Config.Players[0].Personality.Aggressiveness).toBe(0.5);
  });

  it('玩家数不足时应补默认配置', () => {
    const Config = CreateAIGameConfig(3, 42, [{ Name: 'P1', Color: '#000' }]);
    expect(Config.Players.length).toBe(3);
    expect(Config.Players[2].Name).toBe('玩家3');
  });
});

describe('IsAIPlayer / GetAIPlayerConfig', () => {
  const Config = CreateAIGameConfig(2, 42, [
    { Name: '人类', Color: '#000' },
    { Name: 'AI', Color: '#fff', IsAI: true, Difficulty: AIDifficulty.Elite },
  ]);

  it('应正确判断 AI 席位', () => {
    expect(IsAIPlayer(Config, 0)).toBe(false);
    expect(IsAIPlayer(Config, 1)).toBe(true);
  });

  it('应正确获取 AI 配置', () => {
    expect(GetAIPlayerConfig(Config, 0)).toBeNull();
    expect(GetAIPlayerConfig(Config, 1)?.Difficulty).toBe(AIDifficulty.Elite);
  });
});
