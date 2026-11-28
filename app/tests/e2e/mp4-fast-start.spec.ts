import { test, expect } from "@playwright/test";
import { prepararMp4ParaWeb } from "../../lib/mp4-fast-start";
import { validarMp4ParaWeb } from "../../lib/mp4-compatibility";

function join(...parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let pos = 0;
  for (const part of parts) { result.set(part, pos); pos += part.length; }
  return result;
}
function uint(value: number) {
  const result = new Uint8Array(4);
  new DataView(result.buffer).setUint32(0, value);
  return result;
}
function box(kind: string, ...parts: Uint8Array[]) {
  const data = join(...parts);
  return join(uint(data.length + 8), new TextEncoder().encode(kind), data);
}
function fixture(codec = "avc1", wide = false, offset = 24) {
  const ftyp = box("ftyp", new TextEncoder().encode("isom"), uint(0));
  const payload = new Uint8Array([19, 37, 55, 73, 91]);
  const mdat = box("mdat", payload);
  const stsd = box("stsd", uint(0), uint(1), box(codec, new Uint8Array(8)));
  const chunks = box(wide ? "co64" : "stco", uint(0), uint(1), ...(wide ? [uint(0)] : []), uint(offset));
  const moov = box("moov", box("trak", box("mdia", box("minf", box("stbl", stsd, chunks)))));
  return { bytes: join(ftyp, mdat, moov), payload, moov };
}
for (const wide of [false, true]) {
  test("Fast Start preserva dados e corrige " + (wide ? "co64" : "stco"), () => {
    const original = fixture("avc1", wide);
    expect(validarMp4ParaWeb(original.bytes)).toContain("Fast Start");
    const result = prepararMp4ParaWeb(original.bytes);
    expect(result.otimizado).toBe(true);
    expect(result.bytes.length).toBe(original.bytes.length);
    expect(validarMp4ParaWeb(result.bytes)).toBeNull();
    expect(result.bytes.slice(24 + original.moov.length)).toEqual(original.payload);
    const mark = new TextDecoder().decode(result.bytes).indexOf(wide ? "co64" : "stco");
    expect(new DataView(result.bytes.buffer).getUint32(mark + (wide ? 16 : 12))).toBe(24 + original.moov.length);
    expect(prepararMp4ParaWeb(result.bytes).bytes).toBe(result.bytes);
    expect(prepararMp4ParaWeb(result.bytes).otimizado).toBe(false);
  });
}
test("não libera codec incompatível ou offsets corrompidos", () => {
  expect(() => prepararMp4ParaWeb(fixture("hvc1").bytes)).toThrow();
  expect(() => prepararMp4ParaWeb(fixture("avc1", false, 1).bytes)).toThrow();
  expect(() => prepararMp4ParaWeb(new Uint8Array(32))).toThrow();
});
