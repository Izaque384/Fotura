import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

const TTL_SEGUNDOS = 60 * 60;

function segredoGaleria() {
  const valor = process.env.GALLERY_SESSION_SECRET?.trim();
  if (!valor) throw new Error("GALLERY_SESSION_SECRET ausente");
  return valor;
}

export function nomeCookieGaleria(galeria: string) {
  return `fotura_gallery_${galeria.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function assinatura(galeria: string, expira: number) {
  return createHmac("sha256", segredoGaleria()).update(`${galeria}.${expira}`).digest("hex");
}

export function criarTokenGaleria(galeria: string) {
  const expira = Math.floor(Date.now() / 1000) + TTL_SEGUNDOS;
  return { valor: `${expira}.${assinatura(galeria, expira)}`, maxAge: TTL_SEGUNDOS };
}

export function temAcessoGaleria(req: NextRequest, galeria: string) {
  const valor = req.cookies.get(nomeCookieGaleria(galeria))?.value;
  if (!valor) return false;

  const partes = valor.split(".");
  if (partes.length !== 2) return false;

  const [expiraTxt, recebida] = partes;
  const expira = Number(expiraTxt);
  if (!Number.isInteger(expira) || expira < Math.floor(Date.now() / 1000) || !/^[a-f0-9]{64}$/i.test(recebida)) {
    return false;
  }

  const esperada = assinatura(galeria, expira);
  const recebidaBuffer = Buffer.from(recebida, "hex");
  const esperadaBuffer = Buffer.from(esperada, "hex");
  return recebidaBuffer.length === esperadaBuffer.length && timingSafeEqual(recebidaBuffer, esperadaBuffer);
}
