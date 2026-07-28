/**
 * src/Core/Card/CardEngine.test.ts
 * 操作类型：新建
 *
 * 技能卡罗牌引擎测试
 * 覆盖：初始化、洗牌、抽牌、发牌、手牌上限、弃牌、打出、恒常维护、
 *       CanPlayCard 验证、反制窗口查询、PeekTop、重置
 */
import { describe, it, expect } from 'vitest';
import { CardEngine } from './CardEngine';
import { SeededRandom } from '@/Utils/Random/SeededRandom';
import { CardType, CardSuit, CardRarity } from '@/Types/Card';
import { ALL_TAROT_CARDS } from './CardData';

/** 创建已初始化的 CardEngine（4 人） */
function CreateEngine(Seed: number = 42): CardEngine {
  const Rng = new SeededRandom(Seed);
  const Engine = new CardEngine(Rng);
  Engine.Initialize(4);
  return Engine;
}

describe('CardEngine 初始化', () => {
  it('应包含全部 78 张牌', () => {
    const Engine = CreateEngine();
    expect(Engine.DeckSize).toBe(78);
    expect(Engine.DiscardSize).toBe(0);
    expect(Engine.IsInitialized).toBe(true);
  });

  it('重复调用 Initialize 不应改变牌库', () => {
    const Engine = CreateEngine();
    Engine.Initialize(4);
    expect(Engine.DeckSize).toBe(78);
  });
});

describe('CardEngine 洗牌', () => {
  it('相同种子应产生相同洗牌顺序', () => {
    const Engine1 = CreateEngine(100);
    const Engine2 = CreateEngine(100);

    const Cards1: string[] = [];
    const Cards2: string[] = [];
    for (let I = 0; I < 10; I++) {
      Cards1.push(Engine1.DrawCard()!.Definition.Id);
      Cards2.push(Engine2.DrawCard()!.Definition.Id);
    }

    expect(Cards1).toEqual(Cards2);
  });

  it('不同种子应产生不同洗牌顺序', () => {
    const Engine1 = CreateEngine(100);
    const Engine2 = CreateEngine(999);

    const Cards1: string[] = [];
    const Cards2: string[] = [];
    for (let I = 0; I < 78; I++) {
      Cards1.push(Engine1.DrawCard()!.Definition.Id);
      Cards2.push(Engine2.DrawCard()!.Definition.Id);
    }

    const Same = Cards1.every((Id, I) => Id === Cards2[I]);
    expect(Same).toBe(false);
  });

  it('洗牌不丢失任何牌', () => {
    const Engine = CreateEngine();
    const Drawn = new Set<string>();
    for (let I = 0; I < 78; I++) {
      const Card = Engine.DrawCard();
      expect(Card).not.toBeNull();
      Drawn.add(Card!.Definition.Id);
    }
    expect(Drawn.size).toBe(78);
  });
});

describe('CardEngine 抽牌', () => {
  it('抽牌应减少牌库数量', () => {
    const Engine = CreateEngine();
    expect(Engine.DeckSize).toBe(78);
    const Card = Engine.DrawCard();
    expect(Card).not.toBeNull();
    expect(Engine.DeckSize).toBe(77);
  });

  it('牌库抽空后应自动洗回弃牌堆', () => {
    const Engine = CreateEngine();

    for (let I = 0; I < 78; I++) {
      const Result = Engine.DealToAll([0]);
      const Card = Result.Drawn.get(0);
      if (Card) {
        Engine.DiscardCard(0, Card.InstanceId);
      }
    }

    expect(Engine.DeckSize).toBe(0);

    const Card = Engine.DrawCard();
    expect(Card).not.toBeNull();
    expect(Engine.DeckSize).toBeLessThanOrEqual(77);
  });
});

describe('CardEngine 发牌', () => {
  it('4 人发牌每人 1 张', () => {
    const Engine = CreateEngine();
    const Result = Engine.DealToAll([0, 1, 2, 3]);

    expect(Result.Drawn.size).toBe(4);
    expect(Result.Overfull).toHaveLength(0);
    expect(Engine.DeckSize).toBe(74);
    expect(Engine.GetHand(0)).toHaveLength(1);
    expect(Engine.GetHand(1)).toHaveLength(1);
    expect(Engine.GetHand(2)).toHaveLength(1);
    expect(Engine.GetHand(3)).toHaveLength(1);
  });

  it('2 人发牌', () => {
    const Engine = CreateEngine();
    Engine.DealToAll([0, 1]);

    expect(Engine.GetHand(0)).toHaveLength(1);
    expect(Engine.GetHand(1)).toHaveLength(1);
    expect(Engine.DeckSize).toBe(76);
  });

  it('手牌超限时返回 Overfull 列表', () => {
    const Engine = CreateEngine();

    Engine.DealToAll([0]);
    Engine.DealToAll([0]);
    Engine.DealToAll([0]);

    expect(Engine.GetHand(0)).toHaveLength(3);

    const Result = Engine.DealToAll([0]);
    expect(Engine.GetHand(0)).toHaveLength(4);
    expect(Result.Overfull).toContain(0);
  });
});

