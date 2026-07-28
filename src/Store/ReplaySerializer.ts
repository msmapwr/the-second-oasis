/**
 * src/Store/ReplaySerializer.ts
 * 操作类型：新建
 *
 * 回放序列化——JSON 导出/导入，gzip 压缩。
 */

import type { StoredReplay, ReplayEvent } from '@/Types/Replay';
import { REPLAY_VERSION } from '@/Types/Replay';

const FILE_EXT = '.tso.json';

async function Gzip(Buf: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') return Buf;
  const Cs = new CompressionStream('gzip');
  const Writer = Cs.writable.getWriter();
  const Reader = Cs.readable.getReader();
  const BufSrc = Buf.buffer.slice(Buf.byteOffset, Buf.byteOffset + Buf.byteLength) as ArrayBuffer;
  void Writer.write(BufSrc);
  void Writer.close();

  const Chunks: ArrayBuffer[] = [];
  while (true) {
    const { done, value } = await Reader.read();
    if (done) break;
    if (value) Chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  const Total = Chunks.reduce((S, C) => S + C.byteLength, 0);
  const Result = new Uint8Array(Total);
  let Offset = 0;
  for (const C of Chunks) { Result.set(new Uint8Array(C), Offset); Offset += C.byteLength; }
  return Result;
}

async function Gunzip(Buf: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') return Buf;
  const Ds = new DecompressionStream('gzip');
  const Writer = Ds.writable.getWriter();
  const Reader = Ds.readable.getReader();
  const BufSrc = Buf.buffer.slice(Buf.byteOffset, Buf.byteOffset + Buf.byteLength) as ArrayBuffer;
  void Writer.write(BufSrc);
  void Writer.close();

  const Chunks: ArrayBuffer[] = [];
  while (true) {
    const { done, value } = await Reader.read();
    if (done) break;
    if (value) Chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  const Total = Chunks.reduce((S, C) => S + C.byteLength, 0);
  const Result = new Uint8Array(Total);
  let Offset = 0;
  for (const C of Chunks) { Result.set(new Uint8Array(C), Offset); Offset += C.byteLength; }
  return Result;
}

export async function ExportReplay(Replay: StoredReplay): Promise<void> {
  const Json = JSON.stringify({
    v: REPLAY_VERSION,
    h: Replay.header,
    e: Replay.events,
  });

  const Data = await Gzip(new TextEncoder().encode(Json));

  const FileBlob = new globalThis.Blob([Data as unknown as BlobPart], { type: 'application/octet-stream' });
  const Url = URL.createObjectURL(FileBlob);

  const Anchor = document.createElement('a');
  Anchor.href = Url;
  const DateStr = new Date(Replay.header.createdAt).toISOString().slice(0, 10);
  Anchor.download = `second-oasis-replay-${DateStr}-${Replay.header.seed}${FILE_EXT}`;
  Anchor.style.display = 'none';
  document.body.appendChild(Anchor);
  Anchor.click();
  document.body.removeChild(Anchor);
  URL.revokeObjectURL(Url);
}

export async function ImportReplay(File: File): Promise<StoredReplay> {
  const Buf = await File.arrayBuffer();
  const Bytes = new Uint8Array(Buf);

  const IsGzipped = Bytes.length >= 2 && Bytes[0] === 0x1f && Bytes[1] === 0x8b;
  const Raw = IsGzipped ? await Gunzip(Bytes) : Bytes;
  const Json = new TextDecoder().decode(Raw);

  let Parsed: { v: string; h: StoredReplay['header']; e: ReplayEvent[] };
  try {
    Parsed = JSON.parse(Json);
  } catch {
    throw new Error('回放文件格式无效：JSON 解析失败');
  }

  if (!Parsed.v || !Parsed.h || !Array.isArray(Parsed.e)) {
    throw new Error('回放文件格式无效：缺少必要字段');
  }

  if (Parsed.v !== REPLAY_VERSION) {
    throw new Error(`回放版本不兼容：文件版本 ${Parsed.v}，当前版本 ${REPLAY_VERSION}`);
  }

  const Header = Parsed.h;
  if (typeof Header.seed !== 'number' || !Header.playerCount || Header.playerCount < 2 || Header.playerCount > 4) {
    throw new Error('回放头信息无效');
  }

  if (Parsed.e.length === 0) {
    throw new Error('回放事件为空');
  }

  return {
    id: `imported_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    header: Header,
    events: Parsed.e,
    compressed: IsGzipped,
  };
}
