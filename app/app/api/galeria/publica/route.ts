import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { temAcessoGaleria } from "../../../../lib/gallery-access";

export async function GET(req: NextRequest) {
  const galeria = req.nextUrl.searchParams.get("galeria");
  if (!galeria) return NextResponse.json({ error: "galeria obrigatória." }, { status: 400 });

  const supabase = createServiceClient();
  const { data: g } = await supabase
    .from("galerias")
    .select("user_id,titulo,capa,prova,limite,prazo,link_ate,tem_senha")
    .eq("id", galeria)
    .maybeSingle();

  if (!g) return NextResponse.json({ error: "Galeria não encontrada." }, { status: 404 });

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

  return NextResponse.json({
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
