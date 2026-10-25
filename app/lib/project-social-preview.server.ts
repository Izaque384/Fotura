import "server-only";
import { createServiceClient } from "./supabase-server";
import { resolvePublicProjectRef } from "./project-public-ref.server";
import { dataCalendarioExpirada } from "./date-only";

export type ProjectSocialPreview = {
  publicRef: string;
  nome: string;
  descricao: string | null;
  protegido: boolean;
  expirado: boolean;
  capaPath: string | null;
};

/**
 * Returns only metadata safe to expose to an anonymous social-media crawler.
 * Never makes signed URLs or private gallery files available for password-
 * protected, expired, or hidden projects.
 */
export async function loadProjectSocialPreview(ref: string): Promise<ProjectSocialPreview | null> {
  if (!/^[a-z0-9-]{1,220}$/i.test(ref)) return null;
  try {
    const resolved = await resolvePublicProjectRef(ref);
    if (!resolved) return null;

    const supabase = createServiceClient();
    const { data: project, error } = await supabase.from("galeria_projetos")
      .select("id,user_id,nome,descricao,tem_senha,link_ate,capa_galeria_id,capa_arquivo")
      .eq("id", resolved.id)
      .maybeSingle();
    if (error || !project) return null;

    const protegido = Boolean(project.tem_senha);
    const expirado = dataCalendarioExpirada(project.link_ate as string | null);
    let capaPath: string | null = null;

    if (!protegido && !expirado && project.capa_galeria_id && project.capa_arquivo) {
      const arquivo = String(project.capa_arquivo);
      // Disallow directory traversal / arbitrary storage objects.
      const arquivoSeguro = arquivo.length <= 255 &&
        !/[\\/\x00-\x1f]/.test(arquivo) && !arquivo.includes("..");
      if (arquivoSeguro) {
        const { data: galeria } = await supabase.from("galerias").select("id")
          .eq("id", String(project.capa_galeria_id))
          .eq("projeto_id", String(project.id))
          .eq("visivel", true)
          .maybeSingle();
        if (galeria) {
          capaPath = `${project.user_id}/${project.capa_galeria_id}/thumbs/${arquivo}`;
        }
      }
    }

    return {
      publicRef: resolved.publicRef,
      nome: String(project.nome || "Projeto"),
      descricao: !protegido && !expirado ? (project.descricao as string | null) : null,
      protegido,
      expirado,
      capaPath,
    };
  } catch {
    // A failed metadata lookup must not break access to the client-side gallery.
    return null;
  }
}
