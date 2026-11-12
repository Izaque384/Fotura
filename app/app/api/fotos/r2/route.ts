import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { uuidValido } from "../../../../lib/validation";
import { contextoPlano, podeAdicionarFotos } from "../../../../lib/billing-usage";
import { listarCatalogoGaleriaHibrido } from "../../../../lib/gallery-media-catalog";
import { signPrivateR2ObjectUrl, r2CredentialsPresent, isR2ReadEnabled } from "../../../../lib/r2-storage";
import { validarArquivo } from "../../../../lib/upload-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_PILOT_ORIGINAL = 50 * 1024 * 1024;
const MAX_THUMB = 4 * 1024 * 1024;
const EXPIRES_SECONDS = 300;
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

/**
 * Pilot is intentionally PREVIEW ONLY. Do not remove this environment gate
 * until large-file resumability, movement, lifecycle cleanup and quotas are
 * reviewed and all real gallery flows pass in a separate test project.
 */
function available() {
  return process.env.VERCEL_ENV === "preview" &&
    process.env.FOTURA_R2_UPLOAD_ENABLED === "true" &&
    isR2ReadEnabled() && r2CredentialsPresent();
}

type Variant = "principal" | "entrega";
type Ticket = {
  u: string; g: string; v: Variant; n: string;
  bytes: number; thumbBytes: number; mime: string; exp: number;
};
type Incoming = {
  acao?: "preparar" | "confirmar" | "cancelar";
  galeria?: string; variante?: Variant;
  nome?: string; bytes?: number; mimeType?: string;
  thumbBytes?: number; ticket?: string;
  largura?: number | null; altura?: number | null;
};

function hmac(payload: string) {
  const secret = process.env.R2_SECRET_ACCESS_KEY;
  if (!secret) throw new Error("R2 indisponível.");
  return createHmac("sha256", secret)
    .update("fotura-r2-photo-upload-ticket-v1:" + payload).digest("hex");
}

function createTicket(ticket: Ticket) {
  const body = Buffer.from(JSON.stringify(ticket), "utf8").toString("base64url");
  return body + "." + hmac(body);
}

function validateTicket(input: unknown): Ticket | null {
  if (typeof input !== "string" || input.length > 2048) return null;
  const i = input.lastIndexOf(".");
  if (i < 1) return null;
  const body = input.slice(0, i);
  const signature = input.slice(i + 1);
  if (!/^[a-f0-9]{64}$/.test(signature)) return null;
  const correct = hmac(body);
  if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(correct, "hex"))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Ticket;
    if (!uuidValido(parsed.u) || !uuidValido(parsed.g) || !Number.isSafeInteger(parsed.exp) ||
        parsed.exp < Date.now() || parsed.exp > Date.now() + 6 * 60_000 ||
        (parsed.v !== "principal" && parsed.v !== "entrega") ||
        !/^[0-9a-f-]{36}-[A-Za-z0-9._-]{1,190}$/.test(parsed.n) ||
        !Number.isSafeInteger(parsed.bytes) || parsed.bytes <= 0 || parsed.bytes > MAX_PILOT_ORIGINAL ||
        !Number.isSafeInteger(parsed.thumbBytes) || parsed.thumbBytes <= 0 || parsed.thumbBytes > MAX_THUMB ||
        !["image/jpeg", "image/png", "image/webp"].includes(parsed.mime)) return null;
    return parsed;
  } catch { return null; }
}

function paths(t: Ticket) {
  const base = t.u + "/" + t.g + "/" + (t.v === "entrega" ? "entrega/" : "");
  return { original: base + t.n, thumb: base + "thumbs/" + t.n };
}

async function authenticate(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return null;
  const db = createServiceClient();
  const { data, error } = await db.auth.getUser(bearer);
  return error || !data.user ? null : { db, user: data.user };
}

async function galleryAllowed(db: ReturnType<typeof createServiceClient>, userId: string, galleryId: string, variant: Variant) {
  const { data, error } = await db.from("galerias")
    .select("id,user_id,etapa,storage_limpo")
    .eq("id", galleryId).eq("user_id", userId).maybeSingle();
  if (error || !data || data.storage_limpo) return false;
  return variant !== "entrega" || ["preparando_entrega", "selecao_finalizada", "entrega"].includes(data.etapa);
}