describe('CardEngine 弃牌', () => {
  it('弃牌应从手牌移除并进入弃牌堆', () => {
    const Engine = CreateEngine();
    const Result = Engine.DealToAll([0]);
    const Card = Result.Drawn.get(0)!;

    expect(Engine.GetHand(0)).toHaveLength(1);
    Engine.DiscardCard(0, Card.InstanceId);

    expect(Engine.GetHand(0)).toHaveLength(0);
    expect(Engine.DiscardSize).toBe(1);
  });

  it('弃不存在的牌应静默忽略', () => {
    const Engine = CreateEngine();
    Engine.DealToAll([0]);
    Engine.DiscardCard(0, 99999);
    expect(Engine.GetHand(0)).toHaveLength(1);
  });
});

describe('CardEngine 打出卡牌', () => {
  it('打出指令牌应进入弃牌堆', () => {
    const Engine = CreateEngine();
    Engine.DealToAll([0]);

    const Hand = Engine.GetHand(0);
    if (Hand.length === 0) return;

    const Card = Hand[0];

    if (Card.Definition.Type === CardType.Command) {
      const Before = Engine.DiscardSize;
      const Result = Engine.PlayCard(0, Card.InstanceId, null);
      expect(Result).not.toBeNull();
      expect(Engine.GetHand(0)).toHaveLength(0);
      expect(Engine.DiscardSize).toBeGreaterThan(Before);
    }
  });

  it('打出恒常牌应进入 ActiveConstants', () => {
    const Engine = CreateEngine();
    Engine.DealToAll([0]);

    const Hand = Engine.GetHand(0);
    if (Hand.length === 0) return;

    const ConstantCard = Hand.find((C) => C.Definition.Type === CardType.Constant);
    if (!ConstantCard) return;

    const Result = Engine.PlayCard(0, ConstantCard.InstanceId, null);
    expect(Result).not.toBeNull();
    expect(Engine.GetHand(0)).toHaveLength(0);
    expect(Engine.GetActiveConstants()).toHaveLength(1);
  });

  it('打出不存在的手牌应返回 null', () => {
    const Engine = CreateEngine();
    const Result = Engine.PlayCard(0, 99999, null);
    expect(Result).toBeNull();
  });
});

describe('CardEngine 恒常牌维护', () => {
  it('TickConstants 应减少剩余回合', () => {
    const Engine = CreateEngine();
    Engine.DealToAll([0]);

    const Hand = Engine.GetHand(0);
    const ConstantCard = Hand.find((C) => C.Definition.Type === CardType.Constant);
    if (!ConstantCard) return;

    const Duration = ConstantCard.Definition.Duration!;
    Engine.PlayCard(0, ConstantCard.InstanceId, null);

    const Active = Engine.GetActiveConstants();
    expect(Active).toHaveLength(1);
    expect(Active[0].RemainingTurns).toBe(Duration);

    const Expired = Engine.TickConstants(0);
    expect(Active[0].RemainingTurns).toBe(Duration - 1);

    if (Duration === 1) {
      expect(Expired).toHaveLength(1);
      expect(Engine.GetActiveConstants()).toHaveLength(0);
    } else {
      expect(Expired).toHaveLength(0);
      expect(Engine.GetActiveConstants()).toHaveLength(1);
    }
  });

  it('TickConstants 只在对应玩家回合减少', () => {
    const Engine = CreateEngine();
    Engine.DealToAll([0]);

    const Hand = Engine.GetHand(0);
    const ConstantCard = Hand.find((C) => C.Definition.Type === CardType.Constant);
    if (!ConstantCard) return;

    Engine.PlayCard(0, ConstantCard.InstanceId, null);
    const Before = Engine.GetActiveConstants()[0].RemainingTurns;

    Engine.TickConstants(1);
    expect(Engine.GetActiveConstants()[0].RemainingTurns).toBe(Before);
  });
});

describe('CardEngine 验证', () => {
  it('AP 不足应不可打出', () => {
    const Engine = CreateEngine();
    Engine.DealToAll([0]);

    const Hand = Engine.GetHand(0);
    if (Hand.length === 0) return;

    const Card = Hand[0];
    const Phase = Card.Definition.EffectPhase;
    const CanPlay = Engine.CanPlayCard(0, Card.InstanceId, Phase, 0);
    if (Card.Definition.ApCost > 0) {
      expect(CanPlay).toBe(false);
    }
  });

  it('AP 足够应可打出', () => {
    const Engine = CreateEngine();
    Engine.DealToAll([0]);

    const Hand = Engine.GetHand(0);
    const CheapCard = Hand.find((C) => C.Definition.ApCost <= 1);
    if (!CheapCard) return;

    const CanPlay = Engine.CanPlayCard(0, CheapCard.InstanceId, CheapCard.Definition.EffectPhase, 10);
    expect(CanPlay).toBe(true);
  });

  it('阶段不对应不可打出', () => {
    const Engine = CreateEngine();
    Engine.DealToAll([0]);

    const Hand = Engine.GetHand(0);
    if (Hand.length === 0) return;

    const Card = Hand[0];
    const CanPlay = Engine.CanPlayCard(0, Card.InstanceId, 'WrongPhase', 100);
    expect(CanPlay).toBe(false);
  });

  it('手牌中没有的实例应不可打出', () => {
    const Engine = CreateEngine();
    const CanPlay = Engine.CanPlayCard(0, 1, 'SelectMode', 100);
    expect(CanPlay).toBe(false);
  });
});

