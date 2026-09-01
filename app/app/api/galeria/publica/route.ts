import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { temAcessoGaleria } from "../../../../lib/gallery-access";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { uuidValido } from "../../../../lib/validation";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200, retryAfter?: number) {
  const headers: Record<string, string> = { "Cache-Control": "no-store, private" };
  if (retryAfter) headers["Retry-After"] = String(retryAfter);
  return NextResponse.json(data, { status, headers });
}

export async function GET(req: NextRequest) {
  const galeria = req.nextUrl.searchParams.get("galeria")?.trim();
  if (!uuidValido(galeria)) return json({ error: "galeria inválida." }, 400);

  const permitido = await consumirRateLimit(req, "public_gallery_metadata", galeria, 60, 120);
  if (!permitido) return json({ error: "Muitas solicitações. Aguarde um minuto." }, 429, 60);

  const supabase = createServiceClient();
  const { data: g, error: galeriaError } = await supabase
    .from("galerias")
    .select("user_id,titulo,capa,prova,limite,prazo,link_ate,tem_senha")
    .eq("id", galeria)
    .maybeSingle();

  if (galeriaError) {
    console.error("[public-gallery] failed to load gallery metadata", {
      code: galeriaError.code,
      galeria,
    });
    return json({ error: "Não foi possível carregar a galeria." }, 500);
  }
  if (!g) return json({ error: "Galeria não encontrada." }, 404);

  const linkAte = (g.link_ate as string | null) ?? null;
  const linkExpirado = Boolean(linkAte && Date.now() > new Date(`${linkAte}T23:59:59`).getTime());
  const protegida = Boolean(g.tem_senha);
  const desbloqueada = !protegida || temAcessoGaleria(req, galeria);

  const { data: perfil, error: perfilError } = await supabase
    .from("perfis")
    .select("nome_estudio,logo_url,cor_hero,hero_galeria_ativo,hero_galeria_estilo")
    .eq("id", g.user_id)
    .maybeSingle();

  if (perfilError) {
    console.error("[public-gallery] failed to load studio profile", {
      code: perfilError.code,
      galeria,
    });
    return json({ error: "Não foi possível carregar a galeria." }, 500);
  }

  let selecao: { fotos: string[]; finalizada: boolean; comentarios: Record<string, string> } | null = null;
  if (desbloqueada && !linkExpirado) {
    const { data: s, error: selecaoError } = await supabase
      .from("selecoes")
      .select("fotos,finalizada,comentarios")
      .eq("galeria", galeria)
      .maybeSingle();

    if (selecaoError) {
      console.error("[public-gallery] failed to load selection", {
        code: selecaoError.code,
        galeria,
      });
      return json({ error: "Não foi possível carregar a galeria." }, 500);
    }

    if (s) selecao = {
      fotos: (s.fotos as string[]) ?? [],
      finalizada: Boolean(s.finalizada),
      comentarios: (s.comentarios as Record<string, string>) ?? {},
    };
  }

  return json({
    galeria: {
      titulo: (g.titulo as string) || "Galeria",
      capa: (g.capa as string | null) ?? null,
      prova: Boolean(g.prova),
      limite: (g.limite as number) ?? 0,
      prazo: (g.prazo as string | null) ?? null,
      linkAte,
      temSenha: protegida,
      desbloqueada,
      linkExpirado,
    },
    perfil: perfil ? {
      nome: (perfil.nome_estudio as string | null) ?? null,
      logo: (perfil.logo_url as string | null) ?? null,
      cor: (perfil.cor_hero as string | null) ?? null,
      heroAtivo: Boolean(perfil.hero_galeria_ativo),
      heroEstilo: ((perfil.hero_galeria_estilo as string | null) ?? "premium") as "minimal" | "premium" | "tech",
    } : { nome: null, logo: null, cor: null, heroAtivo: false, heroEstilo: "premium" },
    selecao,
  });
}
