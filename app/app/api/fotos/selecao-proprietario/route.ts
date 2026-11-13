import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { uuidValido } from "../../../../lib/validation";
import { listarCatalogoGaleriaHibrido } from "../../../../lib/gallery-media-catalog";
import { signPrivateMediaUrls } from "../../../../lib/media-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

/**
 * Owner-only R2/Supabase URL routing for the selection modal.
 * Neither client-provided filenames nor arbitrary paths are accepted.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Não autorizado." }, 401);
  const db = createServiceClient();
  const { data: session, error: authError } = await db.auth.getUser(token);
  if (authError || !session.user) return json({ error: "Não autorizado." }, 401);

  const galleryId = req.nextUrl.searchParams.get("galeria") ?? "";
  if (!uuidValido(galleryId)) return json({ error: "Galeria inválida." }, 400);
  const { data: gallery, error: ownerError } = await db.from("galerias")
    .select("id").eq("id", galleryId).eq("user_id", session.user.id).maybeSingle();
  if (ownerError) return json({ error: "Não foi possível verificar a galeria." }, 503);
  if (!gallery) return json({ error: "Galeria não encontrada." }, 404);

  const { data: selection, error: selectionError } = await db.from("selecoes")
    .select("fotos,comentarios").eq("galeria", galleryId).maybeSingle();
  if (selectionError) return json({ error: "Não foi possível verificar a seleção." }, 503);

  const selected = Array.isArray(selection?.fotos) ? selection.fotos : [];
  const comments = selection?.comentarios && typeof selection.comentarios === "object" &&
    !Array.isArray(selection.comentarios) ? Object.keys(selection.comentarios) : [];
  const allowedNames = new Set([...selected, ...comments].filter((name): name is string =>
    typeof name === "string" && /^[A-Za-z0-9._-]{1,230}$/.test(name) &&
    name !== "." && name !== ".."
  ));
  if (!allowedNames.size) return json({ fotos: [] });

  try {
    const { data: catalog, error: catalogError } = await listarCatalogoGaleriaHibrido(
      db, session.user.id, galleryId, "principal"
    );
    if (catalogError) throw catalogError;
    const available = new Set((catalog ?? []).map(item => String(item.nome)));
    const names = [...allowedNames].filter(name => available.has(name)).slice(0, 500);
    const keys = names.flatMap(name => [
      session.user.id + "/" + galleryId + "/thumbs/" + name,
      session.user.id + "/" + galleryId + "/" + name,
    ]);
    const signed: Record<string, string> = {};
    for (let i = 0; i < keys.length; i += 200) {
      Object.assign(signed, await signPrivateMediaUrls(db, "fotos", keys.slice(i, i + 200), 3600));
    }
    return json({
      fotos: names.map(nome => ({
        nome,
        thumb: signed[session.user.id + "/" + galleryId + "/thumbs/" + nome] ?? "",
        original: signed[session.user.id + "/" + galleryId + "/" + nome] ?? "",
      })).filter(item => item.original),
    });
  } catch {
    return json({ error: "Não foi possível assinar as fotos da seleção." }, 503);
  }
}
