import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

const TTL_SEGUNDOS = 60 * 60;

function segredo() {
  const valor = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!valor) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  return valor;
}

export function nomeCookieGaleria(galeria: string) {
  return `fotura_gallery_${galeria.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function assinatura(galeria: string, expira: number) {
  return createHmac("sha256", segredo()).update(`${galeria}.${expira}`).digest("hex");
}

export function criarTokenGaleria(galeria: string) {
  const expira = Math.floor(Date.now() / 1000) + TTL_SEGUNDOS;
  return { valor: `${expira}.${assinatura(galeria, expira)}`, maxAge: TTL_SEGUNDOS };
}

export function temAcessoGaleria(req: NextRequest, galeria: string) {
  const valor = req.cookies.get(nomeCookieGaleria(galeria))?.value;
  if (!valor) return false;
  const [expiraTxt, recebida] = valor.split(".");
  const expira = Number(expiraTxt);
  if (!Number.isFinite(expira) || expira < Math.floor(Date.now() / 1000) || !recebida) return false;
  const esperada = assinatura(galeria, expira);
  const a = Buffer.from(recebida, "hex");
  const b = Buffer.from(esperada, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
