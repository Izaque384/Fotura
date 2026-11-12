import "server-only";
import { createServiceClient } from "./supabase-server";
import { isR2ReadEnabled, r2PhysicalKey, signPrivateR2ReadUrl, type FoturaMediaBucket } from "./r2-storage";

type DatabaseClient = ReturnType<typeof createServiceClient>;
type MediaBucket = FoturaMediaBucket;

/**
 * Read routing for verified R2 copies. No application path selects R2 by
 * filename alone. A service-role-only registry entry and explicit feature
 * flag are both required; otherwise the original Supabase URL is used.
 *
 * Callers MUST validate gallery/project authorization before signing.
 */
async function verifiedR2Keys(db: DatabaseClient, bucket: MediaBucket, keys: string[]): Promise<Set<string>> {
  if (!isR2ReadEnabled() || keys.length === 0) return new Set();
  const { data, error } = await db.from("fotura_media_objects")
    .select("object_key")
    .eq("bucket", bucket)
    .in("object_key", keys);
  if (error) throw new Error("Falha ao consultar o registro privado de mídias R2.");
  return new Set((data ?? []).map((item) => String(item.object_key)));
}

export async function signPrivateMediaUrl(
  db: DatabaseClient,
  bucket: MediaBucket,
  key: string,
  seconds: number,
  downloadName?: string
): Promise<string | null> {
  const r2 = await verifiedR2Keys(db, bucket, [key]);
  if (r2.has(key)) return signPrivateR2ReadUrl(r2PhysicalKey(bucket, key), seconds);
  const { data, error } = await db.storage.from(bucket).createSignedUrl(
    key, seconds, downloadName ? { download: downloadName } : undefined
  );
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function signPrivateMediaUrls(
  db: DatabaseClient,
  bucket: MediaBucket,
  keys: string[],
  seconds: number
): Promise<Record<string, string>> {
  const uniqueKeys = [...new Set(keys)];
  if (uniqueKeys.length === 0) return {};
  const r2 = await verifiedR2Keys(db, bucket, uniqueKeys);
  const result: Record<string, string> = {};
  for (const key of r2) result[key] = signPrivateR2ReadUrl(r2PhysicalKey(bucket, key), seconds);

  const legacy = uniqueKeys.filter((key) => !r2.has(key));
  if (legacy.length) {
    const { data, error } = await db.storage.from(bucket).createSignedUrls(legacy, seconds);
    if (error) throw new Error("Falha ao assinar objetos no Supabase Storage.");
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) result[item.path] = item.signedUrl;
    }
  }
  return result;
}


/**
 * Server-side access for image transformations (watermark and Open Graph).
 * Preserves the authorization checks performed by the calling route.
 */
export async function downloadPrivateMediaBlob(
  db: DatabaseClient,
  bucket: MediaBucket,
  key: string
): Promise<Blob | null> {
  const r2 = await verifiedR2Keys(db, bucket, [key]);
  if (r2.has(key)) {
    const response = await fetch(signPrivateR2ReadUrl(r2PhysicalKey(bucket, key), 60), { cache: "no-store" });
    return response.ok ? response.blob() : null;
  }
  const { data, error } = await db.storage.from(bucket).download(key);
  return error ? null : data;
}
