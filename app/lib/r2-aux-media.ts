import "server-only";
import { isR2ReadEnabled, r2CredentialsPresent, r2PhysicalKey,
  signPrivateR2ObjectUrl, type FoturaMediaBucket } from "./r2-storage";

export type UploadProvider = "supabase" | "r2" | "unavailable";

/** Permanent storage policy: ALL new media must go to Cloudflare R2.
 * Environment flags cannot silently select Supabase writes again.
 * Missing/malformed S3 credentials block uploads (fail closed) instead.
 * Existing Supabase files remain readable ONLY via legacy read adapters.
 */
export function selectedMediaUploadProvider(): UploadProvider {
  if (!r2CredentialsPresent() || !isR2ReadEnabled()) return "unavailable";
  return "r2";
}

const AUX_BUCKETS = new Set<FoturaMediaBucket>([
  "marca", "client-avatars", "feedback-anexos",
]);

export async function putVerifiedAuxiliaryMedia(
  bucket: FoturaMediaBucket, key: string, bytes: Uint8Array, mime: string
): Promise<{ etag: string | null }> {
  if (selectedMediaUploadProvider() !== "r2" || !AUX_BUCKETS.has(bucket) ||
      bytes.byteLength < 1 || bytes.byteLength > 8 * 1024 * 1024 ||
      !/^image\/(?:png|jpeg|webp)$/i.test(mime)) {
    throw new Error("Envio R2 de mídia auxiliar não autorizado.");
  }
  const physical = r2PhysicalKey(bucket, key);
  const upload = await fetch(signPrivateR2ObjectUrl("PUT", physical, 120, mime, [], true), {
    method: "PUT",
    headers: { "Content-Type": mime, "If-None-Match": "*" },
    body: Buffer.from(bytes),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!upload.ok) throw new Error("Cloudflare R2 recusou o envio da imagem.");
  const verified = await fetch(signPrivateR2ObjectUrl("HEAD", physical, 60), {
    method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(12_000),
  });
  const remoteType = verified.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!verified.ok || Number(verified.headers.get("content-length")) !== bytes.byteLength ||
      remoteType !== mime.toLowerCase()) {
    throw new Error("O objeto R2 não passou na verificação de integridade.");
  }
  return { etag: verified.headers.get("etag")?.slice(0, 250) ?? null };
}
