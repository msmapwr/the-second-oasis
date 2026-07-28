/**
 * src/Core/Card/CardEngine.ts
 * 操作类型：新建
 *
 * 技能卡罗牌核心引擎——牌库管理、手牌管理、卡牌验证、恒常牌追踪
 *
 * 设计要点：
 * - 纯逻辑模块，不直接修改 GameState
 * - 接收 IRandomSource，Fisher-Yates 洗牌保证确定性
 * - 返回结构化结果，由上层（GameState/EffectResolver）应用效果
 * - 遵循项目命名规范（大驼峰、_前缀私有）
 */

import type { IRandomSource } from '@/Utils/Random/IRandomSource';
import type { PlayerId } from '@/Types/Player';
import {
  CardType,
  HAND_LIMIT,
} from '@/Types/Card';
import type {
  CardInstance,
  ActiveConstant,
  CardUsageResult,
  DealResult,
  DeckSnapshot,
} from '@/Types/Card';
import { ALL_TAROT_CARDS } from './CardData';

export class CardEngine {
  private readonly _Random: IRandomSource;

  /** 当前牌库（顶部 = 数组尾部，抽牌从尾部取） */
  private _Deck: CardInstance[] = [];

  /** 弃牌堆 */
  private _DiscardPile: CardInstance[] = [];

  /** 每位玩家的手牌 */
  private _Hands: Map<PlayerId, CardInstance[]> = new Map();

  /** 生效中的恒常牌 */
  private _ActiveConstants: ActiveConstant[] = [];

  /** 自增实例 ID */
  private _NextInstanceId: number = 1;

  /** 牌库是否已初始化 */
  private _IsInitialized: boolean = false;

  constructor(Random: IRandomSource) {
    this._Random = Random;
  }

  get IsInitialized(): boolean {
    return this._IsInitialized;
  }

  get DeckSize(): number {
    return this._Deck.length;
  }

  get DiscardSize(): number {
    return this._DiscardPile.length;
  }

  /**
   * 初始化牌库：为每张卡牌定义创建 1 个实例，然后洗牌
   * 每个对局只调用一次
   */
  Initialize(_PlayerCount: 2 | 3 | 4): void {
    if (this._IsInitialized) {
      return;
    }

    this._Deck = ALL_TAROT_CARDS.map((Def) => ({
      InstanceId: this._NextInstanceId++,
      Definition: Def,
    }));

    this._DiscardPile = [];
    this._Hands.clear();
    this._ActiveConstants = [];
    this._IsInitialized = true;

    this.Shuffle();
  }

  /**
   * Fisher-Yates 洗牌——使用 IRandomSource 保证确定性
   * 相同种子 + 相同初始牌库 + 相同调用序列 = 相同洗牌结果
   */
  Shuffle(): void {
    const Deck = this._Deck;
    for (let I = Deck.length - 1; I > 0; I--) {
      const J = this._Random.NextInt(0, I);
      const Temp = Deck[I];
      Deck[I] = Deck[J];
      Deck[J] = Temp;
    }
  }

  /**
   * 从牌库顶抽一张牌
   * 牌库空时自动将弃牌堆洗回牌库再抽
   * 若弃牌堆也为空（极端情况），返回 null
   */
  DrawCard(): CardInstance | null {
    if (this._Deck.length === 0) {
      if (this._DiscardPile.length === 0) {
        return null;
      }
      this.RecycleDiscard();
    }
    return this._Deck.pop()!;
  }

  /**
   * 将弃牌堆洗回牌库
   */
  private RecycleDiscard(): void {
    this._Deck = [...this._DiscardPile];
    this._DiscardPile = [];
    this.Shuffle();
  }

