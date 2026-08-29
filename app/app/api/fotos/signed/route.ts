import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { temAcessoGaleria } from "../../../../lib/gallery-access";
import { consumirRateLimit } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
const EXPIRA_SEG = 3600;
const LISTA_LOTE = 1000;
const ASSINATURA_LOTE = 200;
const CONCORRENCIA_ASSINATURA = 3;

function json(data: unknown, status = 200, retryAfter?: number) {
  const headers: Record<string, string> = { "Cache-Control": "no-store, private" };
  if (retryAfter) headers["Retry-After"] = String(retryAfter);
  return NextResponse.json(data, { status, headers });
}

export async function GET(req: NextRequest) {
  const galeria = req.nextUrl.searchParams.get("galeria")?.trim();
  if (!galeria) return json({ error: "galeria obrigatória." }, 400);

  const permitido = await consumirRateLimit(req, "signed_gallery_urls", galeria, 60, 40);
  if (!permitido) return json({ error: "Muitas solicitações. Aguarde um minuto." }, 429, 60);

  const supabase = createServiceClient();
  const { data: g } = await supabase
    .from("galerias")
    .select("user_id,capa,link_ate,tem_senha")
    .eq("id", galeria)
    .maybeSingle();

  if (!g) return json({ error: "Galeria não encontrada." }, 404);
  const linkAte = (g.link_ate as string | null) ?? null;
  if (linkAte && Date.now() > new Date(`${linkAte}T23:59:59`).getTime()) return json({ error: "Link expirado." }, 403);
  if (g.tem_senha && !temAcessoGaleria(req, galeria)) return json({ error: "Acesso à galeria necessário." }, 401);

  const dono = g.user_id as string;
  const lista: Array<{ name: string }> = [];
  let offset = 0;
  while (true) {
    const { data: arquivos, error: listError } = await supabase.storage.from("fotos").list(`${dono}/${galeria}`, {
      limit: LISTA_LOTE,
      offset,
      sortBy: { column: "created_at", order: "asc" },
    });
    if (listError) return json({ error: "Não foi possível listar a galeria." }, 500);
    const pagina = arquivos ?? [];
    lista.push(...pagina.filter((f) => f.id !== null).map((f) => ({ name: f.name })));
    if (pagina.length < LISTA_LOTE) break;
    offset += LISTA_LOTE;
  }

  if (lista.length === 0) return json({ fotos: [], capaUrl: null });

  const caminhos: string[] = [];
  for (const f of lista) {
    caminhos.push(`${dono}/${galeria}/${f.name}`);
    caminhos.push(`${dono}/${galeria}/thumbs/${f.name}`);
  }
  const capaFile = (g.capa as string | null) ?? null;
  if (capaFile && !caminhos.includes(`${dono}/${galeria}/${capaFile}`)) caminhos.push(`${dono}/${galeria}/${capaFile}`);

  const lotes: string[][] = [];
  for (let i = 0; i < caminhos.length; i += ASSINATURA_LOTE) lotes.push(caminhos.slice(i, i + ASSINATURA_LOTE));
  const mapa: Record<string, string> = {};
  let cursor = 0;
  let erroAssinatura = false;
  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= lotes.length || erroAssinatura) return;
      const { data, error } = await supabase.storage.from("fotos").createSignedUrls(lotes[i], EXPIRA_SEG);
      if (error) { erroAssinatura = true; return; }
      for (const s of data ?? []) if (s.signedUrl && s.path) mapa[s.path] = s.signedUrl;
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCORRENCIA_ASSINATURA, lotes.length) }, () => worker()));
  if (erroAssinatura) return json({ error: "Não foi possível assinar os arquivos." }, 500);

  const fotos = lista.map((f) => {
    const url = mapa[`${dono}/${galeria}/${f.name}`] ?? "";
    const thumb = mapa[`${dono}/${galeria}/thumbs/${f.name}`] || url;
    return { nome: f.name, url, thumb };
  });
  const capaUrl = capaFile ? (mapa[`${dono}/${galeria}/${capaFile}`] ?? null) : null;
  return json({ fotos, capaUrl });
}
