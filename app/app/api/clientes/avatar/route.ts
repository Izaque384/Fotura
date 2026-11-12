import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { uuidValido } from "../../../../lib/validation";
import { putVerifiedAuxiliaryMedia, selectedMediaUploadProvider } from "../../../../lib/r2-aux-media";
import { isR2ReadEnabled, r2PhysicalKey, signPrivateR2ObjectUrl } from "../../../../lib/r2-storage";
import { signPrivateMediaUrl } from "../../../../lib/media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AVATAR = 8 * 1024 * 1024;
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private" } });

async function auth(req: NextRequest) {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const db = createServiceClient();
  const { data, error } = await db.auth.getUser(token);
  return error || !data.user ? null : { db, user: data.user };
}

export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return json({ error: "Origem inválida." }, 403);
  const actor = await auth(req);
  if (!actor) return json({ error: "Não autorizado." }, 401);
  if (!await consumirRateLimit(req, "client_avatar_upload", actor.user.id, 3600, 30)) {
    return json({ error: "Muitas tentativas de envio." }, 429);
  }
  const provider = selectedMediaUploadProvider();
  if (provider === "unavailable") return json({
    error: "Armazenamento R2 indisponível; nenhum avatar foi enviado.",
  }, 503);
  let form: FormData;
  try { form = await req.formData(); } catch { return json({ error: "Formulário inválido." }, 400); }
  const clientId = form.get("cliente");
  const avatar = form.get("arquivo");
  if (typeof clientId !== "string" || !uuidValido(clientId) ||
    !(avatar instanceof File) || avatar.type !== "image/webp" ||
    avatar.size < 1 || avatar.size > MAX_AVATAR) {
    return json({ error: "Avatar inválido. Use WebP de até 8 MB." }, 400);
  }
  const { data: client, error: lookupError } = await actor.db.from("clientes")
    .select("id").eq("id", clientId).eq("user_id", actor.user.id).maybeSingle();
  if (lookupError || !client) return json({ error: "Cliente não pertence à conta." }, 403);

  const path = actor.user.id + "/" + clientId + "/" + randomUUID() + ".webp";
  try {
    if (provider === "r2") {
      const { error: reserveError } = await actor.db.from("fotura_r2_upload_reservations")
        .insert({
          bucket: "client-avatars", object_key: path,
          thumbnail_key: null, owner_id: actor.user.id,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
      if (reserveError) throw reserveError;
      const verified = await putVerifiedAuxiliaryMedia(
        "client-avatars", path, new Uint8Array(await avatar.arrayBuffer()), avatar.type
      );
      const { error: registerError } = await actor.db.rpc("registrar_avatar_r2_backend", {
        p_user_id: actor.user.id, p_cliente_id: clientId, p_key: path,
        p_bytes: avatar.size, p_etag: verified.etag,
      });
      if (registerError) throw registerError;
    } else {
      const { error: uploadError } = await actor.db.storage.from("client-avatars")
        .upload(path, avatar, { contentType: "image/webp", cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      const { error: dbError } = await actor.db.from("clientes")
        .update({ avatar_path: path }).eq("id", clientId).eq("user_id", actor.user.id);
      if (dbError) {
        await actor.db.storage.from("client-avatars").remove([path]);
        throw dbError;
      }
    }
    const url = await signPrivateMediaUrl(actor.db, "client-avatars", path, 3600);
    return json({ ok: true, path, url });
  } catch {
    // Never blindly delete an R2 object on an uncertain commit reply:
    // an unregistered upload is retained under the leased cleanup reservation.
    return json({ error: "Não foi possível concluir a atualização do avatar." }, 503);
  }
}

export async function DELETE(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return json({ error: "Origem inválida." }, 403);
  const actor = await auth(req);
  if (!actor) return json({ error: "Não autorizado." }, 401);
  const raw = await req.text().catch(() => "");
  if (raw.length > 2500) return json({ error: "Requisição muito grande." }, 413);
  let clientId: string;
  let path: string;
  try {
    const obj = JSON.parse(raw) as { cliente?: unknown; path?: unknown };
    clientId = String(obj.cliente);
    path = String(obj.path);
  } catch { return json({ error: "Dados inválidos." }, 400); }
  if (!uuidValido(clientId) || !path.startsWith(actor.user.id + "/" + clientId + "/") ||
      !new RegExp("^" + actor.user.id + "/" + clientId +
        "/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.webp$").test(path)) {
    return json({ error: "Caminho do avatar inválido." }, 400);
  }
  const { data: linked, error: linkedError } = await actor.db.from("clientes")
    .select("id").eq("user_id", actor.user.id).eq("avatar_path", path).limit(1);
  if (linkedError) return json({ error: "Não foi possível verificar os vínculos." }, 503);
  if (linked?.length) return json({ error: "O avatar ainda está vinculado a um cliente." }, 409);

  const provider = selectedMediaUploadProvider();
  if (provider === "unavailable") return json({ error: "Armazenamento não disponível." }, 503);
  try {
    if (isR2ReadEnabled()) {
      const { data: registered, error: lookupError } = await actor.db
        .from("fotura_media_objects").select("object_key")
        .eq("bucket", "client-avatars").eq("object_key", path)
        .eq("owner_id", actor.user.id).maybeSingle();
      if (lookupError) throw lookupError;
      if (registered) {
        const physical = r2PhysicalKey("client-avatars", path);
        const removed = await fetch(signPrivateR2ObjectUrl("DELETE", physical, 60), {
          method: "DELETE", cache: "no-store", signal: AbortSignal.timeout(12_000),
        });
        if (!removed.ok && removed.status !== 404) throw Error("delete denied");
        const check = await fetch(signPrivateR2ObjectUrl("HEAD", physical, 60), {
          method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(12_000),
        });
        if (check.status !== 404) throw Error("not removed");
        const { error } = await actor.db.from("fotura_media_objects").delete()
          .eq("bucket", "client-avatars").eq("object_key", path).eq("owner_id", actor.user.id);
        if (error) throw error;
        return json({ ok: true });
      }
    }
    const { error } = await actor.db.storage.from("client-avatars").remove([path]);
    if (error) throw error;
    return json({ ok: true });
  } catch {
    return json({ error: "Não foi possível confirmar a exclusão do avatar." }, 503);
  }
}
