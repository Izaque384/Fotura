import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { readBoundedRequestText, RequestBodyTooLargeError } from "../../../../lib/limited-request-body";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { uuidValido } from "../../../../lib/validation";
import { contextoPlano, podeAdicionarFotos } from "../../../../lib/billing-usage";
import { listarCatalogoGaleriaHibrido } from "../../../../lib/gallery-media-catalog";
import { signPrivateR2ObjectUrl } from "../../../../lib/r2-storage";
import { selectedMediaUploadProvider } from "../../../../lib/r2-aux-media";
import { validarArquivo } from "../../../../lib/upload-validation";
import { R2_PART_BYTES, beginR2Multipart, signedR2PartUrl, listR2MultipartParts, finishR2Multipart, abortR2Multipart } from "../../../../lib/r2-multipart";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_PILOT_ORIGINAL = 50 * 1024 * 1024;
const MAX_THUMB = 4 * 1024 * 1024;
const EXPIRES_SECONDS = 300;
const TICKET_SECONDS = 24 * 60 * 60;
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

/**
 * Pilot is intentionally PREVIEW ONLY. Do not remove this environment gate
 * until large-file resumability, movement, lifecycle cleanup and quotas are
 * reviewed and all real gallery flows pass in a separate test project.
 */
function available() {
  // Photos, videos and auxiliary media MUST share one release gate.
  // A partially configured production cutover fails closed everywhere.
  return selectedMediaUploadProvider() === "r2";
}

type Variant = "principal" | "entrega";
type Ticket = {
  u: string; g: string; v: Variant; n: string;
  bytes: number; thumbBytes: number; mime: string; exp: number; uploadId?: string;
};
type Incoming = {
  acao?: "preparar" | "verificar" | "confirmar" | "cancelar" | "multipart_iniciar" | "multipart_parte" | "multipart_listar" | "multipart_resumir" | "multipart_concluir" | "multipart_abortar";
  galeria?: string; variante?: Variant;
  nome?: string; bytes?: number; mimeType?: string;
  thumbBytes?: number; ticket?: string; partNumber?: number;
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
        parsed.exp < Date.now() || parsed.exp > Date.now() + (TICKET_SECONDS + 60) * 1000 ||
        (parsed.v !== "principal" && parsed.v !== "entrega") ||
        !/^[0-9a-f-]{36}-[A-Za-z0-9._-]{1,190}$/.test(parsed.n) ||
        !Number.isSafeInteger(parsed.bytes) || parsed.bytes <= 0 || parsed.bytes > MAX_PILOT_ORIGINAL ||
        !Number.isSafeInteger(parsed.thumbBytes) || parsed.thumbBytes <= 0 || parsed.thumbBytes > MAX_THUMB ||
        !["image/jpeg", "image/png", "image/webp"].includes(parsed.mime) ||
        (parsed.uploadId !== undefined &&
          (typeof parsed.uploadId !== "string" || parsed.uploadId.length === 0 ||
           parsed.uploadId.length > 512 || /[\u0000-\u001f\u007f<>]/.test(parsed.uploadId)))) return null;
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

