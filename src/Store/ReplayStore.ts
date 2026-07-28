/**
 * src/Store/ReplayStore.ts
 * 操作类型：重写
 *
 * 回放持久化——基于 IndexedDB 的对象存储，支持 gzip 压缩、LRU 淘汰。
 * 列表元数据缓存到 localStorage 加速首屏展示。
 */

import type { StoredReplay, ReplayEvent } from '@/Types/Replay';

const DB_NAME = 'second-oasis-replays';
const DB_VERSION = 1;
const STORE_NAME = 'replays';
const META_KEY = 'second-oasis-replay-meta';
const MAX_COUNT = 50;
const MAX_BYTES = 100 * 1024 * 1024;

interface ReplayMeta {
  id: string;
  createdAt: number;
  seed: number;
  playerCount: number;
  winnerName: string;
  winnerScore: number;
  totalTurns: number;
  sizeBytes: number;
}

let _Db: IDBDatabase | null = null;
let _DbPromise: Promise<IDBDatabase> | null = null;

function GetDb(): Promise<IDBDatabase> {
  if (_Db) return Promise.resolve(_Db);
  if (_DbPromise) return _DbPromise;

  _DbPromise = new Promise<IDBDatabase>((Resolve, Reject) => {
    const Req = indexedDB.open(DB_NAME, DB_VERSION);
    Req.onupgradeneeded = () => {
      const Db = Req.result;
      if (!Db.objectStoreNames.contains(STORE_NAME)) {
        Db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    Req.onsuccess = () => {
      _Db = Req.result;
      Resolve(_Db);
    };
    Req.onerror = () => Reject(Req.error);
  });
  return _DbPromise;
}

function ReadMeta(): ReplayMeta[] {
  try {
    const Raw = localStorage.getItem(META_KEY);
    if (Raw) return JSON.parse(Raw) as ReplayMeta[];
  } catch {
    // ignore
  }
  return [];
}

function SaveMeta(Meta: ReplayMeta[]): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(Meta));
  } catch {
    // ignore
  }
}

async function CompressEvents(Events: readonly ReplayEvent[]): Promise<ArrayBuffer> {
  const Json = JSON.stringify(Events);
  if (typeof CompressionStream === 'undefined') {
    return new TextEncoder().encode(Json).buffer;
  }
  const Cs = new CompressionStream('gzip');
  const Writer = Cs.writable.getWriter();
  const Reader = Cs.readable.getReader();
  Writer.write(new TextEncoder().encode(Json));
  Writer.close();

  const Chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await Reader.read();
    if (done) break;
    Chunks.push(value);
  }
  const TotalLen = Chunks.reduce((S, C) => S + C.length, 0);
  const Result = new Uint8Array(TotalLen);
  let Offset = 0;
  for (const C of Chunks) {
    Result.set(C, Offset);
    Offset += C.length;
  }
  return Result.buffer;
}

async function DecompressEvents(Buf: ArrayBuffer, Compressed: boolean): Promise<ReplayEvent[]> {
  if (!Compressed) {
    return JSON.parse(new TextDecoder().decode(Buf)) as ReplayEvent[];
  }
  if (typeof DecompressionStream === 'undefined') {
    return JSON.parse(new TextDecoder().decode(Buf)) as ReplayEvent[];
  }
  const Ds = new DecompressionStream('gzip');
  const Writer = Ds.writable.getWriter();
  const Reader = Ds.readable.getReader();
  Writer.write(new Uint8Array(Buf));
  Writer.close();

  const Chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await Reader.read();
    if (done) break;
    Chunks.push(value);
  }
  const TotalLen = Chunks.reduce((S, C) => S + C.length, 0);
  const Result = new Uint8Array(TotalLen);
  let Offset = 0;
  for (const C of Chunks) {
    Result.set(C, Offset);
    Offset += C.length;
  }
  return JSON.parse(new TextDecoder().decode(Result)) as ReplayEvent[];
}

export async function GetReplays(): Promise<ReplayMeta[]> {
  return ReadMeta().sort((A, B) => B.createdAt - A.createdAt);
}

export async function SaveReplay(Replay: StoredReplay): Promise<void> {
  const Db = await GetDb();

  const EventsBuf = await CompressEvents(Replay.events);
  const Compressed = typeof CompressionStream !== 'undefined';

  const StoreData = {
    id: Replay.id,
    header: Replay.header,
    eventsBuf: EventsBuf,
    compressed: Compressed,
  };

  const Meta = ReadMeta();

  // Estimate size
  const SizeBytes = EventsBuf.byteLength;

  Meta.unshift({
    id: Replay.id,
    createdAt: Replay.header.createdAt,
    seed: Replay.header.seed,
    playerCount: Replay.header.playerCount,
    winnerName: '',
    winnerScore: 0,
    totalTurns: Replay.events.filter((E) => E.type === 'Turn').length,
    sizeBytes: SizeBytes,
  });

  // LRU: enforce count limit
  while (Meta.length > MAX_COUNT) {
    const Removed = Meta.pop()!;
    try {
      await new Promise<void>((Resolve, Reject) => {
        const Req = Db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(Removed.id);
        Req.onsuccess = () => Resolve();
        Req.onerror = () => Reject(Req.error);
      });
    } catch {
      // ignore delete failure
    }
  }

  // LRU: enforce size limit (approximate)
  let TotalBytes = Meta.reduce((S, M) => S + M.sizeBytes, 0);
  while (TotalBytes > MAX_BYTES && Meta.length > 1) {
    const Removed = Meta.pop()!;
    TotalBytes -= Removed.sizeBytes;
    try {
      await new Promise<void>((Resolve, Reject) => {
        const Req = Db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(Removed.id);
        Req.onsuccess = () => Resolve();
        Req.onerror = () => Reject(Req.error);
      });
    } catch {
      // ignore
    }
  }

  SaveMeta(Meta);

  return new Promise<void>((Resolve, Reject) => {
    const Tx = Db.transaction(STORE_NAME, 'readwrite');
    Tx.objectStore(STORE_NAME).put(StoreData);
    Tx.oncomplete = () => Resolve();
    Tx.onerror = () => Reject(Tx.error);
  });
}

export async function LoadReplay(Id: string): Promise<StoredReplay | null> {
  const Db = await GetDb();
  return new Promise<StoredReplay | null>((Resolve, Reject) => {
    const Tx = Db.transaction(STORE_NAME, 'readonly');
    const Req = Tx.objectStore(STORE_NAME).get(Id);
    Req.onsuccess = async () => {
      const Row = Req.result as { id: string; header: StoredReplay['header']; eventsBuf: ArrayBuffer; compressed: boolean } | undefined;
      if (!Row) {
        Resolve(null);
        return;
      }
      const Events = await DecompressEvents(Row.eventsBuf, Row.compressed);
      Resolve({
        id: Row.id,
        header: Row.header,
        events: Events,
        compressed: Row.compressed,
      });
    };
    Req.onerror = () => Reject(Req.error);
  });
}

export async function DeleteReplay(Id: string): Promise<void> {
  const Db = await GetDb();
  const Meta = ReadMeta().filter((M) => M.id !== Id);
  SaveMeta(Meta);

  return new Promise<void>((Resolve, Reject) => {
    const Tx = Db.transaction(STORE_NAME, 'readwrite');
    Tx.objectStore(STORE_NAME).delete(Id);
    Tx.oncomplete = () => Resolve();
    Tx.onerror = () => Reject(Tx.error);
  });
}

export type { ReplayMeta as ReplayListItem };
