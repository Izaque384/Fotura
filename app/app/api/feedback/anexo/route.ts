import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { selectedMediaUploadProvider } from "../../../../lib/r2-aux-media";
import { r2PhysicalKey, signPrivateR2ObjectUrl } from "../../../../lib/r2-storage";
import { readBoundedRequestText, RequestBodyTooLargeError } from "../../../../lib/limited-request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_ARQUIVO = 5 * 1024 * 1024;
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

function nomeSeguro(nome: string) {
  const base = nome.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return base.slice(0, 100) || "screenshot";
}

/** The browser asks where to store a screenshot before uploading any bytes. */
export async function GET() {
  const provider = selectedMediaUploadProvider();
  return provider === "unavailable"
    ? json({ error: "Armazenamento R2 indisponível." }, 503)
    : json({ provider });
}

/** No screenshot bytes pass through Vercel; only a short-lived PUT URL.
 * A later authenticated feedback submission verifies HEAD and commits the
 * feedback and private media registry in the same database transaction.
 */
export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return json({ error: "Origem inválida." }, 403);
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Não autorizado." }, 401);

  const db = createServiceClient();
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Não autorizado." }, 401);
  if (selectedMediaUploadProvider() !== "r2") {
    return json({ error: "Envio R2 de anexos não habilitado." }, 404);
  }
  if (!await consumirRateLimit(req, "feedback_attachment_prepare", auth.user.id, 3600, 18)) {
    return json({ error: "Muitas tentativas de envio de anexos." }, 429);
  }
  let raw: string;
  try {
    raw = await readBoundedRequestText(req, 2048);
  } catch (error) {
    return error instanceof RequestBodyTooLargeError
      ? json({ error: "Dados do anexo muito grandes." }, 413)
      : json({ error: "Dados inválidos." }, 400);
  }
  if (!raw) return json({ error: "Dados inválidos." }, 400);

  let body: { nome?: unknown; mime?: unknown; bytes?: unknown };
  try {
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw Error("invalid");
  } catch {
    return json({ error: "Dados inválidos." }, 400);
  }
  if (typeof body.nome !== "string" || body.nome.length > 255 ||
      typeof body.mime !== "string" || !MIME.has(body.mime) ||
      !Number.isSafeInteger(body.bytes) || Number(body.bytes) < 1 ||
      Number(body.bytes) > MAX_ARQUIVO) {
    return json({ error: "Use PNG, JPG ou WebP de até 5 MB." }, 400);
  }

  const owner = auth.user.id;
  const { count, error: countError } = await db.from("fotura_r2_upload_reservations")
    .select("id", { head: true, count: "exact" })
    .eq("bucket", "feedback-anexos").eq("owner_id", owner)
    .eq("state", "pending").gt("expires_at", new Date().toISOString());
  if (countError) return json({ error: "Não foi possível conferir as reservas." }, 503);
  if ((count ?? 0) >= 12) return json({ error: "Limite temporário de anexos pendentes atingido." }, 429);

  const nome = nomeSeguro(body.nome);
  const path = owner + "/" + randomUUID() + "-" + nome;
  const { error: reservationError } = await db.from("fotura_r2_upload_reservations")
    .insert({
      bucket: "feedback-anexos", object_key: path, thumbnail_key: null,
      owner_id: owner, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  if (reservationError) return json({ error: "Não foi possível reservar o envio do anexo." }, 503);
  return json({
    path, nome, contentType: body.mime,
    url: signPrivateR2ObjectUrl(
      "PUT", r2PhysicalKey("feedback-anexos", path), 300, body.mime, [], true
    ),
  });
}
