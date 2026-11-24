import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { r2PhysicalKey, signPrivateR2ObjectUrl, type FoturaMediaBucket } from "../../../../lib/r2-storage";
import { readBoundedRequestText } from "../../../../lib/limited-request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Temporary private operations endpoint for verified legacy Storage cleanup.
 *
 * The existing Supabase Vault minute-scoped HMAC is required, and all paths
 * must have an existing owner-scoped R2 registry entry and matching bytes/MIME/
 * ETag. A fixed site banner is the only ownerless exception. It is never
 * possible to remove R2 objects from this route.
 *
 * Source files are deleted ONLY via Supabase Storage API, never SQL.
 */
const buckets = new Set<FoturaMediaBucket>([
  "fotos", "abertura-videos", "marca", "client-avatars", "feedback-anexos",
]);
const uid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const landing = "landing/fotura-wedding-sunset-generated.png";
type Input = {
  bucket: FoturaMediaBucket; key: string; bytes: number; mime: string;
};
const json = (x: unknown, status = 200) => NextResponse.json(x, {
  status, headers: { "Cache-Control": "no-store, private" },
});

function valid(item: unknown): item is Input {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  const x = item as Record<string, unknown>;
  if (typeof x.bucket !== "string" || !buckets.has(x.bucket as FoturaMediaBucket) ||
      typeof x.key !== "string" || x.key.length > 1024 ||
      !Number.isSafeInteger(x.bytes) || Number(x.bytes) < 1 ||
      Number(x.bytes) > 25 * 1024 * 1024 ||
      typeof x.mime !== "string" || !/^(image|video)\/[a-z0-9.+-]+$/i.test(x.mime)) return false;
  if (x.bucket === "marca" && x.key === landing)
    return x.bytes === 5204074 && x.mime === "image/png";
  const parts = x.key.split("/");
  return parts.length >= 2 && uid.test(parts[0]) &&
    parts.every(part => !!part && part !== "." && part !== "..") &&
    !x.key.includes("\\") && !/[\u0000-\u001f\u007f]/.test(x.key);
}

async function checkR2(db: ReturnType<typeof createServiceClient>, file: Input): Promise<boolean> {
  const special = file.bucket === "marca" && file.key === landing;
  let etag: string | null = null;
  if (!special) {
    const { data: row, error } = await db.from("fotura_media_objects")
      .select("bytes,owner_id,content_type,etag,verified_at")
      .eq("bucket", file.bucket).eq("object_key", file.key).maybeSingle();
    if (error || !row || !row.verified_at || row.owner_id !== file.key.split("/")[0] ||
        Number(row.bytes) !== file.bytes ||
        String(row.content_type).toLowerCase() !== file.mime.toLowerCase() ||
        !row.etag) return false;
    etag = row.etag;
  }
  const physical = r2PhysicalKey(file.bucket, file.key);
  const response = await fetch(signPrivateR2ObjectUrl("HEAD", physical, 90), {
    method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return false;
  const length = Number(response.headers.get("content-length"));
  const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  const currentEtag = response.headers.get("etag");
  return length === file.bytes && type === file.mime.toLowerCase() &&
    Boolean(currentEtag) && (!etag || currentEtag === etag);
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-cleanup-token") ?? "";
  if (!/^[a-f0-9]{64}$/i.test(token)) return json({ error: "Não autorizado." }, 401);
  const db = createServiceClient();
  const { data: authorized, error: authError } = await db.rpc("storage_cleanup_authorized", {
    p_token: token,
  });
  if (authError || authorized !== true) return json({ error: "Não autorizado." }, 401);

  let files: Input[];
  try {
    const payload = JSON.parse(await readBoundedRequestText(req, 12 * 1024));
    if (!Array.isArray(payload?.files) || payload.files.length < 1 || payload.files.length > 3 ||
        !payload.files.every(valid) || new Set(payload.files.map((x: Input) =>
          x.bucket + "/" + x.key)).size !== payload.files.length ||
        payload.files.reduce((n: number, x: Input) => n + x.bytes, 0) > 40 * 1024 * 1024)
      throw Error("Invalid batch");
    files = payload.files;
  } catch {
    return json({ error: "Lote inválido." }, 400);
  }

  let removed = 0;
  const results: Array<{ bucket: string; key: string; status: string }> = [];
  for (const file of files) {
    try {
      if (!await checkR2(db, file)) {
        results.push({ bucket: file.bucket, key: file.key, status: "r2_verification_failed" });
        continue;
      }
      const { error } = await db.storage.from(file.bucket).remove([file.key]);
      if (error) throw new Error("Storage remove failed");
      removed++;
      results.push({ bucket: file.bucket, key: file.key, status: "removed_via_storage_api" });
    } catch {
      results.push({ bucket: file.bucket, key: file.key, status: "failed" });
    }
  }
  return json({
    ok: removed === files.length, removed, failed: files.length - removed, results,
  }, removed === files.length ? 200 : 207);
}
