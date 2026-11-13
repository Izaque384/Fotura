import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../lib/supabase-server";
import { requisicaoMesmoOrigin } from "../../../lib/request-security";
import { consumirRateLimit } from "../../../lib/rate-limit";
import { selectedMediaUploadProvider } from "../../../lib/r2-aux-media";
import { r2PhysicalKey, signPrivateR2ObjectUrl } from "../../../lib/r2-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LOGO = 5 * 1024 * 1024;
const LOGO_MIME: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
};
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

/** Logos up to 5 MB upload directly from the browser to private R2.
 * Vercel Functions cap bodies at 4.5 MB, so the server only exchanges small
 * permissions/metadata and verifies HEAD before publishing the public path.
 */
export async function GET() {
  const provider = selectedMediaUploadProvider();
  return provider === "unavailable"
    ? json({ error: "Armazenamento R2 indisponível; nenhum arquivo foi enviado." }, 503)
    : json({ provider });
}

export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return json({ error: "Origem inválida." }, 403);
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Não autorizado." }, 401);
  const db = createServiceClient();
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Não autorizado." }, 401);
  if (!await consumirRateLimit(req, "studio_logo_upload", auth.user.id, 3600, 40)) {
    return json({ error: "Limite de operações de logotipo atingido." }, 429);
  }
  if (selectedMediaUploadProvider() !== "r2") {
    return json({ error: "Envio R2 não habilitado." }, 404);
  }
  const raw = await req.text().catch(() => "");
  if (!raw || raw.length > 2048) return json({ error: "Requisição inválida." }, 400);
  let body: { acao?: string; mime?: string; bytes?: number; path?: string };
  try {
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw Error("Invalid");
  } catch { return json({ error: "Dados inválidos." }, 400); }

  const owner = auth.user.id;
  if (body.acao === "preparar") {
    if (typeof body.mime !== "string" || !LOGO_MIME[body.mime] ||
        !Number.isSafeInteger(body.bytes) || !body.bytes ||
        body.bytes < 1 || body.bytes > MAX_LOGO) {
      return json({ error: "Use PNG, JPG ou WebP de até 5 MB." }, 400);
    }
    const key = owner + "/" + randomUUID() + "." + LOGO_MIME[body.mime];
    const { error: reservationError } = await db.from("fotura_r2_upload_reservations").insert({
      bucket: "marca", object_key: key, thumbnail_key: null,
      owner_id: owner, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    if (reservationError) return json({ error: "Não foi possível reservar o envio do logotipo." }, 503);
    return json({
      path: key,
      url: signPrivateR2ObjectUrl("PUT", r2PhysicalKey("marca", key), 300, body.mime, [], true),
      contentType: body.mime,
    });
  }
  if (body.acao === "confirmar") {
    const key = body.path;
    if (typeof key !== "string" || !new RegExp("^" + owner +
        "/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(png|jpg|webp)$").test(key)) {
      return json({ error: "Caminho de logotipo inválido." }, 400);
    }
    const { data: reservation, error: reservationError } = await db
      .from("fotura_r2_upload_reservations")
      .select("id").eq("bucket", "marca").eq("object_key", key)
      .eq("owner_id", owner).eq("state", "pending")
      .gt("expires_at", new Date().toISOString()).maybeSingle();
    if (reservationError || !reservation) {
      return json({ error: "A reserva do logotipo expirou ou foi cancelada." }, 409);
    }
    try {
      const response = await fetch(
        signPrivateR2ObjectUrl("HEAD", r2PhysicalKey("marca", key), 60),
        { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(12_000) }
      );
      if (!response.ok) return json({ error: "O arquivo R2 ainda não foi recebido." }, 422);
      const mime = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
      const bytes = Number(response.headers.get("content-length"));
      if (!LOGO_MIME[mime] || !key.endsWith("." + LOGO_MIME[mime]) ||
          !Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_LOGO) {
        return json({ error: "O logotipo não passou na verificação de integridade." }, 422);
      }
      const { data: logoUrl, error: registryError } = await db.rpc("registrar_logo_r2_backend", {
        p_user_id: owner, p_key: key, p_bytes: bytes, p_mime: mime,
        p_etag: response.headers.get("etag")?.slice(0, 250) ?? null,
      });
      if (registryError || logoUrl !== "/api/marca/" + key) {
        return json({ error: "Não foi possível registrar o logotipo." }, 503);
      }
      return json({ ok: true, logoUrl });
    } catch {
      // Keep the reserved object for timed, verified cleanup. Never delete
      // a potentially confirmed logo based on a transient network error.
      return json({ error: "Falha ao confirmar o logotipo no R2." }, 503);
    }
  }
  return json({ error: "Operação inválida." }, 400);
}
