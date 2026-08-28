import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { temAcessoGaleria } from "../../../../lib/gallery-access";

const EXPIRA_SEG = 3600;

export async function GET(req: NextRequest) {
  const galeria = req.nextUrl.searchParams.get("galeria");
  if (!galeria) return NextResponse.json({ error: "galeria obrigatória." }, { status: 400 });

  const supabase = createServiceClient();
  const { data: g } = await supabase
    .from("galerias")
    .select("user_id,capa,link_ate,tem_senha")
    .eq("id", galeria)
    .maybeSingle();

  if (!g) return NextResponse.json({ error: "Galeria não encontrada." }, { status: 404 });
  const linkAte = (g.link_ate as string | null) ?? null;
  if (linkAte && Date.now() > new Date(`${linkAte}T23:59:59`).getTime()) {
    return NextResponse.json({ error: "Link expirado." }, { status: 403 });
  }
  if (g.tem_senha && !temAcessoGaleria(req, galeria)) {
    return NextResponse.json({ error: "Acesso à galeria necessário." }, { status: 401 });
  }

  const dono = g.user_id as string;
  const { data: arquivos, error: listError } = await supabase.storage.from("fotos").list(`${dono}/${galeria}`, { limit: 500 });
  if (listError) return NextResponse.json({ error: "Não foi possível listar a galeria." }, { status: 500 });

  const lista = (arquivos ?? []).filter((f) => f.id !== null);
  if (lista.length === 0) return NextResponse.json({ fotos: [], capaUrl: null });

  const caminhos: string[] = [];
  for (const f of lista) {
    caminhos.push(`${dono}/${galeria}/${f.name}`);
    caminhos.push(`${dono}/${galeria}/thumbs/${f.name}`);
  }
  const capaFile = (g.capa as string | null) ?? null;
  if (capaFile && !caminhos.includes(`${dono}/${galeria}/${capaFile}`)) caminhos.push(`${dono}/${galeria}/${capaFile}`);

  const { data: signed, error: signedError } = await supabase.storage.from("fotos").createSignedUrls(caminhos, EXPIRA_SEG);
  if (signedError) return NextResponse.json({ error: "Não foi possível assinar os arquivos." }, { status: 500 });

  const mapa: Record<string, string> = {};
  for (const s of signed ?? []) if (s.signedUrl && s.path) mapa[s.path] = s.signedUrl;
  const fotos = lista.map((f) => {
    const url = mapa[`${dono}/${galeria}/${f.name}`] ?? "";
    const thumb = mapa[`${dono}/${galeria}/thumbs/${f.name}`] || url;
    return { nome: f.name, url, thumb };
  });
  const capaUrl = capaFile ? (mapa[`${dono}/${galeria}/${capaFile}`] ?? null) : null;
  return NextResponse.json({ fotos, capaUrl });
}
