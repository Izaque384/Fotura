import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";

const PAGE_SIZE = 1000;
const REMOVE_BATCH = 500;

async function listarArquivos(supabase: ReturnType<typeof createServiceClient>, prefixo: string) {
  const nomes: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage
      .from("fotos")
      .list(prefixo, { limit: PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" } });

    if (error) throw error;
    const arquivos = (data ?? []).filter((item) => item.id !== null);
    nomes.push(...arquivos.map((item) => item.name));

    if ((data ?? []).length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return nomes;
}

async function removerEmLotes(supabase: ReturnType<typeof createServiceClient>, caminhos: string[]) {
  for (let i = 0; i < caminhos.length; i += REMOVE_BATCH) {
    const { error } = await supabase.storage.from("fotos").remove(caminhos.slice(i, i + REMOVE_BATCH));
    if (error) throw error;
  }
}

export async function DELETE(req: NextRequest) {
  const authorization = req.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  let body: { galeria?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const galeria = typeof body.galeria === "string" ? body.galeria.trim() : "";
  if (!galeria || galeria.length > 100) {
    return NextResponse.json({ error: "Galeria inválida." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: auth, error: authError } = await supabase.auth.getUser(match[1]);
  if (authError || !auth.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { data: g, error: galleryError } = await supabase
    .from("galerias")
    .select("id,user_id")
    .eq("id", galeria)
    .maybeSingle();

  if (galleryError) return NextResponse.json({ error: "Não foi possível verificar a galeria." }, { status: 500 });
  if (!g || g.user_id !== auth.user.id) return NextResponse.json({ error: "Galeria não encontrada." }, { status: 404 });

  const base = `${auth.user.id}/${galeria}`;

  try {
    const [originais, thumbs] = await Promise.all([
      listarArquivos(supabase, base),
      listarArquivos(supabase, `${base}/thumbs`),
    ]);

    const caminhos = [
      ...originais.map((nome) => `${base}/${nome}`),
      ...thumbs.map((nome) => `${base}/thumbs/${nome}`),
    ];

    await removerEmLotes(supabase, caminhos);
  } catch {
    return NextResponse.json({ error: "Não foi possível excluir todos os arquivos da galeria." }, { status: 500 });
  }

  const { error: selecaoError } = await supabase.from("selecoes").delete().eq("galeria", galeria);
  if (selecaoError) return NextResponse.json({ error: "Os arquivos foram removidos, mas não foi possível concluir a exclusão." }, { status: 500 });

  const { error: senhaError } = await supabase.from("senhas").delete().eq("galeria", galeria);
  if (senhaError) return NextResponse.json({ error: "Os arquivos foram removidos, mas não foi possível concluir a exclusão." }, { status: 500 });

  const { error: galeriaError } = await supabase
    .from("galerias")
    .delete()
    .eq("id", galeria)
    .eq("user_id", auth.user.id);

  if (galeriaError) return NextResponse.json({ error: "Os arquivos foram removidos, mas não foi possível concluir a exclusão." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
