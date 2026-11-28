import { validarMp4ParaWeb } from "./mp4-compatibility";

type Box = { start: number; end: number; header: number; kind: string };
const invalid = () => new Error("Não foi possível preparar este MP4 para web. Escolha outro vídeo MP4 H.264.");
const containers = new Set(["moov", "trak", "mdia", "minf", "stbl"]);
const unsupported = new Set(["cmov", "mvex", "moof", "sidx", "mfra", "saio", "iloc", "meta"]);

function boxes(bytes: Uint8Array, start = 0, end = bytes.length): Box[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const list: Box[] = [];
  for (let p = start; p < end;) {
    if (end - p < 8 || list.length >= 100000) throw invalid();
    let size = view.getUint32(p);
    let header = 8;
    const kind = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
    if (size === 1) {
      if (end - p < 16) throw invalid();
      size = view.getUint32(p + 8) * 2 ** 32 + view.getUint32(p + 12);
      header = 16;
    } else if (size === 0) size = end - p;
    if (!Number.isSafeInteger(size) || size < header || size > end - p) throw invalid();
    list.push({ start: p, end: p + size, header, kind });
    p += size;
  }
  return list;
}

/**
 * Lossless Fast Start for ordinary, non-fragmented MP4s.
 * Relocate moov before the first mdat and rewrite actual stco/co64 entries.
 * Never guess offsets or change compressed video/audio samples.
 */
export function prepararMp4ParaWeb(bytes: Uint8Array): { bytes: Uint8Array; otimizado: boolean } {
  const issue = validarMp4ParaWeb(bytes);
  if (!issue) return { bytes, otimizado: false };
  const top = boxes(bytes);
  const metadata = top.filter(b => b.kind === "moov");
  const media = top.filter(b => b.kind === "mdat");
  if (top[0]?.kind !== "ftyp" || metadata.length !== 1 || !media.length) throw invalid();
  const moov = metadata[0];
  if (moov.start < media[0].start) throw new Error(issue);
  // Reject layouts where absolute offsets outside the normal chunk tables may exist.
  if (top.some(b => !["ftyp", "free", "skip", "wide", "moov", "mdat"].includes(b.kind))) throw invalid();
  const order = top.filter(b => b !== moov);
  order.splice(order.indexOf(media[0]), 0, moov);
  let cursor = 0;
  const positions = new Map<Box, number>();
  for (const b of order) {
    positions.set(b, cursor);
    cursor += b.end - b.start;
  }
  const output = new Uint8Array(bytes.length);
  const out = new DataView(output.buffer);
  for (const b of order) {
    const dest = positions.get(b)!;
    output.set(bytes.subarray(b.start, b.end), dest);
    // A size-zero box extends to EOF, so make its length explicit after reordering.
    if (out.getUint32(dest) === 0) out.setUint32(dest, b.end - b.start);
  }
  const newMoov = positions.get(moov)!;
  let tables = 0;
  function visit(start: number, end: number, depth: number) {
    if (depth > 8) throw invalid();
    for (const b of boxes(output, start, end)) {
      if (unsupported.has(b.kind) && b.kind !== "meta") throw invalid();
      if (containers.has(b.kind)) {
        visit(b.start + b.header, b.end, depth + 1);
      } else if (b.kind === "stco" || b.kind === "co64") {
        const p = b.start + b.header;
        if (b.end - p < 8 || out.getUint32(p) !== 0) throw invalid();
        const count = out.getUint32(p + 4);
        const width = b.kind === "stco" ? 4 : 8;
        if (!count || count * width !== b.end - p - 8) throw invalid();
        tables++;
        for (let i = 0; i < count; i++) {
          const at = p + 8 + i * width;
          const old = width === 4 ? out.getUint32(at) : out.getUint32(at) * 2 ** 32 + out.getUint32(at + 4);
          const target = media.find(m => old >= m.start + m.header && old < m.end);
          if (!target) throw invalid();
          const next = positions.get(target)! + old - target.start;
          if (width === 4) out.setUint32(at, next);
          else { out.setUint32(at, Math.floor(next / 2 ** 32)); out.setUint32(at + 4, next % 2 ** 32); }
        }
      }
    }
  }
  visit(newMoov + moov.header, newMoov + moov.end - moov.start, 0);
  if (!tables) throw invalid();
  const remaining = validarMp4ParaWeb(output);
  if (remaining) throw new Error(remaining);
  return { bytes: output, otimizado: true };
}
