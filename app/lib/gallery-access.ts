import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

const TTL_SEGUNDOS = 60 * 60;

function segredoAtual() {
  const dedicado = process.env.GALLERY_SESSION_SECRET?.trim();
  if (dedicado) return dedicado;

  const legado = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!legado) throw new Error("GALLERY_SESSION_SECRET ausente");
  return legado;
}

function segredosParaValidacao() {
  const segredos = [
    process.env.GALLERY_SESSION_SECRET?.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  ].filter((valor): valor is string => Boolean(valor));

  return Array.from(new Set(segredos));
}

export function nomeCookieGaleria(galeria: string) {
  return `fotura_gallery_${galeria.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function assinaturaComSegredo(galeria: string, expira: number, segredo: string) {
  return createHmac("sha256", segredo).update(`${galeria}.${expira}`).digest("hex");
}

export function criarTokenGaleria(galeria: string) {
  const expira = Math.floor(Date.now() / 1000) + TTL_SEGUNDOS;
  const assinatura = assinaturaComSegredo(galeria, expira, segredoAtual());
  return { valor: `${expira}.${assinatura}`, maxAge: TTL_SEGUNDOS };
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

  const recebidaBuffer = Buffer.from(recebida, "hex");
  return segredosParaValidacao().some((segredo) => {
    const esperada = assinaturaComSegredo(galeria, expira, segredo);
    const esperadaBuffer = Buffer.from(esperada, "hex");
    return recebidaBuffer.length === esperadaBuffer.length && timingSafeEqual(recebidaBuffer, esperadaBuffer);
  });
}