describe('CardEngine GetPlayableCards', () => {
  it('应按阶段过滤可打出卡牌', () => {
    const Engine = CreateEngine();
    Engine.DealToAll([0]);

    const Playable = Engine.GetPlayableCards(0, 'SelectMode', 100);
    const Hand = Engine.GetHand(0);
    for (const Card of Hand) {
      if (Card.Definition.EffectPhase === 'SelectMode' && Card.Definition.ApCost <= 100) {
        expect(Playable).toContainEqual(Card);
      }
    }
  });

  it('AP 不足的牌应被过滤', () => {
    const Engine = CreateEngine();
    Engine.DealToAll([0]);

    const Playable = Engine.GetPlayableCards(0, 'SelectMode', 0);
    for (const Card of Playable) {
      expect(Card.Definition.ApCost).toBe(0);
    }
  });
});

describe('CardEngine 查询', () => {
  it('GetHandCounts 应返回正确数量', () => {
    const Engine = CreateEngine();
    Engine.DealToAll([0, 1]);
    Engine.DealToAll([0]);

    const Counts = Engine.GetHandCounts();
    expect(Counts.get(0)).toBe(2);
    expect(Counts.get(1)).toBe(1);
  });

  it('GetSnapshot 应返回正确快照', () => {
    const Engine = CreateEngine();
    Engine.DealToAll([0, 1]);

    const Snap = Engine.GetSnapshot();
    expect(Snap.DeckSize).toBe(76);
    expect(Snap.DiscardSize).toBe(0);
    expect(Snap.Hands.get(0)).toBe(1);
    expect(Snap.Hands.get(1)).toBe(1);
    expect(Snap.ActiveConstantCount).toBe(0);
  });

  it('PeekTop 应查看不减少牌库', () => {
    const Engine = CreateEngine();
    const Before = Engine.DeckSize;

    const Peeked = Engine.PeekTop(3);
    expect(Peeked).toHaveLength(3);
    expect(Engine.DeckSize).toBe(Before);
  });
});

describe('CardEngine 重置', () => {
  it('Reset 应清空所有状态', () => {
    const Engine = CreateEngine();
    Engine.DealToAll([0, 1, 2, 3]);

    Engine.Reset();

    expect(Engine.DeckSize).toBe(0);
    expect(Engine.DiscardSize).toBe(0);
    expect(Engine.IsInitialized).toBe(false);
    expect(Engine.GetHand(0)).toHaveLength(0);
    expect(Engine.GetActiveConstants()).toHaveLength(0);
  });
});

describe('CardEngine 卡牌定义完整性', () => {
  it('ALL_TAROT_CARDS 应恰好 78 张', () => {
    expect(ALL_TAROT_CARDS.length).toBe(78);
  });

  it('应包含 22 张大阿尔卡那', () => {
    const Major = ALL_TAROT_CARDS.filter((C) => C.Suit === CardSuit.Major);
    expect(Major).toHaveLength(22);
  });

  it('应包含四花色各 14 张小阿尔卡那', () => {
    for (const Suit of [CardSuit.Swords, CardSuit.Wands, CardSuit.Cups, CardSuit.Pentacles]) {
      const Cards = ALL_TAROT_CARDS.filter((C) => C.Suit === Suit);
      expect(Cards).toHaveLength(14);
    }
  });

  it('所有卡的 ID 应唯一', () => {
    const Ids = ALL_TAROT_CARDS.map((C) => C.Id);
    const Unique = new Set(Ids);
    expect(Unique.size).toBe(78);
  });

  it('所有恒常牌应有 Duration', () => {
    const Constants = ALL_TAROT_CARDS.filter((C) => C.Type === CardType.Constant);
    for (const Card of Constants) {
      expect(Card.Duration).toBeGreaterThan(0);
    }
  });

  it('所有指令/反制牌的 Duration 应为 null', () => {
    const NonConstants = ALL_TAROT_CARDS.filter((C) => C.Type !== CardType.Constant);
    for (const Card of NonConstants) {
      expect(Card.Duration).toBeNull();
    }
  });

  it('大阿尔卡那应全部为 Legendary', () => {
    const Major = ALL_TAROT_CARDS.filter((C) => C.Suit === CardSuit.Major);
    for (const Card of Major) {
      expect(Card.Rarity).toBe(CardRarity.Legendary);
    }
  });

  it('所有牌的 ApCost 应为非负整数', () => {
    for (const Card of ALL_TAROT_CARDS) {
      expect(Card.ApCost).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(Card.ApCost)).toBe(true);
    }
  });
});
