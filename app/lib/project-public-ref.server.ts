import "server-only";
import { createServiceClient } from "./supabase-server";
import { isProjectUuid, publicProjectRef } from "./project-links";

export type PublicProjectResolved = {
  id: string;
  slug: string;
  nome: string;
  userId: string;
  temSenha: boolean;
  publicRef: string;
};

export async function resolvePublicProjectRef(ref: string): Promise<PublicProjectResolved | null> {
  const valor = decodeURIComponent(ref || "").trim();
  if (!valor) return null;
  const supabase = createServiceClient();

  if (isProjectUuid(valor)) {
    const { data } = await supabase
      .from("galeria_projetos")
      .select("id,slug,nome,user_id,tem_senha")
      .eq("id", valor)
      .maybeSingle();
    if (!data) return null;
    return {
      id: String(data.id),
      slug: String(data.slug || "projeto"),
      nome: String(data.nome || "Projeto"),
      userId: String(data.user_id),
      temSenha: Boolean(data.tem_senha),
      publicRef: publicProjectRef(String(data.slug || "projeto"), String(data.id)),
    };
  }

  const match = valor.match(/^(.*)-([0-9a-f]{8})$/i);
  const slug = (match?.[1] || valor).toLowerCase();
  const prefixo = match?.[2]?.toLowerCase() ?? null;
  const { data } = await supabase
    .from("galeria_projetos")
    .select("id,slug,nome,user_id,tem_senha")
    .eq("slug", slug)
    .limit(100);

  const candidatos = data ?? [];
  const encontrado = prefixo
    ? candidatos.find((p) => String(p.id).replace(/-/g, "").toLowerCase().startsWith(prefixo))
    : candidatos.length === 1 ? candidatos[0] : null;

  if (!encontrado) return null;
  return {
    id: String(encontrado.id),
    slug: String(encontrado.slug || "projeto"),
    nome: String(encontrado.nome || "Projeto"),
    userId: String(encontrado.user_id),
    temSenha: Boolean(encontrado.tem_senha),
    publicRef: publicProjectRef(String(encontrado.slug || "projeto"), String(encontrado.id)),
  };
}
