import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../lib/supabase-server";
import { requisicaoMesmoOrigin } from "../../../lib/request-security";
import { consumirRateLimit } from "../../../lib/rate-limit";
import { putVerifiedAuxiliaryMedia, selectedMediaUploadProvider } from "../../../lib/r2-aux-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LOGO = 5 * 1024 * 1024;
const LOGO_MIME: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
};
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

/** Verified R2 media stays private: the stored URL points to a stable
 * studio-scoped public route which serves only the CURRENT profile logo.
 * The old Supabase public URL is preserved while migration is disabled.
 */
export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return json({ error: "Origem inválida." }, 403);
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Não autorizado." }, 401);
  const db = createServiceClient();
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Não autorizado." }, 401);
  if (!await consumirRateLimit(req, "studio_logo_upload", auth.user.id, 3600, 15)) {
    return json({ error: "Limite de atualizações de logotipo atingido." }, 429);
  }
  const provider = selectedMediaUploadProvider();
  if (provider === "unavailable") return json({
    error: "Armazenamento R2 indisponível. Nenhum logotipo foi enviado.",
  }, 503);
  let form: FormData;
  try { form = await req.formData(); }
  catch { return json({ error: "Imagem inválida." }, 400); }
  const image = form.get("arquivo");
  if (!(image instanceof File) || !LOGO_MIME[image.type] ||
      image.size < 1 || image.size > MAX_LOGO) {
    return json({ error: "Use PNG, JPG ou WebP de até 5 MB." }, 400);
  }
  const owner = auth.user.id;
  const key = owner + "/" + randomUUID() + "." + LOGO_MIME[image.type];
  try {
    if (provider === "r2") {
      const { error: reservationError } = await db.from("fotura_r2_upload_reservations").insert({
        bucket: "marca", object_key: key, thumbnail_key: null, owner_id: owner,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      if (reservationError) throw reservationError;
      const verified = await putVerifiedAuxiliaryMedia(
        "marca", key, new Uint8Array(await image.arrayBuffer()), image.type
      );
      const { data: url, error: registerError } = await db.rpc("registrar_logo_r2_backend", {
        p_user_id: owner, p_key: key, p_bytes: image.size,
        p_mime: image.type, p_etag: verified.etag,
      });
      if (registerError || typeof url !== "string" ||
          url !== "/api/marca/" + key) {
        throw registerError ?? new Error("O banco não confirmou o logotipo R2.");
      }
      return json({ ok: true, logoUrl: url });
    }

    // Legacy route only while the explicit R2 cutover is OFF. No R2-mode
    // upload may silently return to Supabase after an R2 error.
    const { error: uploadError } = await db.storage.from("marca").upload(key, image, {
      contentType: image.type, upsert: false,
    });
    if (uploadError) throw uploadError;
    const { data } = db.storage.from("marca").getPublicUrl(key);
    const url = data.publicUrl;
    const { error: profileError } = await db.from("perfis").upsert({
      id: owner, logo_url: url, atualizado_em: new Date().toISOString(),
    });
    if (profileError) throw profileError;
    return json({ ok: true, logoUrl: url });
  } catch {
    // Do not erase a possibly committed logo after an uncertain DB response.
    // R2 reservations cover unconfirmed objects for later verified cleanup.
    return json({ error: "Não foi possível confirmar o novo logotipo." }, 503);
  }
}
