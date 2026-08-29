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
  const { data: g } = await supabase
    .from("galerias")
    .select("user_id,titulo,capa,prova,limite,prazo,link_ate,tem_senha")
    .eq("id", galeria)
    .maybeSingle();

  if (!g) return json({ error: "Galeria não encontrada." }, 404);

  const linkAte = (g.link_ate as string | null) ?? null;
  const linkExpirado = Boolean(linkAte && Date.now() > new Date(`${linkAte}T23:59:59`).getTime());
  const protegida = Boolean(g.tem_senha);
  const desbloqueada = !protegida || temAcessoGaleria(req, galeria);

  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome_estudio,logo_url,cor_hero")
    .eq("id", g.user_id)
    .maybeSingle();

  let selecao: { fotos: string[]; finalizada: boolean; comentarios: Record<string, string> } | null = null;
  if (desbloqueada && !linkExpirado) {
    const { data: s } = await supabase
      .from("selecoes")
      .select("fotos,finalizada,comentarios")
      .eq("galeria", galeria)
      .maybeSingle();
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
    } : { nome: null, logo: null, cor: null },
    selecao,
  });
}
