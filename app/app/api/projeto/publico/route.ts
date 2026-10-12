import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { resolvePublicProjectRef } from "../../../../lib/project-public-ref.server";
import { temAcessoProjeto } from "../../../../lib/project-access";
import { criarTokenGaleria, nomeCookieGaleria } from "../../../../lib/gallery-access";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { dataCalendarioExpirada } from "../../../../lib/date-only";
import { planoFotura } from "../../../../lib/billing-plans";
import { estiloHeroEfetivo, heroPresetDataUrl } from "../../../../lib/gallery-hero";

export const dynamic = "force-dynamic";

function baseJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, private" } });
}

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref")?.trim() || "";
  if (!ref || ref.length > 220) return baseJson({ error: "Projeto inválido." }, 400);

  const resolvido = await resolvePublicProjectRef(ref);
  if (!resolvido) return baseJson({ error: "Projeto não encontrado." }, 404);

  const permitido = await consumirRateLimit(req, "public_project_metadata", resolvido.id, 60, 120);
  if (!permitido) return baseJson({ error: "Muitas solicitações. Aguarde um minuto." }, 429);

  const supabase = createServiceClient();
  const { data: p, error } = await supabase.from("galeria_projetos")
    .select("id,user_id,nome,descricao,slug,capa_galeria_id,capa_arquivo,prova,limite,prazo,link_ate,tem_senha,venda_extras_ativa,preco_foto_extra_centavos,download_ativo,download_individual,download_completo,download_tamanho,download_pin_hash,watermark_ativo,watermark_texto,watermark_opacidade,assistente_ativo")
    .eq("id", resolvido.id).maybeSingle();
  if (error || !p) return baseJson({ error: "Projeto não encontrado." }, 404);

  const linkAte = (p.link_ate as string | null) ?? null;
  const linkExpirado = dataCalendarioExpirada(linkAte);
  const protegida = Boolean(p.tem_senha);
  const desbloqueada = !protegida || temAcessoProjeto(req, resolvido.id);

  const [{ data: perfil }, { data: assinatura }, { data: pastas }] = await Promise.all([
    supabase.from("perfis").select("nome_estudio,logo_url,cor_hero,hero_galeria_ativo,hero_galeria_estilo,hero_foto_capa_ativo,stripe_recebimentos_ativo").eq("id", p.user_id).maybeSingle(),
    supabase.from("assinaturas").select("plano_codigo,status").eq("user_id", p.user_id).maybeSingle(),
    supabase.from("galerias").select("id,slug,titulo,capa,ordem,visivel,etapa,prova").eq("projeto_id", resolvido.id).eq("visivel", true).order("ordem", { ascending: true }).order("criado_em", { ascending: true }),
  ]);

  const statusAssinatura = String(assinatura?.status || "active");
  const plano = ["active","trialing","past_due"].includes(statusAssinatura)
    ? planoFotura((assinatura?.plano_codigo as string | null) ?? "sem_plano")
    : planoFotura("sem_plano");
  const heroCor = (perfil?.cor_hero as string | null) ?? "#F0EDF7";
  const usarHeroEstudio = Boolean(perfil?.hero_galeria_ativo) && plano.recursos.heroEstudio;
  const heroEstilo = estiloHeroEfetivo((perfil?.hero_galeria_estilo as string | null) ?? "minimal", plano.recursos.heroPremiumTech);
  const usarFotoCapaPublica = usarHeroEstudio && Boolean(perfil?.hero_foto_capa_ativo) && plano.recursos.heroFotoGaleria;

  let capaUrl: string | null = null;
  if (desbloqueada && !linkExpirado) {
    if (usarFotoCapaPublica && p.capa_galeria_id && p.capa_arquivo) {
      const baseCapa = `${p.user_id}/${p.capa_galeria_id}`;
      const caminhosCapa = [`${baseCapa}/thumbs/${p.capa_arquivo}`, `${baseCapa}/${p.capa_arquivo}`];
      const { data } = await supabase.storage.from("fotos").createSignedUrls(caminhosCapa, 60 * 60);
      capaUrl = caminhosCapa.map(caminho => data?.find(item => item.path === caminho)?.signedUrl).find(Boolean) ?? null;
    } else if (usarHeroEstudio) {
      capaUrl = heroPresetDataUrl(heroCor, heroEstilo);
    }
  }

  const miniaturas = new Map<string, string | null>();
  if (desbloqueada && !linkExpirado && (pastas?.length ?? 0) > 0) {
    const resolvidas = await Promise.all((pastas ?? []).map(async (galeria) => {
      const galeriaId = String(galeria.id);
      const base = `${p.user_id}/${galeriaId}`;
      const { data: arquivos } = await supabase.storage.from("fotos").list(base, {
        limit: 40,
        offset: 0,
        sortBy: { column: "created_at", order: "asc" },
      });
      const candidatas = (arquivos ?? []).filter(item => item.id !== null && item.name !== "thumbs" && item.name !== "entrega");
      // A selected cover may be beyond the first page of the gallery.
      const nomeCapa = (galeria.capa as string | null) || candidatas[0]?.name;
      if (nomeCapa && galeria.capa) {
        const { data: capa } = await supabase.storage.from("fotos").list(base, { limit: 100, search: nomeCapa });
        if (!(capa ?? []).some(item => item.id !== null && item.name === nomeCapa)) {
          galeria.capa = null;
        }
      }
      const arquivo = galeria.capa ? { name: String(galeria.capa) } : candidatas[0];
      if (!arquivo) return [galeriaId, null] as const;

      const caminhos = [`${base}/thumbs/${arquivo.name}`, `${base}/${arquivo.name}`];
      const { data: signed } = await supabase.storage.from("fotos").createSignedUrls(caminhos, 60 * 60);
      const url = caminhos.map(caminho => signed?.find(item => item.path === caminho)?.signedUrl).find(Boolean) ?? null;
      return [galeriaId, url] as const;
    }));
    for (const [galeriaId, url] of resolvidas) miniaturas.set(galeriaId, url);
  }

  const response = baseJson({
    projeto: {
      id: String(p.id),
      nome: String(p.nome || "Projeto"),
      descricao: (p.descricao as string | null) ?? null,
      publicRef: resolvido.publicRef,
      capaUrl,
      prova: Boolean(p.prova),
      limite: Number(p.limite ?? 0),
      prazo: (p.prazo as string | null) ?? null,
      linkAte,
      temSenha: protegida,
      desbloqueado: desbloqueada,
      linkExpirado,
      vendaExtrasAtiva: Boolean(p.venda_extras_ativa),
      precoFotoExtraCentavos: (p.preco_foto_extra_centavos as number | null) ?? null,
      downloadAtivo: Boolean(p.download_ativo),
      downloadIndividual: Boolean(p.download_individual),
      downloadCompleto: Boolean(p.download_completo),
      downloadTamanho: p.download_tamanho === "web" ? "web" : "original",
      downloadPinNecessario: Boolean(p.download_pin_hash),
      watermarkAtivo: Boolean(p.watermark_ativo),
      watermarkTexto: (p.watermark_texto as string | null) ?? null,
      watermarkOpacidade: Number(p.watermark_opacidade ?? 22),
      assistenteAtivo: Boolean(p.assistente_ativo),
    },
    perfil: perfil ? {
      nome: (perfil.nome_estudio as string | null) ?? null,
      logo: (perfil.logo_url as string | null) ?? null,
      cor: (perfil.cor_hero as string | null) ?? null,
    } : { nome: null, logo: null, cor: null },
    pastas: desbloqueada && !linkExpirado ? (pastas ?? []).map((g) => ({
      id: String(g.id),
      titulo: String(g.titulo || "Galeria"),
      ordem: Number(g.ordem ?? 0),
      etapa: String(g.etapa || (g.prova ? "prova" : "entrega")),
      thumbnailUrl: miniaturas.get(String(g.id)) ?? null,
    })) : [],
  });

  if (protegida && desbloqueada) {
    for (const pasta of pastas ?? []) {
      const token = criarTokenGaleria(String(pasta.id));
      response.cookies.set(nomeCookieGaleria(String(pasta.id)), token.valor, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: token.maxAge,
      });
    }
  }
  return response;
}
