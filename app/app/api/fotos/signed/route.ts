import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";

const EXPIRA_SEG = 3600; // 1 hora

export async function GET(req: NextRequest) {
  const galeria = req.nextUrl.searchParams.get("galeria");
  if (!galeria) {
    return NextResponse.json({ error: "galeria obrigatória." }, { status: 400 });
  }

  const supabase = createServiceClient();

  /* Busca a galeria pra descobrir o dono e verificar validade */
  const { data: g } = await supabase
    .from("galerias")
    .select("user_id, titulo, capa, prova, limite, prazo, link_ate, tem_senha")
    .eq("id", galeria)
    .maybeSingle();

  if (!g) {
    return NextResponse.json({ error: "Galeria não encontrada." }, { status: 404 });
  }

  /* Verifica se o link expirou */
  const linkAte = (g.link_ate as string | null) ?? null;
  if (linkAte && Date.now() > new Date(linkAte + "T23:59:59").getTime()) {
    return NextResponse.json({ error: "Link expirado." }, { status: 403 });
  }

  const dono = g.user_id as string;

  /* Lista arquivos da galeria (exclui pasta thumbs) */
  const { data: arquivos } = await supabase.storage
    .from("fotos")
    .list(`${dono}/${galeria}`, { limit: 500 });

  const lista = (arquivos ?? []).filter((f) => f.id !== null);

  if (lista.length === 0) {
    return NextResponse.json({ fotos: [], capaUrl: null });
  }

  /* Monta caminhos: original + thumb pra cada foto */
  const caminhos: string[] = [];
  for (const f of lista) {
    caminhos.push(`${dono}/${galeria}/${f.name}`);
    caminhos.push(`${dono}/${galeria}/thumbs/${f.name}`);
  }

  /* Capa (se definida) */
  const capaFile = (g.capa as string | null) ?? null;
  if (capaFile && !caminhos.includes(`${dono}/${galeria}/${capaFile}`)) {
    caminhos.push(`${dono}/${galeria}/${capaFile}`);
  }

  /* Gera links assinados em lote */
  const { data: signed } = await supabase.storage
    .from("fotos")
    .createSignedUrls(caminhos, EXPIRA_SEG);

  const mapa: Record<string, string> = {};
  for (const s of signed ?? []) {
    if (s.signedUrl && s.path) mapa[s.path] = s.signedUrl;
  }

  const fotos = lista.map((f) => {
    const url = mapa[`${dono}/${galeria}/${f.name}`] ?? "";
    const thumb = mapa[`${dono}/${galeria}/thumbs/${f.name}`] || url;
    return { nome: f.name, url, thumb };
  });

  const capaUrl = capaFile ? (mapa[`${dono}/${galeria}/${capaFile}`] ?? null) : null;

  return NextResponse.json({ fotos, capaUrl });
}