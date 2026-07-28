import type { IGameStore } from '@/Store/GameStore';
import type { PlayerId } from '@/Types/Player';
import type { AIDifficulty } from '@/Types/AI';
import type { TerritorySnapshot } from '@/Types/Territory';

export interface CardDecision {
  readonly InstanceId: number;
  readonly TargetId: PlayerId | null;
  readonly Reason: string;
  readonly Priority: number;
}

export function EvaluateCardHand(
  Store: IGameStore,
  PlayerId: PlayerId,
  Difficulty: AIDifficulty,
): CardDecision[] {
  const Sorted: CardDecision[] = [];

  if (!Store.CardEnabled) return Sorted;

  const Playable = Store.GetCardPlayableCards(PlayerId);
  if (Playable.length === 0) return Sorted;

  const Snap = Store.Snapshot;
  const SelfTerr = Snap.Players[PlayerId]?.PrivateTerritory ?? 0;
  const PublicTerr = Snap.PublicTerritory;
  const Consecutive = Store.GetConsecutiveDoubles(PlayerId);
  const RobberyCount = Store.RobberyTriggeredCount;
  const CollapseX = Store.CollapseX;

  for (const Card of Playable) {
    const Def = Card.Definition;
    const Mech = Def.EffectMechanic;
    let Priority = 0;
    let Reason = '';

    if (SelfTerr < 5 && Mech === 'PureHeal') {
      Priority = 100;
      Reason = '领土危急，立即治疗';
    } else if (SelfTerr < 5 && Mech === 'CatchupHeal') {
      Priority = 95;
      Reason = '领土危急，追赶治疗';
    } else if (SelfTerr < 3 && (Mech === 'TerritoryGain' || Mech === 'GlobalHeal')) {
      Priority = 90;
      Reason = '领土极危，获取领土';
    } else if (Consecutive >= 1 && (Mech === 'ForceDouble' || Mech === 'ConditionalForceDouble')) {
      Priority = 85;
      Reason = '保护开发链连击';
    } else if (Consecutive >= 1 && Mech === 'DevChainProtect') {
      Priority = 80;
      Reason = '开发链保护';
    } else if (RobberyCount >= 1 && CollapseX >= 3 && Mech === 'CollapseReduction') {
      Priority = 75;
      Reason = '崩坏严重，减少损失';
    } else if (RobberyCount >= 1 && CollapseX >= 3 && Mech === 'FullNegate') {
      Priority = 70;
      Reason = '完全免疫崩坏';
    } else if (Mech === 'RawGainBonus') {
      Priority = 65;
      Reason = '提升本回合收益';
    } else if (Mech === 'GainAndDraw') {
      Priority = 60;
      Reason = '获取领土并抽牌';
    } else if (Mech === 'OccupationBonus') {
      Priority = 55;
      Reason = '持续占领加成';
    } else if (Mech === 'RegenPerTurn') {
      Priority = 50;
      Reason = '每回合再生领土';
    } else if (PublicTerr <= 30 && Mech === 'MirrorGain') {
      Priority = 45;
      Reason = '冲刺阶段镜像增益';
    } else if (Mech === 'ForceCollapse') {
      const Richest = FindRichestOther(Snap, PlayerId);
      if (Richest !== null && (Snap.Players[Richest]?.PrivateTerritory ?? 0) > SelfTerr * 1.5) {
        Priority = 40;
        Reason = '领先者崩坏打击';
      }
    } else if (Mech === 'Steal' || Mech === 'MassDrain') {
      const Richest = FindRichestOther(Snap, PlayerId);
      if (Richest !== null) {
        Priority = 35;
        Reason = '掠夺领先者领土';
      }
    } else if (Mech === 'Reroll') {
      if (Difficulty >= 3) {
        Priority = 30;
        Reason = '重掷骰子优化结果';
      }
    } else if (Mech === 'SetDieTo6' || Mech === 'SetDie' || Mech === 'ChooseExactDice') {
      if (Difficulty >= 3) {
        Priority = 25;
        Reason = '精确控制骰面';
      }
    } else if (Mech === 'BestOfTwoModes') {
      Priority = 20;
      Reason = '双模式取最优';
    } else if (Mech === 'ModeLock') {
      Priority = 15;
      Reason = '限制对手模式';
    } else if (Mech === 'ForceAggressive') {
      Priority = 15;
      Reason = '强制对手激进';
    } else if (Mech === 'TerritoryShield' || Mech === 'AbsoluteShield' || Mech === 'TerritoryFloor') {
      if (SelfTerr < 10) {
        Priority = 12;
        Reason = '领土保护屏障';
      }
    } else if (Mech === 'ExtraTurn') {
      Priority = 10;
      Reason = '额外回合机会';
    } else if (Def.Type === 'Counter') {
      if (RobberyCount >= 1) {
        Priority = 8;
        Reason = '预置反制应对崩坏';
      } else if (FindRichestOther(Snap, PlayerId) !== null) {
        Priority = 5;
        Reason = '预置反制备用';
      }
    } else if (Def.ApCost === 0) {
      Priority = 3;
      Reason = '免费卡牌无风险';
    } else if (SelfTerr > 20 && Def.ApCost <= 2) {
      Priority = 1;
      Reason = '富裕时低风险尝试';
    }

    if (Priority > 0) {
      Sorted.push({
        InstanceId: Card.InstanceId,
        TargetId: ResolveTarget(Snap, PlayerId, Def.EffectTarget),
        Reason,
        Priority,
      });
    }
  }

  Sorted.sort((A, B) => B.Priority - A.Priority);

  if (Difficulty <= 1) {
    for (let I = Sorted.length - 1; I > 0; I--) {
      const J = Math.floor(Math.random() * (I + 1));
      [Sorted[I], Sorted[J]] = [Sorted[J], Sorted[I]];
    }
    return Sorted.slice(0, 2);
  }

  if (Difficulty <= 2) {
    return Sorted.filter((D) => D.Priority >= 20);
  }

  return Sorted;
}

function FindRichestOther(Snap: TerritorySnapshot, SelfId: PlayerId): PlayerId | null {
  let Best: PlayerId | null = null;
  let BestVal = -1;
  for (const P of Snap.Players) {
    if (P.Id === SelfId) continue;
    if (P.PrivateTerritory > BestVal) {
      BestVal = P.PrivateTerritory;
      Best = P.Id;
    }
  }
  return Best;
}

function ResolveTarget(
  Snap: TerritorySnapshot, SelfId: PlayerId, Target: string,
): PlayerId | null {
  switch (Target) {
    case 'Self': return SelfId;
    case 'SingleEnemy':
    case 'AnyPlayer':
    case 'RichestOther':
    case 'RobberyInitiator':
    case 'OccupyingPlayer':
      return FindRichestOther(Snap, SelfId);
    case 'Choice': return null;
    default: return null;
  }
}
