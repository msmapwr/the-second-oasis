/**
 * src/Types/GameConfig.ts
 * 操作类型：修改
 *
 * 游戏配置类型定义
 * 关联规则：计划书 §5 核心数值表 + v1.2 变体包开关
 */

/**
 * 游戏配置（构造 GameState 时传入，不可变）
 * 所有阈值常量集中于此，便于调参与蒙特卡洛模拟
 */
export interface GameConfig {
  /** 玩家数 2~4 */
  readonly PlayerCount: 2 | 3 | 4;
  /** 随机种子（联机时服务器下发，保证双方随机序列一致） */
  readonly Seed: number;
  /** 公共领土初值，默认 100 */
  readonly InitialPublic: number;
  /** 私有领土初值，默认 0 */
  readonly InitialPrivate: number;
  /** 抢夺阈值 m，默认 0（Q1：占领使公共<0 触发） */
  readonly RobberyThreshold: number;
  /** 发射成功阈值，默认 7（双骰和 ≥7） */
  readonly LaunchThreshold: number;
  /** 发射成功奖励，默认 +2 私有领土 */
  readonly LaunchReward: number;
  /** 崩坏系数初值，默认 2，每次崩坏 +1 */
  readonly CollapseInitialX: number;
  /** 最大玩家数，默认 4 */
  readonly MaxPlayers: number;

  /** v1.2 开关：公敌税 */
  readonly EnableLeaderTax: boolean;
  /** v1.2 参数：公敌税基础值 */
  readonly LeaderTaxBase: number;
  /** v1.2 开关：顺位轮换 */
  readonly EnableRotatingStart: boolean;
  /** v1.2 开关：枯竭冲刺 */
  readonly EnableScarcitySprint: boolean;
  /** v1.2 参数：枯竭冲刺阈值 */
  readonly SprintThreshold: number;
  /** v1.2 参数：枯竭冲刺奖励 */
  readonly SprintBonus: number;
  /** v1.2 开关：复仇突袭 */
  readonly EnableRevengeRaid: boolean;
  /** v1.2 参数：复仇成功阈值 */
  readonly RevengeSuccessThreshold: number;
  /** v1.2 参数：复仇失败成本 */
  readonly RevengeFailureCost: number;

  /** v1.3 开关：技能卡罗牌 */
  readonly EnableSkillCards: boolean;
}

/**
 * 默认配置工厂（v1.1 兼容）
 */
export function CreateDefaultConfig(PlayerCount: 2 | 3 | 4, Seed: number): GameConfig {
  return {
    PlayerCount,
    Seed,
    InitialPublic: 100,
    InitialPrivate: 0,
    RobberyThreshold: 0,
    LaunchThreshold: 7,
    LaunchReward: 2,
    CollapseInitialX: 2,
    MaxPlayers: 4,
    EnableLeaderTax: false,
    LeaderTaxBase: 0,
    EnableRotatingStart: false,
    EnableScarcitySprint: false,
    SprintThreshold: 0,
    SprintBonus: 0,
    EnableRevengeRaid: false,
    RevengeSuccessThreshold: 4,
    RevengeFailureCost: 1,
    EnableSkillCards: false,
  };
}

/**
 * v1.2 标准变体配置工厂
 */
export function CreateVariantConfig(PlayerCount: 2 | 3 | 4, Seed: number): GameConfig {
  return {
    ...CreateDefaultConfig(PlayerCount, Seed),
    EnableLeaderTax: true,
    LeaderTaxBase: 1,
    EnableRotatingStart: true,
    EnableScarcitySprint: true,
    SprintThreshold: 30,
    SprintBonus: 2,
    EnableSkillCards: true,
  };
}