export async function GET() {
  // Provider selection is atomic for an upload session. If R2 was requested
  // but is not ready, fail closed instead of silently reverting to Supabase.
  const requested = process.env.FOTURA_R2_UPLOAD_ENABLED === "true" ||
    process.env.FOTURA_R2_FINAL_CUTOVER === "true";
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
  if (!requisicaoMesmoOrigin(req)) return json({ error: "Origem inválida." }, 403);
  if (!available()) return json({ error: "Envio R2 ainda não habilitado." }, 404);

  const auth = await authenticate(req);
  if (!auth) return json({ error: "Não autorizado." }, 401);
  if (!await consumirRateLimit(req, "r2_photo_write", auth.user.id, 600, 150)) {
    return json({ error: "Limite de solicitações atingido." }, 429);
  }

  let raw: string;
  try { raw = await readBoundedRequestText(req, 8192); }
  catch (error) {
    return error instanceof RequestBodyTooLargeError
      ? json({ error: "Requisição muito grande." }, 413)
      : json({ error: "Dados inválidos." }, 400);
  }
  let body: Incoming;
  try {
    body = JSON.parse(raw) as Incoming;
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Dados inválidos." }, 400);
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

    // Bound reserved-but-unconfirmed uploads to avoid exhausting R2 storage
    // and bypassing photo/storage quotas with many simultaneous PUT URLs.
    const { count: pendingCount, error: pendingError } = await auth.db
      .from("fotura_r2_upload_reservations")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", auth.user.id).eq("state", "pending")
      .gt("expires_at", new Date().toISOString());
    if (pendingError) return json({ error: "Não foi possível verificar os envios pendentes." }, 503);
    if ((pendingCount ?? 0) >= 25) return json({
      error: "Há muitos envios aguardando confirmação. Conclua ou cancele os anteriores.",
    }, 429);

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
        exp: Date.now() + TICKET_SECONDS * 1000,
      };
      const key = paths(ticket);
      const { error: reserveError } = await auth.db.from("fotura_r2_upload_reservations").insert({
        bucket: "fotos", object_key: key.original, thumbnail_key: key.thumb,
        owner_id: auth.user.id, expires_at: new Date(ticket.exp).toISOString(),
      });
      if (reserveError) throw reserveError;
      return json({
        nome: name, ticket: createTicket(ticket),
        original: { url: signPrivateR2ObjectUrl("PUT", key.original, EXPIRES_SECONDS, ticket.mime, [], true), contentType: ticket.mime },
        thumb: { url: signPrivateR2ObjectUrl("PUT", key.thumb, EXPIRES_SECONDS, "image/jpeg", [], true), contentType: "image/jpeg" },
      });
    } catch {
      return json({ error: "Falha ao preparar o envio." }, 503);
    }
  }

  if (body.acao?.startsWith("multipart_")) {
    const ticket = validateTicket(body.ticket);
    if (!ticket || ticket.u !== auth.user.id) return json({ error: "Autorização de upload inválida." }, 403);
    if (!await galleryAllowed(auth.db, auth.user.id, ticket.g, ticket.v)) {
      return json({ error: "Galeria indisponível." }, 403);
    }
    if (ticket.bytes <= R2_PART_BYTES) return json({ error: "Multipartes reservado a arquivos grandes." }, 400);
    const key = paths(ticket).original;
    try {
      const { data: registered, error: dbError } = await auth.db.from("fotura_media_objects")
        .select("bytes").eq("bucket", "fotos").eq("object_key", key).maybeSingle();
      if (dbError) throw dbError;
      if (registered) {
        if (body.acao === "multipart_resumir" && registered.bytes === ticket.bytes) {
          return json({ ok: true, registered: true, nome: ticket.n });
        }
        return json({ error: "O objeto já foi registrado." }, 409);
      }

      if (body.acao === "multipart_iniciar") {
        if (ticket.uploadId) return json({ error: "Transferência já iniciada." }, 409);
        const uploadId = await beginR2Multipart(key, ticket.mime);
        const { data: reservation, error: reserveError } = await auth.db
          .from("fotura_r2_upload_reservations")
          .update({ upload_id: uploadId })
          .eq("bucket", "fotos").eq("object_key", key).eq("owner_id", auth.user.id)
          .eq("state", "pending").is("upload_id", null)
          .select("id").maybeSingle();
        if (reserveError || !reservation) {
          await abortR2Multipart(key, uploadId).catch(() => {});
          return json({ error: "Não foi possível preservar o estado da transferência." }, 503);
        }
        return json({
          ok: true, nome: ticket.n, ticket: createTicket({ ...ticket, uploadId }),
          partBytes: R2_PART_BYTES, totalParts: Math.ceil(ticket.bytes / R2_PART_BYTES),
        });
      }
      if (!ticket.uploadId) return json({ error: "Transferência não iniciada." }, 409);
      const { data: reserved, error: reserveError } = await auth.db.from("fotura_r2_upload_reservations")
        .select("upload_id").eq("bucket", "fotos").eq("object_key", key)
        .eq("owner_id", auth.user.id).eq("state", "pending").maybeSingle();
      if (reserveError || !reserved || reserved.upload_id !== ticket.uploadId) {
        return json({ error: "A transferência não está mais autorizada." }, 409);
      }

      if (body.acao === "multipart_parte") {
        const number = body.partNumber;
        const total = Math.ceil(ticket.bytes / R2_PART_BYTES);
        if (!Number.isInteger(number) || !number || number < 1 || number > total) {
          return json({ error: "Número de parte inválido." }, 400);
        }
        return json({
          url: signedR2PartUrl(key, ticket.uploadId, number),
          partNumber: number, bytes: Math.min(R2_PART_BYTES, ticket.bytes - (number - 1) * R2_PART_BYTES),
        });
      }
      if (body.acao === "multipart_resumir") {
        const head = await headObject(key);
        const completed = Boolean(head && head.bytes === ticket.bytes && head.type === ticket.mime);
        const parts = completed ? [] : await listR2MultipartParts(key, ticket.uploadId);
        return json({
          ok: true, nome: ticket.n, completed,
          parts: parts.map((item) => ({ number: item.partNumber, bytes: item.bytes })),
          thumb: {
            url: signPrivateR2ObjectUrl(
              "PUT", paths(ticket).thumb, EXPIRES_SECONDS, "image/jpeg", [], true
            ),
            contentType: "image/jpeg",
          },
          partBytes: R2_PART_BYTES,
        });
      }
      if (body.acao === "multipart_listar") {
        const parts = await listR2MultipartParts(key, ticket.uploadId);
        return json({ ok: true, parts: parts.map((item) => ({
          number: item.partNumber, bytes: item.bytes,
        })) });
      }
      if (body.acao === "multipart_concluir") {
        const previous = await headObject(key);
        if (!previous) {
          await finishR2Multipart(key, ticket.uploadId, ticket.bytes);
        }
        const ready = await headObject(key);
        if (!ready || ready.bytes !== ticket.bytes || ready.type !== ticket.mime) {
          return json({ error: "O arquivo concluído não passou na conferência." }, 422);
        }
        return json({ ok: true, nome: ticket.n, bytes: ready.bytes });
      }
      if (body.acao === "multipart_abortar") {
        await abortR2Multipart(key, ticket.uploadId);
        return json({ ok: true });
      }
    } catch {
      return json({ error: "Não foi possível operar a transferência multipartes." }, 503);
    }
    return json({ error: "Operação multipartes inválida." }, 400);
  }

  if (body.acao === "verificar") {
    // An ambiguous browser PUT can succeed at R2 and lose its HTTP reply.
    // Read-only reconciliation, scoped by owner + signed ticket + live
    // reservation. An HTTP 412 (create-only) is never enough to declare
    // success without checking the exact MIME and byte count via HEAD.
    const ticket = validateTicket(body.ticket);
    if (!ticket || ticket.u !== auth.user.id) {
      return json({ error: "Autorização de upload inválida." }, 403);
    }
    if (!await galleryAllowed(auth.db, auth.user.id, ticket.g, ticket.v)) {
      return json({ error: "Pasta indisponível." }, 403);
    }
    const key = paths(ticket);
    const { data: reserved, error: reserveError } = await auth.db
      .from("fotura_r2_upload_reservations")
      .select("id").eq("bucket", "fotos").eq("object_key", key.original)
      .eq("owner_id", auth.user.id).eq("state", "pending")
      .gt("expires_at", new Date().toISOString()).maybeSingle();
    const { data: registered, error: registryError } = await auth.db
      .from("fotura_media_objects")
      .select("object_key").eq("bucket", "fotos").eq("object_key", key.original)
      .eq("owner_id", auth.user.id).maybeSingle();
    if (reserveError || registryError) {
      return json({ error: "Não foi possível verificar o upload." }, 503);
    }
    if (!reserved && !registered) {
      return json({ error: "Reserva de upload não está mais válida." }, 409);
    }
    try {
      const [original, thumb] = await Promise.all([
        headObject(key.original), headObject(key.thumb),
      ]);
      return json({
        ok: true,
        original: Boolean(original && original.bytes === ticket.bytes && original.type === ticket.mime),
        thumb: Boolean(thumb && thumb.bytes === ticket.thumbBytes && thumb.type === "image/jpeg"),
        registered: Boolean(registered),
      });
    } catch {
      return json({ error: "R2 não respondeu à verificação do arquivo." }, 503);
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
        if (existing) return json({ error: "Arquivo já registrado; cancelamento negado." }, 409);
        // Invalidate the reservation atomically in PostgreSQL instead of
        // deleting directly from R2. A concurrent confirmation also locks this
        // row: whichever commits first wins. Immediate GET/DELETE/HEAD here
        // could delete a just-registered photo after a stale registry read.
        //
        // Existing signed URLs may still finish in flight for up to five
        // minutes. Let the leased orphan worker reclaim the entire upload
        // (original, thumbnail and incomplete multipart) only after 10 minutes.
        const { data: cancelled, error: pendingError } = await auth.db
          .from("fotura_r2_upload_reservations")
          .update({
            state: "cleaning",
            lease_token: null,
            lease_until: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          })
          .eq("bucket", "fotos").eq("object_key", key.original)
          .eq("owner_id", auth.user.id).eq("state", "pending")
          .select("id").maybeSingle();
        if (pendingError) return json({ error: "Não foi possível suspender o envio." }, 503);
        if (!cancelled) return json({ error: "Envio já concluído ou cancelado." }, 409);
        return json({ ok: true, cleanupScheduled: true });
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
