/**
 * src/Types/Card.ts
 * 操作类型：新建
 *
 * 技能卡罗牌系统 · 类型定义
 * 关联：计划书 v1.3 技能卡罗牌扩展、TarotCards.xml
 */

import type { PlayerId } from './Player';

/** 卡牌类型——决定使用时机和方式 */
export enum CardType {
  Command = 'Command',
  Counter = 'Counter',
  Constant = 'Constant',
}

/** 卡牌花色——塔罗牌体系 */
export enum CardSuit {
  Major = 'Major',
  Swords = 'Swords',
  Wands = 'Wands',
  Cups = 'Cups',
  Pentacles = 'Pentacles',
}

/** 卡牌稀有度 */
export enum CardRarity {
  Legendary = 'Legendary',
  Rare = 'Rare',
  Uncommon = 'Uncommon',
  Common = 'Common',
}

/** 卡牌效果目标 */
export enum CardTarget {
  Self = 'Self',
  SingleEnemy = 'SingleEnemy',
  AllPlayers = 'AllPlayers',
  AllActivePlayers = 'AllActivePlayers',
  AllPoor = 'AllPoor',
  RichestOther = 'RichestOther',
  AnyPlayer = 'AnyPlayer',
  CardOnStack = 'CardOnStack',
  RobberyInitiator = 'RobberyInitiator',
  RobberyBothSides = 'RobberyBothSides',
  OccupyingPlayer = 'OccupyingPlayer',
  OverflowSource = 'OverflowSource',
  Choice = 'Choice',
}

/** 手牌数量上限 */
export const HAND_LIMIT = 3;

/**
 * 卡牌定义——静态数据，每张牌在游戏中只有一份定义
 * 对应 TarotCards.xml 中每张 <Card> 节点的数据
 */
export interface CardDefinition {
  /** 唯一标识，如 "major_00"、"minor_swords_ace" */
  readonly Id: string;
  /** 塔罗编号，如 "0"、"I"、"Ace"、"2" */
  readonly Index: string;
  /** 中文名 */
  readonly NameCn: string;
  /** 英文名 */
  readonly NameEn: string;
  /** 塔罗关键词 */
  readonly Keywords: string;
  /** 花色 */
  readonly Suit: CardSuit;
  /** 卡牌类型 */
  readonly Type: CardType;
  /** 稀有度 */
  readonly Rarity: CardRarity;
  /** AP 成本（= 消耗的私有领土量） */
  readonly ApCost: number;
  /** 效果描述文本 */
  readonly EffectDescription: string;
  /** 可用的游戏阶段 */
  readonly EffectPhase: string;
  /** 效果目标 */
  readonly EffectTarget: CardTarget;
  /** 效果机制标签（供 EffectResolver 调度） */
  readonly EffectMechanic: string;
  /** 恒常牌持续的己方回合数（null = 即时生效） */
  readonly Duration: number | null;
  /** 是否零和（领土来源/去向为公共池） */
  readonly ZeroSum: boolean;
  /** 使用条件（null = 无条件限制） */
  readonly Condition: string | null;
  /** 触发时机描述（反制牌专用） */
  readonly Trigger: string | null;
  /** 牌面故事 */
  readonly Lore: string;
}

/**
 * 卡牌实例——牌库或手牌中的实体
 * 同一张定义可以有多张实例（目前每定义仅1实例，预留扩展）
 */
export interface CardInstance {
  /** 唯一实例 ID（自增） */
  readonly InstanceId: number;
  /** 指向卡牌定义 */
  readonly Definition: CardDefinition;
}

/**
 * 生效中的恒常牌
 */
export interface ActiveConstant {
  /** 打出该恒常牌的玩家 */
  readonly OwnerId: PlayerId;
  /** 卡牌实例 */
  readonly Card: CardInstance;
  /** 剩余生效回合数（每次己方回合结束 -1） */
  RemainingTurns: number;
}

/**
 * 打出卡牌的结果——由 CardEngine 返回，GameState 据此应用效果
 */
export interface CardUsageResult {
  /** 打出的卡牌实例 */
  readonly Card: CardInstance;
  /** 实际消耗的 AP（= 私有领土扣除量） */
  readonly ApSpent: number;
  /** 卡牌生效阶段 */
  readonly Phase: string;
  /** 目标玩家 ID（SingleEnemy、AnyPlayer 等指定型目标时非 null） */
  readonly TargetPlayerId: PlayerId | null;
}

/**
 * 大轮发牌结果
 */
export interface DealResult {
  /** 每位玩家抽到的卡牌 */
  readonly Drawn: Map<PlayerId, CardInstance>;
  /** 手牌超限的玩家 ID 列表（需弃牌） */
  readonly Overfull: PlayerId[];
}

/**
 * 牌库状态快照——供 UI 展示
 */
export interface DeckSnapshot {
  readonly DeckSize: number;
  readonly DiscardSize: number;
  readonly Hands: Map<PlayerId, number>;
  readonly ActiveConstantCount: number;
}

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  [CardType.Command]: '指令',
  [CardType.Counter]: '反制',
  [CardType.Constant]: '恒常',
};

export const CARD_SUIT_LABELS: Record<CardSuit, string> = {
  [CardSuit.Major]: '大阿尔卡那',
  [CardSuit.Swords]: '宝剑',
  [CardSuit.Wands]: '权杖',
  [CardSuit.Cups]: '圣杯',
  [CardSuit.Pentacles]: '金币',
};

export const CARD_RARITY_LABELS: Record<CardRarity, string> = {
  [CardRarity.Legendary]: '传说',
  [CardRarity.Rare]: '稀有',
  [CardRarity.Uncommon]: '少见',
  [CardRarity.Common]: '普通',
};
