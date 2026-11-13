import "server-only";
import { isR2ReadEnabled, r2CredentialsPresent, r2PhysicalKey,
  signPrivateR2ObjectUrl, type FoturaMediaBucket } from "./r2-storage";

export type UploadProvider = "supabase" | "r2" | "unavailable";

/** All new media use one provider after cutover; invalid configuration
 * fails closed rather than redirecting an upload to the old Storage. */
export function selectedMediaUploadProvider(): UploadProvider {
  const finalCutover = process.env.FOTURA_R2_FINAL_CUTOVER === "true";
  const uploadsEnabled = process.env.FOTURA_R2_UPLOAD_ENABLED === "true";
  const requested = finalCutover || uploadsEnabled;
  if (!requested) return "supabase";
  const allowedEnvironment = process.env.VERCEL_ENV === "preview" ||
    (process.env.VERCEL_ENV === "production" && finalCutover);
  // The final production gate alone must not enable only auxiliary uploads;
  // photos and videos also require UPLOAD_ENABLED. Fail closed everywhere.
  if (!uploadsEnabled || !allowedEnvironment || !isR2ReadEnabled() || !r2CredentialsPresent()) {
    return "unavailable";
  }
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
