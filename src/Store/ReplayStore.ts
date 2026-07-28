const STORAGE_KEY = 'second-oasis-replays';
const MAX_REPLAYS = 20;

interface StoredReplay {
  Id: string;
  Timestamp: number;
  Seed: number;
  PlayerCount: number;
  WinnerName: string;
  WinnerScore: number;
  TotalTurns: number;
  Log: string[];
}

export type ReplayListItem = Readonly<StoredReplay>;

function LoadAll(): StoredReplay[] {
  try {
    const Raw = localStorage.getItem(STORAGE_KEY);
    if (Raw) return JSON.parse(Raw) as StoredReplay[];
  } catch {
    // ignore
  }
  return [];
}

function SaveAll(Replays: StoredReplay[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Replays));
  } catch {
    // ignore
  }
}

export function GetReplays(): ReplayListItem[] {
  return LoadAll().sort((A, B) => B.Timestamp - A.Timestamp);
}

export function SaveReplay(Replay: Omit<StoredReplay, 'Id'>): void {
  const All = LoadAll();
  const Id = `rp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  All.unshift({ ...Replay, Id });
  if (All.length > MAX_REPLAYS) All.length = MAX_REPLAYS;
  SaveAll(All);
}

export function DeleteReplay(Id: string): void {
  const All = LoadAll().filter((R) => R.Id !== Id);
  SaveAll(All);
}
