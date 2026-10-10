import { createHmac, timingSafeEqual } from "crypto";

export type GalleryWatermarkToken = {
  g: string;
  u: string;
  f: string;
  t: string;
  o: number;
  e: number;
};

function secret() {
  const value = process.env.GALLERY_SESSION_SECRET?.trim();
  if (!value) throw new Error("GALLERY_SESSION_SECRET ausente");
  return value;
}

function sign(encoded: string) {
  return createHmac("sha256", secret()).update(`watermark.${encoded}`).digest("hex");
}

export function createGalleryWatermarkUrl(input: Omit<GalleryWatermarkToken, "e">) {
  const now = Math.floor(Date.now() / 1000);
  const endOfHour = (Math.floor(now / 3600) + 1) * 3600;
  const payload: GalleryWatermarkToken = {
    ...input,
    t: input.t.trim().slice(0, 80) || "FOTURA",
    o: Math.min(70, Math.max(5, Math.round(input.o))),
    e: endOfHour + 300,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `/api/fotos/watermark?token=${encodeURIComponent(`${encoded}.${sign(encoded)}`)}`;
}

export function verifyGalleryWatermarkToken(token: string | null | undefined) {
  if (!token || token.length > 2500) return null;
  const split = token.lastIndexOf(".");
  if (split <= 0) return null;
  const encoded = token.slice(0, split);
  const received = token.slice(split + 1);
  if (!/^[a-f0-9]{64}$/i.test(received)) return null;
  const expected = sign(encoded);
  const a = Buffer.from(received, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const p = parsed as Partial<GalleryWatermarkToken>;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(p.g || "") || !uuid.test(p.u || "")) return null;
  if (typeof p.f !== "string" || p.f.length < 1 || p.f.length > 300 || p.f.includes("/") || p.f.includes("\\") || /[\u0000-\u001f\u007f]/.test(p.f)) return null;
  if (typeof p.t !== "string" || p.t.length < 1 || p.t.length > 80) return null;
  if (!Number.isInteger(p.o) || (p.o as number) < 5 || (p.o as number) > 70) return null;
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(p.e) || (p.e as number) < now || (p.e as number) > now + 4500) return null;
  return p as GalleryWatermarkToken;
}
