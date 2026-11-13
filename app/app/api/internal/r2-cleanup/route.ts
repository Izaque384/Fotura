import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { readBoundedRequestText, RequestBodyTooLargeError } from "../../../../lib/limited-request-body";
import { r2PhysicalKey, signPrivateR2ObjectUrl, type FoturaMediaBucket } from "../../../../lib/r2-storage";
import { abortR2Multipart } from "../../../../lib/r2-multipart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The existing Supabase cleanup dispatcher authenticates with a minute-scoped
// HMAC from Vault. Supabase Edge forwards that token only to this fixed Fotura
// origin; R2 credentials never need to leave Vercel or reach the browser.
const respond = (payload: unknown, status = 200) => NextResponse.json(payload, {
  status, headers: { "Cache-Control": "no-store, private" },
});
const uuid = (s: unknown): s is string => typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const buckets = new Set<FoturaMediaBucket>([
  "fotos", "abertura-videos", "marca", "client-avatars", "feedback-anexos",
]);
type Pending = {
  id: string; bucket: FoturaMediaBucket; owner_id: string; object_key: string;
  thumbnail_key: string | null; upload_id: string | null;
  state: string; lease_token: string; lease_until: string;
};

async function deleteAndVerify(key: string) {
  const deleted = await fetch(signPrivateR2ObjectUrl("DELETE", key, 60), {
    method: "DELETE", cache: "no-store", signal: AbortSignal.timeout(12_000),
  });
  if (!deleted.ok && deleted.status !== 404) throw new Error("R2 delete failed");
  const check = await fetch(signPrivateR2ObjectUrl("HEAD", key, 60), {
    method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(12_000),
  });
  if (check.status !== 404) throw new Error("R2 object still exists");
}

async function removeGallery(
  db: ReturnType<typeof createServiceClient>, id: string, lease: string, inputPaths: unknown,
) {
  if (!Array.isArray(inputPaths) || inputPaths.length < 1 || inputPaths.length > 20 ||
      inputPaths.some((p) => typeof p !== "string" || p.length > 1024)) {
    return respond({ error: "Lote de limpeza inválido." }, 400);
  }
  // This RPC refuses a live gallery and an expired lease. Never trust
  // paths supplied by the Edge worker without rechecking the DB scope.
  const { data, error } = await db.rpc("storage_cleanup_r2_paths", {
    p_id: id, p_lease: lease,
  });
  if (error || !Array.isArray(data) || data.length !== inputPaths.length ||
      data.some((p: unknown) => typeof p !== "string") ||
      [...data].sort().join("\n") !== [...inputPaths].sort().join("\n")) {
    return respond({ error: "Lease ou escopo da limpeza inválido." }, 409);
  }
  for (const path of data as string[]) await deleteAndVerify(r2PhysicalKey("fotos", path));
  const { data: ack, error: ackError } = await db.rpc("storage_cleanup_r2_ack", {
    p_id: id, p_lease: lease, p_paths: data,
  });
  if (ackError || typeof ack !== "number" || ack < 0 || ack > data.length) {
    throw new Error("R2 gallery cleanup acknowledgement failed");
  }
  return respond({ ok: true, removed: data.length });
}

async function removePending(
  db: ReturnType<typeof createServiceClient>, id: string, lease: string,
) {
  const { data: pending, error } = await db.from("fotura_r2_upload_reservations")
    .select("id,bucket,owner_id,object_key,thumbnail_key,upload_id,state,lease_token,lease_until")
    .eq("id", id).eq("lease_token", lease).eq("state", "cleaning").maybeSingle();
  if (error || !pending) return respond({ error: "Reserva de limpeza não encontrada." }, 409);
  const p = pending as Pending;
  if (!buckets.has(p.bucket) || !uuid(p.owner_id) ||
      !p.object_key.startsWith(p.owner_id + "/") ||
      (p.thumbnail_key && !p.thumbnail_key.startsWith(p.owner_id + "/")) ||
      new Date(p.lease_until).getTime() <= Date.now()) {
    return respond({ error: "Escopo ou lease de limpeza expirado." }, 409);
  }
  const { data: registered, error: registryError } = await db.from("fotura_media_objects")
    .select("object_key").eq("bucket", p.bucket).eq("object_key", p.object_key)
    .maybeSingle();
  if (registryError || registered) return respond({ error: "Mídia registrada: exclusão recusada." }, 409);
  const original = r2PhysicalKey(p.bucket, p.object_key);
  if (p.upload_id) {
    if (p.bucket !== "fotos") return respond({ error: "Multipart inválido." }, 409);
    await abortR2Multipart(original, p.upload_id);
  }
  await deleteAndVerify(original);
  if (p.thumbnail_key) await deleteAndVerify(r2PhysicalKey(p.bucket, p.thumbnail_key));
  // The Supabase Edge worker acknowledges this lease only after HTTP 200.
  // On failure it keeps the reservation for a later retry.
  return respond({ ok: true });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-cleanup-token");
  if (!token || !/^[0-9a-f]{64}$/i.test(token)) return respond({ error: "Não autorizado." }, 401);
  const db = createServiceClient();
  const { data: authenticated, error: authError } = await db.rpc("storage_cleanup_authorized", {
    p_token: token,
  });
  if (authError || authenticated !== true) return respond({ error: "Não autorizado." }, 401);
  let input: { kind?: unknown; id?: unknown; lease_token?: unknown; paths?: unknown };
  try {
    input = JSON.parse(await readBoundedRequestText(req, 48 * 1024));
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid JSON");
  } catch (error) {
    return error instanceof RequestBodyTooLargeError ? respond({ error: "Corpo excessivo." }, 413)
      : respond({ error: "Dados inválidos." }, 400);
  }
  if (!uuid(input.id) || !uuid(input.lease_token)) {
    return respond({ error: "Identificador de lease inválido." }, 400);
  }
  try {
    if (input.kind === "gallery") return await removeGallery(db, input.id, input.lease_token, input.paths);
    if (input.kind === "pending") return await removePending(db, input.id, input.lease_token);
    return respond({ error: "Operação inválida." }, 400);
  } catch {
    return respond({ error: "Limpeza R2 adiada; lease preservado." }, 503);
  }
}
