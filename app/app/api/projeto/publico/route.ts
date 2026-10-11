import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { resolvePublicProjectRef } from "../../../../lib/project-public-ref.server";
import { temAcessoProjeto } from "../../../../lib/project-access";
import { criarTokenGaleria, nomeCookieGaleria } from "../../../../lib/gallery-access";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { dataCalendarioExpirada } from "../../../../lib/date-only";
import { planoFotura } from "../../../../lib/billing-plans";

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
    supabase.from("galerias").select("id,slug,titulo,ordem,visivel,etapa,prova").eq("projeto_id", resolvido.id).eq("visivel", true).order("ordem", { ascending: true }).order("criado_em", { ascending: true }),
  ]);

  const statusAssinatura = String(assinatura?.status || "active");
  const plano = ["active","trialing","past_due"].includes(statusAssinatura)
    ? planoFotura((assinatura?.plano_codigo as string | null) ?? "sem_plano")
    : planoFotura("sem_plano");
  const usarFotoCapaPublica = Boolean(perfil?.hero_galeria_ativo) && Boolean(perfil?.hero_foto_capa_ativo) && plano.recursos.heroFotoGaleria;

  let capaUrl: string | null = null;
  if (desbloqueada && !linkExpirado && usarFotoCapaPublica && p.capa_galeria_id && p.capa_arquivo) {
    const { data } = await supabase.storage.from("fotos").createSignedUrl(
      `${p.user_id}/${p.capa_galeria_id}/${p.capa_arquivo}`, 60 * 60
    );
    capaUrl = data?.signedUrl ?? null;
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
      titulo: String(g.titulo || "Pasta"),
      ordem: Number(g.ordem ?? 0),
      etapa: String(g.etapa || (g.prova ? "prova" : "entrega")),
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
