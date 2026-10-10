import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { temAcessoDownload } from "../../../../lib/gallery-download-access";
import { temAcessoGaleria } from "../../../../lib/gallery-access";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { uuidValido } from "../../../../lib/validation";
import { dataCalendarioExpirada } from "../../../../lib/date-only";

export const dynamic = "force-dynamic";

function arquivoValido(nome: string) {
  return nome.length > 0 && nome.length <= 300 && !nome.includes("/") && !nome.includes("\\") && !/[\u0000-\u001f\u007f]/.test(nome);
}

export async function GET(req: NextRequest) {
  const galeria = req.nextUrl.searchParams.get("galeria")?.trim() ?? "";
  const arquivo = req.nextUrl.searchParams.get("arquivo")?.trim() ?? "";
  const tipo = req.nextUrl.searchParams.get("tipo") === "todos" ? "todos" : "individual";
  if (!uuidValido(galeria) || !arquivoValido(arquivo)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const permitido = await consumirRateLimit(req, "gallery_download", galeria, 60, tipo === "todos" ? 400 : 120);
  if (!permitido) return NextResponse.json({ error: "Muitas solicitações." }, { status: 429 });

  const supabase = createServiceClient();
  const { data: g } = await supabase.from("galerias")
    .select("id,user_id,tem_senha,link_ate,prova,etapa,download_ativo,download_individual,download_completo,download_tamanho,download_pin_hash")
    .eq("id", galeria).maybeSingle();
  if (!g) return NextResponse.json({ error: "Galeria não encontrada." }, { status: 404 });
  if (dataCalendarioExpirada((g.link_ate as string | null) ?? null)) return NextResponse.json({ error: "Link expirado." }, { status: 403 });
  if (g.tem_senha && !temAcessoGaleria(req, galeria)) return NextResponse.json({ error: "Acesso à galeria necessário." }, { status: 401 });
  const etapa = String(g.etapa || (g.prova ? "prova" : "entrega"));
  if (g.prova && etapa !== "entrega") return NextResponse.json({ error: "Downloads ficam disponíveis após a entrega." }, { status: 403 });
  if (!g.download_ativo || (tipo === "todos" ? !g.download_completo : !g.download_individual)) return NextResponse.json({ error: "Este download não está habilitado." }, { status: 403 });
  if (g.download_pin_hash && !temAcessoDownload(req, galeria)) return NextResponse.json({ error: "PIN necessário.", pinNecessario: true }, { status: 401 });

  const base = g.prova && etapa === "entrega" ? `${g.user_id}/${galeria}/entrega` : `${g.user_id}/${galeria}`;
  const tamanho = g.download_tamanho === "web" ? "web" : "original";
  const caminho = tamanho === "web" ? `${base}/thumbs/${arquivo}` : `${base}/${arquivo}`;
  let { data, error } = await supabase.storage.from("fotos").createSignedUrl(caminho, 5 * 60, { download: arquivo });
  if ((error || !data?.signedUrl) && tamanho === "web") {
    const fallback = await supabase.storage.from("fotos").createSignedUrl(`${base}/${arquivo}`, 5 * 60, { download: arquivo });
    data = fallback.data; error = fallback.error;
  }
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Arquivo não disponível." }, { status: 404 });

  await supabase.from("produto_eventos").insert({
    user_id: g.user_id,
    evento: tipo === "todos" ? "gallery_download_all" : "gallery_download_single",
    rota: `/g/${galeria}`,
    entidade: "galeria",
    entidade_id: galeria,
    detalhes: { arquivo, tamanho, origem: "cliente" },
  });

  return NextResponse.json({ url: data.signedUrl, nome: arquivo, tamanho }, { headers: { "Cache-Control": "no-store, private" } });
}
