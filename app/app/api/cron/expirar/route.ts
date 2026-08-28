import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";

const DIAS_APOS_EXPIRACAO = 30;
const PAGE_SIZE = 1000;
const REMOVE_BATCH_SIZE = 500;

type ServiceClient = ReturnType<typeof createServiceClient>;

async function listarTodosArquivos(
  supabase: ServiceClient,
  prefixo: string
): Promise<{ caminhos: string[]; erro: boolean }> {
  const caminhos: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage
      .from("fotos")
      .list(prefixo, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) return { caminhos, erro: true };

    const itens = data ?? [];
    for (const item of itens) {
      if (item.id !== null) caminhos.push(`${prefixo}/${item.name}`);
    }

    if (itens.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return { caminhos, erro: false };
}

async function removerEmLotes(supabase: ServiceClient, caminhos: string[]) {
  for (let i = 0; i < caminhos.length; i += REMOVE_BATCH_SIZE) {
    const lote = caminhos.slice(i, i + REMOVE_BATCH_SIZE);
    const { error } = await supabase.storage.from("fotos").remove(lote);
    if (error) return false;
  }
  return true;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = req.headers.get("authorization");
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = createServiceClient();
  const limite = new Date(Date.now() - DIAS_APOS_EXPIRACAO * 86400000)
    .toISOString()
    .slice(0, 10);

  const { data: galerias, error: galeriasError } = await supabase
    .from("galerias")
    .select("id, user_id, titulo, link_ate")
    .not("link_ate", "is", null)
    .lte("link_ate", limite)
    .or("storage_limpo.is.null,storage_limpo.eq.false");

  if (galeriasError) {
    return NextResponse.json(
      { error: "Não foi possível consultar galerias expiradas." },
      { status: 500 }
    );
  }

  if (!galerias || galerias.length === 0) {
    return NextResponse.json({ ok: true, mensagem: "Nada para limpar.", limpas: 0, falhas: 0 });
  }

  let limpas = 0;
  let falhas = 0;

  for (const g of galerias) {
    const dono = g.user_id as string;
    const gid = g.id as string;
    const raiz = `${dono}/${gid}`;

    const [originais, thumbs] = await Promise.all([
      listarTodosArquivos(supabase, raiz),
      listarTodosArquivos(supabase, `${raiz}/thumbs`),
    ]);

    if (originais.erro || thumbs.erro) {
      falhas++;
      continue;
    }

    const caminhos = [...originais.caminhos, ...thumbs.caminhos];
    const removeu = await removerEmLotes(supabase, caminhos);
    if (!removeu) {
      falhas++;
      continue;
    }

    const { error: updateError } = await supabase
      .from("galerias")
      .update({ storage_limpo: true })
      .eq("id", gid);

    if (updateError) {
      falhas++;
      continue;
    }

    limpas++;
  }

  return NextResponse.json({
    ok: falhas === 0,
    mensagem:
      falhas === 0
        ? `${limpas} galeria${limpas === 1 ? "" : "s"} limpa${limpas === 1 ? "" : "s"}.`
        : `${limpas} galeria${limpas === 1 ? "" : "s"} limpa${limpas === 1 ? "" : "s"}; ${falhas} com falha e pendente${falhas === 1 ? "" : "s"} para nova tentativa.`,
    limpas,
    falhas,
  });
}
