import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { listarCatalogoGaleriaHibrido } from "../../../../lib/gallery-media-catalog";
import { signPrivateMediaUrls, downloadPrivateMediaBlob } from "../../../../lib/media-storage";
import { uuidValido } from "../../../../lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

/** Owner-only gallery photo picker used to create customer avatars.
 * A project gallery can only be accessed when linked to that specific client.
 * No signed original media URLs are returned; thumbnails are capped to 36.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Não autorizado." }, 401);
  const galleryId = req.nextUrl.searchParams.get("galeria");
  const clientId = req.nextUrl.searchParams.get("cliente");
  const photoName = req.nextUrl.searchParams.get("arquivo");
  if (!uuidValido(galleryId) || !uuidValido(clientId)) {
    return json({ error: "Galeria ou cliente inválido." }, 400);
  }
  if (photoName && (photoName.length > 255 || !/^[A-Za-z0-9._-]+$/.test(photoName) ||
      photoName === "." || photoName === "..")) {
    return json({ error: "Nome da foto inválido." }, 400);
  }

  const db = createServiceClient();
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Não autorizado." }, 401);
  const [{ data: gallery, error: galleryError }, { data: client, error: clientError }] =
    await Promise.all([
      db.from("galerias").select("id,cliente_id")
        .eq("id", galleryId).eq("user_id", auth.user.id).maybeSingle(),
      db.from("clientes").select("id")
        .eq("id", clientId).eq("user_id", auth.user.id).maybeSingle(),
    ]);
  if (galleryError || clientError) return json({ error: "Falha ao verificar acesso." }, 503);
  if (!gallery || !client || gallery.cliente_id !== client.id) {
    return json({ error: "Esta galeria não pertence ao cliente selecionado." }, 403);
  }

  const { data: catalog, error: catalogError } = await listarCatalogoGaleriaHibrido(
    db, auth.user.id, galleryId, "principal"
  );
  if (catalogError || !catalog) return json({ error: "Não foi possível listar as fotos." }, 503);
  const all = catalog.filter(item => item.nome && /^[A-Za-z0-9._-]+$/.test(item.nome))
    .sort((a, b) => String(b.criado_em ?? "").localeCompare(String(a.criado_em ?? "")));

  if (photoName) {
    if (!all.some(x => x.nome === photoName)) {
      return json({ error: "Fotografia não encontrada na galeria." }, 404);
    }
    try {
      const path = auth.user.id + "/" + galleryId + "/thumbs/" + photoName;
      const image = await downloadPrivateMediaBlob(db, "fotos", path);
      if (!image) return json({ error: "Miniatura não disponível." }, 404);
      if (image.size > 8 * 1024 * 1024) return json({ error: "Miniatura muito grande." }, 413);
      return new Response(image, {
        headers: {
          "Content-Type": image.type || (/\.webp$/i.test(photoName) ? "image/webp" :
            /\.png$/i.test(photoName) ? "image/png" : "image/jpeg"),
          "Content-Disposition": "attachment; filename=\"fotura-avatar-preview\"",
          "Cache-Control": "no-store, private",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      return json({ error: "Não foi possível abrir a miniatura." }, 503);
    }
  }

  const recent = all.slice(0, 36);
  const paths = recent.map(item => auth.user!.id + "/" + galleryId + "/thumbs/" + item.nome);
  try {
    const signed = await signPrivateMediaUrls(db, "fotos", paths, 900);
    return json({ fotos: paths.filter(path => signed[path]).map(path => ({
      path, url: signed[path],
    })) });
  } catch {
    return json({ error: "Não foi possível carregar as miniaturas." }, 503);
  }
}
