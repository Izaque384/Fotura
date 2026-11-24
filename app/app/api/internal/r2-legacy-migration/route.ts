import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { r2PhysicalKey, signPrivateR2ObjectUrl, type FoturaMediaBucket } from "../../../../lib/r2-storage";
import { readBoundedRequestText } from "../../../../lib/limited-request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Internal-only, one-shot transfer of legacy media. Invoked by a Supabase
 * pg_net dispatcher authenticated by the existing short-lived Vault HMAC.
 * No source deletion, no browser-facing URL and no storage credentials exposed.
 * The dispatcher must select real files from storage.objects; every R2 copy is
 * downloaded back and SHA-256 verified before registering its private key.
 */
const bucketNames = new Set<FoturaMediaBucket>([
  "fotos", "abertura-videos", "marca", "client-avatars", "feedback-anexos",
]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type FileItem = {
  bucket: FoturaMediaBucket;
  key: string;
  bytes: number;
  mime: string;
};

const json = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store, private" },
});

function validFile(x: unknown): x is FileItem {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const f = x as Record<string, unknown>;
  if (typeof f.bucket !== "string" || !bucketNames.has(f.bucket as FoturaMediaBucket) ||
      typeof f.key !== "string" || f.key.length > 1024 ||
      !Number.isSafeInteger(f.bytes) || Number(f.bytes) < 1 || Number(f.bytes) > 25 * 1024 * 1024 ||
      typeof f.mime !== "string" || !/^(image|video)\/[a-z0-9.+-]+$/i.test(f.mime)) return false;
  const path = f.key.split("/");
  // The legacy landing banner is not user-owned. It requires a separate
  // public-delivery plan; never forge an ownership record to copy it.
  if (path.length < 2 || !uuid.test(path[0]) ||
      path.some(part => !part || part === "." || part === "..") ||
      f.key.includes("\\") || /[\u0000-\u001f\u007f]/.test(f.key)) return false;
  return true;
}

const digest = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");

async function copyVerified(db: ReturnType<typeof createServiceClient>, file: FileItem) {
  const { bucket, key, bytes, mime } = file;
  const owner = key.split("/")[0];
  const { data: previous, error: previousError } = await db.from("fotura_media_objects")
    .select("bytes,owner_id,content_type").eq("bucket", bucket)
    .eq("object_key", key).maybeSingle();
  if (previousError) throw new Error("Registry read failed");
  if (previous) {
    if (previous.owner_id !== owner || Number(previous.bytes) !== bytes)
      throw new Error("Conflicting existing registry");
    return "previously_verified";
  }

  const { data: blob, error: sourceError } = await db.storage.from(bucket).download(key);
  if (sourceError || !blob) throw new Error("Supabase Storage read failed");
  const source = Buffer.from(await blob.arrayBuffer());
  if (source.byteLength !== bytes) throw new Error("Source length differs from inventory");
  const expectedHash = digest(source);

  const physical = r2PhysicalKey(bucket, key);
  const head = await fetch(signPrivateR2ObjectUrl("HEAD", physical, 60), {
    method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(12000),
  });
  if (head.status !== 404 && !head.ok) throw new Error("R2 HEAD failed");

  if (head.status === 404) {
    const upload = await fetch(signPrivateR2ObjectUrl("PUT", physical, 120, mime, [], true), {
      method: "PUT",
      headers: { "Content-Type": mime, "If-None-Match": "*" },
      body: source,
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
    if (!upload.ok && upload.status !== 412) throw new Error("R2 PUT failed");
  }

  // End-to-end content verification: do not trust S3 ETags or HEAD alone.
  const remote = await fetch(signPrivateR2ObjectUrl("GET", physical, 120), {
    method: "GET", cache: "no-store", signal: AbortSignal.timeout(25000),
  });
  if (!remote.ok) throw new Error("R2 readback failed");
  const copy = Buffer.from(await remote.arrayBuffer());
  if (copy.byteLength !== bytes || digest(copy) !== expectedHash)
    throw new Error("R2 SHA-256 verification failed");

  const { error: registryError } = await db.from("fotura_media_objects")
    .upsert({
      bucket, object_key: key, owner_id: owner, bytes,
      content_type: mime, etag: remote.headers.get("etag"), verified_at: new Date().toISOString(),
    }, { onConflict: "bucket,object_key", ignoreDuplicates: true });
  if (registryError) throw new Error("Copy verified, but registry insert failed");
  return head.ok ? "existing_object_verified" : "copied_verified";
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-cleanup-token") || "";
  if (!/^[a-f0-9]{64}$/i.test(token)) return json({ error: "Not authorized" }, 401);
  const db = createServiceClient();
  const { data: authorized, error: authError } = await db.rpc("storage_cleanup_authorized", {
    p_token: token,
  });
  if (authError || authorized !== true) return json({ error: "Not authorized" }, 401);

  let files: FileItem[];
  try {
    const body = JSON.parse(await readBoundedRequestText(req, 12 * 1024)) as { files?: unknown };
    if (!body || !Array.isArray(body.files) || body.files.length < 1 ||
        body.files.length > 3 || !body.files.every(validFile) ||
        body.files.reduce((n: number, f: FileItem) => n + f.bytes, 0) > 30 * 1024 * 1024) {
      throw new Error("Invalid file batch");
    }
    files = body.files;
  } catch {
    return json({ error: "Invalid batch" }, 400);
  }

  const result: Array<{ bucket: string; key: string; result: string }> = [];
  for (const f of files) {
    try {
      const status = await copyVerified(db, f);
      result.push({ bucket: f.bucket, key: f.key, result: status });
    } catch {
      // Never expose credentials, signed URLs, or exception internals.
      result.push({ bucket: f.bucket, key: f.key, result: "failed" });
    }
  }
  return json({
    ok: result.every(f => f.result !== "failed"),
    completed: result.filter(f => f.result !== "failed").length,
    failed: result.filter(f => f.result === "failed").length,
    results: result,
  }, result.some(f => f.result === "failed") ? 207 : 200);
}