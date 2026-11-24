import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { signPrivateMediaUrls } from "../../../../lib/media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (value: unknown, status = 200) => NextResponse.json(value, {
  status, headers: { "Cache-Control": "no-store, private" },
});

/**
 * Dashboard thumbnails no longer depend on the Supabase Storage inventory.
 * All covers are scoped to the authenticated studio and resolved from verified
 * R2 records. The bucket remains private; signed URLs expire after one hour.
 */
export async function GET(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return json({ error: "Não autorizado." }, 401);
  const db = createServiceClient();
  const { data: auth, error: authError } = await db.auth.getUser(bearer);
  if (authError || !auth.user) return json({ error: "Não autorizado." }, 401);
  const uid = auth.user.id;

  const { data: galleries, error: galleryError } = await db.from("galerias")
    .select("id,capa").eq("user_id", uid);
  if (galleryError) return json({ error: "Falha ao consultar galerias." }, 503);
  if (!galleries?.length) return json({ covers: {} });

  const byGallery = new Map<string, Array<{ name: string; created: string }>>();
  const registeredPaths = new Set<string>();
  const galleryIds = new Set(galleries.map(g => String(g.id)));
  try {
    for (let offset = 0; offset < 10000; offset += 500) {
      const { data, error } = await db.from("fotura_media_objects")
        .select("object_key,created_at").eq("bucket", "fotos")
        .eq("owner_id", uid).order("created_at", { ascending: true })
        .range(offset, offset + 499);
      if (error) throw error;
      const page = data ?? [];
      for (const item of page) {
        const key = String(item.object_key);
        registeredPaths.add(key);
        const segments = key.split("/");
        if (segments.length !== 3 || segments[0] !== uid || !galleryIds.has(segments[1])) continue;
        if (segments[2] === "entrega" || segments[2] === "thumbs") continue;
        const list = byGallery.get(segments[1]) ?? [];
        list.push({ name: segments[2], created: String(item.created_at ?? "") });
        byGallery.set(segments[1], list);
      }
      if (page.length < 500) break;
    }

    const covers: Record<string, { name: string; url: string; count: number }> = {};
    const candidates: Array<{ galleryId: string; name: string; thumb: string; original: string }> = [];
    for (const gallery of galleries) {
      const galleryId = String(gallery.id);
      const files = byGallery.get(galleryId) ?? [];
      if (!files.length) continue;
      files.sort((a, b) => a.created.localeCompare(b.created) || a.name.localeCompare(b.name));
      const selected = files.find(f => f.name === gallery.capa) ?? files[0];
      const original = uid + "/" + galleryId + "/" + selected.name;
      candidates.push({ galleryId, name: selected.name, thumb: uid + "/" + galleryId + "/thumbs/" + selected.name, original });
    }
    const lookup: Record<string, string> = {};
    // Both original and thumbnail are owned by the same studio. If the thumb
    // is missing, the original is a safe fallback instead of a broken image.
    for (let i = 0; i < candidates.length; i += 75) {
      const chunk = candidates.slice(i, i + 75);
      const paths = chunk.flatMap(x => registeredPaths.has(x.thumb) ? [x.thumb, x.original] : [x.original]);
      Object.assign(lookup, await signPrivateMediaUrls(db, "fotos", paths, 3600));
    }
    for (const item of candidates) {
      const url = lookup[item.thumb] ?? lookup[item.original];
      if (url) covers[item.galleryId] = {
        name: item.name, url, count: (byGallery.get(item.galleryId) ?? []).length,
      };
    }
    return json({ covers });
  } catch {
    return json({ error: "Falha ao assinar capas no R2." }, 503);
  }
}
