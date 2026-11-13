import { NextResponse } from "next/server";
import { createServiceClient } from "../../../../../lib/supabase-server";
import { uuidValido } from "../../../../../lib/validation";
import { isR2ReadEnabled } from "../../../../../lib/r2-storage";
import { downloadPrivateMediaBlob } from "../../../../../lib/media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ owner: string; filename: string }> };

/** Public only for the studio's currently published logo. The R2 bucket
 * itself is always private; access is checked against the profile and
 * verified registry, not against a caller-controlled bucket/key alone.
 */
export async function GET(_req: Request, { params }: Params) {
  const { owner, filename } = await params;
  if (!isR2ReadEnabled() || !uuidValido(owner) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|webp)$/.test(filename)) {
    return new Response(null, { status: 404 });
  }
  const db = createServiceClient();
  const key = owner + "/" + filename;
  const publicPath = "/api/marca/" + key;
  const [{ data: profile, error: profileError }, { data: registered, error: registryError }] =
    await Promise.all([
      db.from("perfis").select("logo_url")
        .eq("id", owner).eq("logo_url", publicPath).maybeSingle(),
      db.from("fotura_media_objects").select("bytes,content_type")
        .eq("bucket", "marca").eq("object_key", key)
        .eq("owner_id", owner).maybeSingle(),
    ]);
  if (profileError || registryError) {
    return NextResponse.json({ error: "Não foi possível verificar o logotipo." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
  if (!profile || !registered || !Number.isSafeInteger(Number(registered.bytes)) ||
      Number(registered.bytes) < 1 || Number(registered.bytes) > 5 * 1024 * 1024) {
    return new Response(null, { status: 404 });
  }
  const types: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", webp: "image/webp",
  };
  const mime = types[filename.split(".").pop()!];
  if (registered.content_type !== mime) return new Response(null, { status: 404 });
  try {
    const image = await downloadPrivateMediaBlob(db, "marca", key);
    if (!image || image.size !== Number(registered.bytes)) {
      return new Response(null, { status: 503 });
    }
    return new Response(image, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=120, s-maxage=120",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
