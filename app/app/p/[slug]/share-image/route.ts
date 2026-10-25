import { NextRequest } from "next/server";
import sharp from "sharp";
import { createServiceClient } from "../../../../lib/supabase-server";
import { loadProjectSocialPreview } from "../../../../lib/project-social-preview.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailable() {
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, noarchive" },
  });
}

/**
 * Stable Open Graph image endpoint, without expiring signed URLs in metadata.
 * Access is rechecked on each request, including after a password is enabled
 * or a project link expires. No raw image or storage path is exposed.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const preview = await loadProjectSocialPreview(slug);
  if (!preview?.capaPath) return unavailable();

  try {
    const { data, error } = await createServiceClient().storage
      .from("fotos").download(preview.capaPath);
    if (error || !data || data.size > 15 * 1024 * 1024) return unavailable();
    const image = await sharp(Buffer.from(await data.arrayBuffer()))
      .rotate()
      .resize(1200, 630, { fit: "cover", position: "centre" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return new Response(new Uint8Array(image), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(image.length),
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, noarchive",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return unavailable();
  }
}