  /**
   * 大轮发牌——每位活跃玩家抽 1 张
   * 手牌超限的玩家列入 Overfull 列表，由上层（UI/GameState）处理弃牌
   */
  DealToAll(PlayerIds: PlayerId[]): DealResult {
    const Drawn = new Map<PlayerId, CardInstance>();
    const Overfull: PlayerId[] = [];

    for (const Pid of PlayerIds) {
      const Card = this.DrawCard();
      if (Card === null) {
        continue;
      }

      this.AddToHand(Pid, Card);
      Drawn.set(Pid, Card);

      const Hand = this._Hands.get(Pid);
      if (Hand && Hand.length > HAND_LIMIT) {
        Overfull.push(Pid);
      }
    }

    return { Drawn, Overfull };
  }

  /**
   * 指定玩家额外抽牌（不检查上限，由调用方判断）
   */
  DrawCards(PlayerId: PlayerId, Count: number): CardInstance[] {
    const Drawn: CardInstance[] = [];
    for (let I = 0; I < Count; I++) {
      const Card = this.DrawCard();
      if (Card === null) {
        break;
      }
      this.AddToHand(PlayerId, Card);
      Drawn.push(Card);
    }
    return Drawn;
  }

  /**
   * 弃掉手牌中的指定实例
   * 不检查合法性——调用方应先验证
   */
  DiscardCard(PlayerId: PlayerId, InstanceId: number): void {
    const Hand = this._Hands.get(PlayerId);
    if (!Hand) {
      return;
    }

    const Index = Hand.findIndex((C) => C.InstanceId === InstanceId);
    if (Index === -1) {
      return;
    }

    const [Removed] = Hand.splice(Index, 1);
    this._DiscardPile.push(Removed);
  }

  /**
   * 打出卡牌——从手牌移除，执行打出逻辑
   * 指令/反制牌 → 进入弃牌堆
   * 恒常牌 → 进入 ActiveConstants 追踪
   *
   * @returns CardUsageResult 或 null（验证失败时）
   */
  PlayCard(
    PlayerId: PlayerId,
    InstanceId: number,
    TargetPlayerId: PlayerId | null,
  ): CardUsageResult | null {
    const Hand = this._Hands.get(PlayerId);
    if (!Hand) {
      return null;
    }

    const Index = Hand.findIndex((C) => C.InstanceId === InstanceId);
    if (Index === -1) {
      return null;
    }

    const Card = Hand[Index];
    const Def = Card.Definition;

    Hand.splice(Index, 1);

    if (Def.Type === CardType.Constant) {
      this._ActiveConstants.push({
        OwnerId: PlayerId,
        Card,
        RemainingTurns: Def.Duration ?? 1,
      });
    } else {
      this._DiscardPile.push(Card);
    }

    return {
      Card,
      ApSpent: Def.ApCost,
      Phase: Def.EffectPhase,
      TargetPlayerId,
    };
  }

  /**
   * 验证是否可以打出指定卡牌
   * @returns true = 可以打出
   */
  CanPlayCard(
    PlayerId: PlayerId,
    InstanceId: number,
    CurrentPhase: string,
    PrivateTerritory: number,
  ): boolean {
    const Hand = this._Hands.get(PlayerId);
    if (!Hand) {
      return false;
    }

    const Card = Hand.find((C) => C.InstanceId === InstanceId);
    if (!Card) {
      return false;
    }

    const Def = Card.Definition;

    if (PrivateTerritory < Def.ApCost) {
      return false;
    }

    if (Def.EffectPhase !== CurrentPhase) {
      return false;
    }

    if (Def.Condition !== null) {
      return false;
    }

    return true;
  }

  /**
   * 获取指定阶段下玩家可以打出的卡牌列表
   * 用于 UI 高亮可选牌
   */
  GetPlayableCards(
    PlayerId: PlayerId,
    CurrentPhase: string,
    PrivateTerritory: number,
  ): CardInstance[] {
    const Hand = this._Hands.get(PlayerId);
    if (!Hand) {
      return [];
    }

    return Hand.filter((C) => {
      const Def = C.Definition;
      if (PrivateTerritory < Def.ApCost) {
        return false;
      }
      if (Def.EffectPhase !== CurrentPhase) {
        return false;
      }
      if (Def.Condition !== null && Def.Condition.length > 0) {
        return false;
      }
      return true;
    });
  }

