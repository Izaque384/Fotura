import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

const TTL_SEGUNDOS = 60 * 60;

function segredo() {
  const valor = process.env.GALLERY_SESSION_SECRET?.trim();
  if (!valor) throw new Error("GALLERY_SESSION_SECRET ausente");
  return valor;
}

export function hashDownloadPin(pin: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verificarDownloadPin(pin: string, armazenado: string | null | undefined) {
  if (!armazenado) return false;
  const [algoritmo, salt, hash] = armazenado.split("$");
  if (algoritmo !== "scrypt" || !salt || !/^[a-f0-9]{64}$/i.test(hash || "")) return false;
  const esperado = Buffer.from(hash, "hex");
  const recebido = scryptSync(pin, salt, 32);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

export function nomeCookieDownload(galeria: string) {
  return `fotura_download_${galeria.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function assinatura(galeria: string, expira: number) {
  return createHmac("sha256", segredo()).update(`download.${galeria}.${expira}`).digest("hex");
}

export function criarTokenDownload(galeria: string) {
  const expira = Math.floor(Date.now() / 1000) + TTL_SEGUNDOS;
  return { valor: `${expira}.${assinatura(galeria, expira)}`, maxAge: TTL_SEGUNDOS };
}

export function temAcessoDownload(req: NextRequest, galeria: string) {
  const valor = req.cookies.get(nomeCookieDownload(galeria))?.value;
  if (!valor) return false;
  const [expiraTexto, recebida] = valor.split(".");
  const expira = Number(expiraTexto);
  if (!Number.isInteger(expira) || expira < Math.floor(Date.now() / 1000) || !/^[a-f0-9]{64}$/i.test(recebida || "")) return false;
  const esperada = assinatura(galeria, expira);
  const a = Buffer.from(recebida, "hex");
  const b = Buffer.from(esperada, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
