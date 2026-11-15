import "server-only";
import type { createServiceClient } from "./supabase-server";
import { variantePublicaDaGaleria } from "./public-gallery-media-variant";

type Db = ReturnType<typeof createServiceClient>;

/**
 * Resolve the thumbnail path of a cover previously selected by its filename.
 * The project/album records predate final delivery and store only the name.
 * If that name exists in the published final catalog, its image lives in
 * /entrega/thumbs. Older covers selected from the proof remain valid in
 * /thumbs until the owner chooses a new final photo.
 *
 * This is server-only and never publishes the R2 object key to the client.
 */
export async function caminhoCapaAtual(
  db: Db,
  userId: string,
  galeriaId: string,
  nome: string
): Promise<string | null> {
  if (!nome || nome.length > 300 || /[\\/\x00-\x1f\x7f]/.test(nome)) return null;

  const { data: galeria, error: galleryError } = await db.from("galerias")
    .select("id,etapa,prova,entrega_publicada_em")
    .eq("id", galeriaId).eq("user_id", userId).maybeSingle();
  if (galleryError) throw galleryError;
  if (!galeria) return null;

  const variante = await variantePublicaDaGaleria(db, galeria);
  const base = `${userId}/${galeriaId}`;
  if (variante === "entrega") {
    // The old project cover might still point at an original proof filename.
    // Do not break it until the owner explicitly selects a published final.
    const { data: final, error: finalError } = await db.from("galeria_foto_metadata")
      .select("nome").eq("galeria_id", galeriaId).eq("user_id", userId)
      .eq("variante", "entrega").eq("nome", nome).maybeSingle();
    if (finalError) throw finalError;
    if (final) return `${base}/entrega/thumbs/${nome}`;
  }
  return `${base}/thumbs/${nome}`;
}