async function headObject(key: string) {
  const response = await fetch(signPrivateR2ObjectUrl("HEAD", key, 60), {
    method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  return {
    bytes: Number(response.headers.get("content-length")),
    type: response.headers.get("content-type")?.split(";")[0].trim().toLowerCase(),
    etag: response.headers.get("etag")?.slice(0, 250) ?? null,
  };
}

async function deleteObject(key: string) {
  const response = await fetch(signPrivateR2ObjectUrl("DELETE", key, 60), {
    method: "DELETE", cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  return response.ok;
}

export async function GET() {
  // Provider selection is atomic for an upload session. If R2 was requested
  // but is not ready, fail closed instead of silently reverting to Supabase.
  const requested = process.env.FOTURA_R2_UPLOAD_ENABLED === "true";
  if (requested && !available()) {
    return json({ error: "Armazenamento R2 indisponível. Nenhum arquivo foi enviado." }, 503);
  }
  return json({
    enabled: requested,
    provider: requested ? "r2" : "supabase",
    maxSinglePutBytes: MAX_PILOT_ORIGINAL,
  });
}

export async function POST(req: NextRequest) {
  if (!available()) return json({ error: "Envio R2 ainda não habilitado." }, 404);
  if (!requisicaoMesmoOrigin(req)) return json({ error: "Origem inválida." }, 403);

  const auth = await authenticate(req);
  if (!auth) return json({ error: "Não autorizado." }, 401);
  if (!await consumirRateLimit(req, "r2_photo_write", auth.user.id, 600, 150)) {
    return json({ error: "Limite de solicitações atingido." }, 429);
  }

  let body: Incoming;
  try {
    const raw = await req.text();
    if (raw.length > 8192) return json({ error: "Requisição muito grande." }, 413);
    body = JSON.parse(raw) as Incoming;
  } catch { return json({ error: "Dados inválidos." }, 400); }

  if (body.acao === "preparar") {
    if (!uuidValido(body.galeria) || (body.variante !== "principal" && body.variante !== "entrega") ||
      typeof body.nome !== "string" || typeof body.mimeType !== "string" ||
      !Number.isSafeInteger(body.bytes) || !Number.isSafeInteger(body.thumbBytes) ||
      !body.bytes || !body.thumbBytes || body.bytes > MAX_PILOT_ORIGINAL || body.thumbBytes > MAX_THUMB ||
      validarArquivo({ name: body.nome, type: body.mimeType, size: body.bytes })) {
      return json({ error: "Foto inválida ou maior que o limite do piloto." }, 400);
    }
    const allowed = await galleryAllowed(auth.db, auth.user.id, body.galeria, body.variante);
    if (!allowed) return json({ error: "Pasta indisponível para envio." }, 403);

    try {
      const context = await contextoPlano(auth.db, auth.user.id);
      const { data: fairUse, error: fairUseError } = await auth.db.rpc("status_uso_justo_upload_backend", { p_user_id: auth.user.id });
      if (fairUseError || !fairUse || fairUse.bloqueado ||
          (Number(fairUse.limite_bytes) > 0 &&
           Number(fairUse.bytes_enviados || 0) + body.bytes > Number(fairUse.limite_bytes))) {
        return json({ error: "Franquia mensal de envios indisponível." }, 403);
      }

      const maxBytes = context.limites.armazenamento.limiteGb;
      if (maxBytes !== null && context.uso.armazenamentoBytes + body.bytes + body.thumbBytes > maxBytes * 1024 ** 3) {
        return json({ error: "Limite de armazenamento do plano atingido." }, 403);
      }

      const { data: catalog, error: catalogError } = await listarCatalogoGaleriaHibrido(
        auth.db, auth.user.id, body.galeria, body.variante
      );
      if (catalogError || !catalog || !podeAdicionarFotos(context.plano, catalog.length, 1)) {
        return json({ error: "Não foi possível validar o limite de fotos da pasta." }, 403);
      }

      const originalName = body.nome.trim();
      const extension = originalName.slice(originalName.lastIndexOf(".")).toLowerCase();
      const stem = originalName.slice(0, -extension.length).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 150);
      const name = randomUUID() + "-" + (stem || "foto") + extension;
      const ticket: Ticket = {
        u: auth.user.id, g: body.galeria, v: body.variante, n: name,
        bytes: body.bytes, thumbBytes: body.thumbBytes, mime: body.mimeType,
        exp: Date.now() + EXPIRES_SECONDS * 1000,
      };
      const key = paths(ticket);
      return json({
        nome: name, ticket: createTicket(ticket),
        original: { url: signPrivateR2ObjectUrl("PUT", key.original, EXPIRES_SECONDS, ticket.mime), contentType: ticket.mime },
        thumb: { url: signPrivateR2ObjectUrl("PUT", key.thumb, EXPIRES_SECONDS, "image/jpeg"), contentType: "image/jpeg" },
      });
    } catch {
      return json({ error: "Falha ao preparar o envio." }, 503);
    }
  }

  if (body.acao === "confirmar" || body.acao === "cancelar") {
    const ticket = validateTicket(body.ticket);
    if (!ticket || ticket.u !== auth.user.id) return json({ error: "Permissão de upload inválida." }, 403);

    const key = paths(ticket);
    if (!await galleryAllowed(auth.db, auth.user.id, ticket.g, ticket.v)) {
      return json({ error: "Pasta indisponível." }, 403);
    }
    try {
      const { data: existing, error } = await auth.db.from("fotura_media_objects")
        .select("object_key,bytes").eq("bucket", "fotos").eq("object_key", key.original).maybeSingle();
      if (error) throw error;

      if (body.acao === "cancelar") {
        // Never delete a confirmed object; only clean a pending random filename.
        if (existing) return json({ error: "Arquivo já registrado; cancelamento negado." }, 409);
        const removed = await Promise.allSettled([deleteObject(key.original), deleteObject(key.thumb)]);
        return json({ ok: removed.every((x) => x.status === "fulfilled" && x.value) });
      }

      if (existing) return existing.bytes === ticket.bytes
        ? json({ ok: true, nome: ticket.n, repetido: true })
        : json({ error: "Arquivo já registrado com outro tamanho." }, 409);

      const [original, thumb] = await Promise.all([headObject(key.original), headObject(key.thumb)]);
      if (!original || original.bytes !== ticket.bytes || original.type !== ticket.mime ||
          !thumb || thumb.bytes !== ticket.thumbBytes || thumb.type !== "image/jpeg") {
        return json({ error: "Não foi possível confirmar a integridade dos arquivos enviados." }, 422);
      }

      // Quotas must also be checked on confirmation, not only when the
      // five-minute PUT URL is issued. This avoids a stale preflight approval.
      const current = await contextoPlano(auth.db, auth.user.id);
      const { data: currentFairUse, error: currentFairUseError } = await auth.db.rpc(
        "status_uso_justo_upload_backend", { p_user_id: auth.user.id }
      );
      if (currentFairUseError || !currentFairUse || currentFairUse.bloqueado ||
          (Number(currentFairUse.limite_bytes) > 0 &&
           Number(currentFairUse.bytes_enviados || 0) + ticket.bytes > Number(currentFairUse.limite_bytes))) {
        return json({ error: "Franquia mensal de envios atingida." }, 403);
      }
      const quotaGb = current.limites.armazenamento.limiteGb;
      if (quotaGb !== null &&
          current.uso.armazenamentoBytes + ticket.bytes + ticket.thumbBytes > quotaGb * 1024 ** 3) {
        return json({ error: "Limite de armazenamento atingido." }, 403);
      }
      const counted = await listarCatalogoGaleriaHibrido(auth.db, auth.user.id, ticket.g, ticket.v);
      if (counted.error || !counted.data || !podeAdicionarFotos(current.plano, counted.data.length, 1)) {
        return json({ error: "Limite de fotos da pasta atingido." }, 403);
      }

      const width = Number.isInteger(body.largura) && Number(body.largura) > 0 && Number(body.largura) <= 50000 ? body.largura : null;
      const height = Number.isInteger(body.altura) && Number(body.altura) > 0 && Number(body.altura) <= 50000 ? body.altura : null;
      const { data, error: registerError } = await auth.db.rpc("registrar_foto_r2_upload_backend", {
        p_user_id: ticket.u, p_galeria_id: ticket.g, p_variante: ticket.v, p_nome: ticket.n,
        p_bytes: ticket.bytes, p_thumb_bytes: ticket.thumbBytes, p_mime_type: ticket.mime,
        p_etag: original.etag, p_thumb_etag: thumb.etag, p_largura: width, p_altura: height,
      });
      if (registerError || data !== true) throw registerError || new Error("Falha ao registrar arquivo.");
      return json({ ok: true, nome: ticket.n });
    } catch {
      return json({ error: "Não foi possível finalizar o envio R2." }, 503);
    }
  }
  return json({ error: "Ação inválida." }, 400);
}
