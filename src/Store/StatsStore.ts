/**
 * src/Store/StatsStore.ts
 * 操作类型：新建
 *
 * 玩家统计——localStorage 持久化，每局结束后更新聚合数据。
 */

import { CardSuit, CARD_SUIT_LABELS } from '@/Types/Card';

const STORAGE_KEY = 'second-oasis-stats';

interface StatsData {
  TotalGames: number;
  Wins: number;
  MaxTerritory: number;
  MaxDevChain: number;
  MaxRobberyWins: number;
  LongestGame: number;
  SuitUsage: Partial<Record<CardSuit, number>>;
  CardTop: Record<string, number>;
}

function DefaultData(): StatsData {
  return {
    TotalGames: 0,
    Wins: 0,
    MaxTerritory: 0,
    MaxDevChain: 0,
    MaxRobberyWins: 0,
    LongestGame: 0,
    SuitUsage: {},
    CardTop: {},
  };
}

function Load(): StatsData {
  try {
    const Raw = localStorage.getItem(STORAGE_KEY);
    if (Raw) return JSON.parse(Raw) as StatsData;
  } catch {
    // ignore
  }
  return DefaultData();
}

function Save(Data: StatsData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Data));
  } catch {
    // ignore
  }
}

export function GetStats(): StatsData {
  return Load();
}

export interface GameResultForStats {
  IsWin: boolean;
  FinalTerritory: number;
  MaxDevChain: number;
  RobberyWins: number;
  TotalTurns: number;
  CardUsage: Array<{ Suit: CardSuit; CardId: string; CardName: string }>;
}

export function RecordGame(Result: GameResultForStats): void {
  const Data = Load();
  Data.TotalGames++;
  if (Result.IsWin) Data.Wins++;
  if (Result.FinalTerritory > Data.MaxTerritory) Data.MaxTerritory = Result.FinalTerritory;
  if (Result.MaxDevChain > Data.MaxDevChain) Data.MaxDevChain = Result.MaxDevChain;
  if (Result.RobberyWins > Data.MaxRobberyWins) Data.MaxRobberyWins = Result.RobberyWins;
  if (Result.TotalTurns > Data.LongestGame) Data.LongestGame = Result.TotalTurns;

  for (const Use of Result.CardUsage) {
    Data.SuitUsage[Use.Suit] = (Data.SuitUsage[Use.Suit] ?? 0) + 1;
    Data.CardTop[Use.CardName] = (Data.CardTop[Use.CardName] ?? 0) + 1;
  }

  Save(Data);
}

export function ClearStats(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function GetWinRate(): string {
  const Data = Load();
  if (Data.TotalGames === 0) return '0%';
  return ((Data.Wins / Data.TotalGames) * 100).toFixed(1) + '%';
}

export function GetTopCards(TopN = 5): Array<{ Name: string; Count: number }> {
  const Data = Load();
  return Object.entries(Data.CardTop)
    .sort(([, A], [, B]) => B - A)
    .slice(0, TopN)
    .map(([Name, Count]) => ({ Name, Count }));
}

export function GetSuitBreakdown(): Array<{ Label: string; Count: number; Pct: string }> {
  const Data = Load();
  const Total = Object.values(Data.SuitUsage).reduce((S, C) => S + C, 0);
  const Suits = [CardSuit.Major, CardSuit.Swords, CardSuit.Wands, CardSuit.Cups, CardSuit.Pentacles];
  return Suits.map((S) => {
    const Count = Data.SuitUsage[S] ?? 0;
    return {
      Label: CARD_SUIT_LABELS[S] ?? S,
      Count,
      Pct: Total > 0 ? ((Count / Total) * 100).toFixed(1) + '%' : '0%',
    };
  });
}