  /**
   * 获取玩家手牌（只读）
   */
  GetHand(PlayerId: PlayerId): readonly CardInstance[] {
    return this._Hands.get(PlayerId) ?? [];
  }

  /**
   * 获取所有玩家的手牌数量（只读）
   */
  GetHandCounts(): ReadonlyMap<PlayerId, number> {
    const Result = new Map<PlayerId, number>();
    for (const [Pid, Hand] of this._Hands) {
      Result.set(Pid, Hand.length);
    }
    return Result;
  }

  /**
   * 查询手牌中超限的玩家列表
   */
  GetOverfullPlayers(): PlayerId[] {
    const Overfull: PlayerId[] = [];
    for (const [Pid, Hand] of this._Hands) {
      if (Hand.length > HAND_LIMIT) {
        Overfull.push(Pid);
      }
    }
    return Overfull;
  }

  /**
   * 获取生效中的恒常牌（只读）
   */
  GetActiveConstants(): readonly ActiveConstant[] {
    return this._ActiveConstants;
  }

  /**
   * 获取指定玩家的生效恒常牌
   */
  GetActiveConstantsForPlayer(PlayerId: PlayerId): readonly ActiveConstant[] {
    return this._ActiveConstants.filter((Ac) => Ac.OwnerId === PlayerId);
  }

  /**
   * 维护恒常牌——每回合结束时调用
   * 为所有恒常牌的 RemainingTurns -1，移除到期者
   * @returns 本轮到期的恒常牌列表（供上层做失效处理）
   */
  TickConstants(PlayerId: PlayerId): ActiveConstant[] {
    const Expired: ActiveConstant[] = [];
    const Surviving: ActiveConstant[] = [];

    for (const Ac of this._ActiveConstants) {
      if (Ac.OwnerId !== PlayerId) {
        Surviving.push(Ac);
        continue;
      }

      Ac.RemainingTurns -= 1;
      if (Ac.RemainingTurns <= 0) {
        Expired.push(Ac);
      } else {
        Surviving.push(Ac);
      }
    }

    this._ActiveConstants = Surviving;
    return Expired;
  }

  /**
   * 查看牌库顶部 N 张牌（不抽走）
   */
  PeekTop(Count: number): CardInstance[] {
    if (this._Deck.length === 0 && this._DiscardPile.length > 0) {
      this.RecycleDiscard();
    }
    const Start = Math.max(0, this._Deck.length - Count);
    return this._Deck.slice(Start).reverse();
  }

  /**
   * 将指定卡牌加入牌库顶部（用于 Scry 效果放回）
   */
  PutOnTop(Cards: CardInstance[]): void {
    this._Deck.push(...Cards);
  }

  /**
   * 牌库状态快照——供 UI 展示
   */
  GetSnapshot(): DeckSnapshot {
    const Hands = new Map<PlayerId, number>();
    for (const [Pid, Hand] of this._Hands) {
      Hands.set(Pid, Hand.length);
    }

    return {
      DeckSize: this._Deck.length,
      DiscardSize: this._DiscardPile.length,
      Hands,
      ActiveConstantCount: this._ActiveConstants.length,
    };
  }

  /**
   * 重置引擎——用于新对局
   */
  Reset(): void {
    this._Deck = [];
    this._DiscardPile = [];
    this._Hands.clear();
    this._ActiveConstants = [];
    this._NextInstanceId = 1;
    this._IsInitialized = false;
  }

  /**
   * 内部：将卡牌加入��家手牌
   */
  private AddToHand(PlayerId: PlayerId, Card: CardInstance): void {
    let Hand = this._Hands.get(PlayerId);
    if (!Hand) {
      Hand = [];
      this._Hands.set(PlayerId, Hand);
    }
    Hand.push(Card);
  }
}
