import "server-only";
import { createServiceClient } from "./supabase-server";
import { isGalleryUuid, publicGalleryRef } from "./gallery-links";

export type PublicGalleryResolved = {
  id: string;
  slug: string;
  titulo: string;
  userId: string;
  capa: string | null;
  prova: boolean;
  etapa: string;
  temSenha: boolean;
  publicRef: string;
};

export async function resolvePublicGalleryRef(ref: string): Promise<PublicGalleryResolved | null> {
  const valor = decodeURIComponent(ref || "").trim();
  if (!valor) return null;
  const supabase = createServiceClient();

  if (isGalleryUuid(valor)) {
    const { data } = await supabase
      .from("galerias")
      .select("id,slug,titulo,user_id,capa,prova,etapa,tem_senha")
      .eq("id", valor)
      .maybeSingle();
    if (!data) return null;
    return {
      id: String(data.id),
      slug: String(data.slug || "galeria"),
      titulo: String(data.titulo || "Galeria"),
      userId: String(data.user_id),
      capa: (data.capa as string | null) ?? null,
      prova: Boolean(data.prova),
      etapa: String(data.etapa || (data.prova ? "prova" : "entrega")),
      temSenha: Boolean(data.tem_senha),
      publicRef: publicGalleryRef(String(data.slug || "galeria"), String(data.id)),
    };
  }

  const match = valor.match(/^(.*)-([0-9a-f]{8})$/i);
  const slug = (match?.[1] || valor).toLowerCase();
  const prefixo = match?.[2]?.toLowerCase() ?? null;
  const { data } = await supabase
    .from("galerias")
    .select("id,slug,titulo,user_id,capa,prova,etapa,tem_senha")
    .eq("slug", slug)
    .limit(100);

  const candidatos = data ?? [];
  const encontrado = prefixo
    ? candidatos.find((g) => String(g.id).replace(/-/g, "").toLowerCase().startsWith(prefixo))
    : candidatos.length === 1 ? candidatos[0] : null;

  if (!encontrado) return null;
  return {
    id: String(encontrado.id),
    slug: String(encontrado.slug || "galeria"),
    titulo: String(encontrado.titulo || "Galeria"),
    userId: String(encontrado.user_id),
    capa: (encontrado.capa as string | null) ?? null,
    prova: Boolean(encontrado.prova),
    etapa: String(encontrado.etapa || (encontrado.prova ? "prova" : "entrega")),
    temSenha: Boolean(encontrado.tem_senha),
    publicRef: publicGalleryRef(String(encontrado.slug || "galeria"), String(encontrado.id)),
  };
}
