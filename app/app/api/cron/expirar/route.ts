import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";

const DIAS_APOS_EXPIRACAO = 30;
const PAGE_SIZE = 1000;
const REMOVE_BATCH_SIZE = 500;
const MAX_GALERIAS_POR_EXECUCAO = 25;
const MAX_ORFAOS_POR_EXECUCAO = 1000;

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

async function limparGaleria(supabase: ServiceClient, dono: string, gid: string) {
  const raiz = `${dono}/${gid}`;
  const [originais, thumbs] = await Promise.all([
    listarTodosArquivos(supabase, raiz),
    listarTodosArquivos(supabase, `${raiz}/thumbs`),
  ]);

  if (originais.erro || thumbs.erro) return false;

  const caminhos = [...originais.caminhos, ...thumbs.caminhos];
  if (!(await removerEmLotes(supabase, caminhos))) return false;

  // A remoção é idempotente, mas confirmamos o estado final antes de marcar o banco.
  const [restantesOriginais, restantesThumbs] = await Promise.all([
    listarTodosArquivos(supabase, raiz),
    listarTodosArquivos(supabase, `${raiz}/thumbs`),
  ]);
  if (
    restantesOriginais.erro ||
    restantesThumbs.erro ||
    restantesOriginais.caminhos.length > 0 ||
    restantesThumbs.caminhos.length > 0
  ) return false;

  const { error } = await supabase
    .from("galerias")
    .update({ storage_limpo: true, storage_limpo_em: new Date().toISOString() })
    .eq("id", gid)
    .eq("user_id", dono)
    .or("storage_limpo.is.null,storage_limpo.eq.false");

  return !error;
}

async function limparOrfaos(supabase: ServiceClient) {
  const { data, error } = await supabase.rpc("listar_objetos_orfaos_backend", {
    p_limite: MAX_ORFAOS_POR_EXECUCAO,
  });
  if (error) return { removidos: 0, falhou: true };

  const caminhos = ((data ?? []) as Array<{ caminho: string }>).map((x) => x.caminho).filter(Boolean);
  if (!caminhos.length) return { removidos: 0, falhou: false };

  const ok = await removerEmLotes(supabase, caminhos);
  return { removidos: ok ? caminhos.length : 0, falhou: !ok };
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
    .select("id,user_id,link_ate")
    .not("link_ate", "is", null)
    .lte("link_ate", limite)
    .or("storage_limpo.is.null,storage_limpo.eq.false")
    .order("link_ate", { ascending: true })
    .limit(MAX_GALERIAS_POR_EXECUCAO);

  if (galeriasError) {
    return NextResponse.json(
      { error: "Não foi possível consultar galerias expiradas." },
      { status: 500 }
    );
  }

  let limpas = 0;
  let falhas = 0;

  for (const g of galerias ?? []) {
    const ok = await limparGaleria(supabase, g.user_id as string, g.id as string);
    if (ok) limpas++;
    else falhas++;
  }

  const orfaos = await limparOrfaos(supabase);
  if (orfaos.falhou) falhas++;

  const { count: pendentes } = await supabase
    .from("galerias")
    .select("id", { head: true, count: "exact" })
    .not("link_ate", "is", null)
    .lte("link_ate", limite)
    .or("storage_limpo.is.null,storage_limpo.eq.false");

  return NextResponse.json({
    ok: falhas === 0,
    processadas: (galerias ?? []).length,
    limpas,
    falhas,
    orfaos_removidos: orfaos.removidos,
    pendentes: pendentes ?? null,
    mensagem:
      falhas === 0
        ? `${limpas} galeria${limpas === 1 ? "" : "s"} limpa${limpas === 1 ? "" : "s"}; ${orfaos.removidos} arquivo${orfaos.removidos === 1 ? "" : "s"} órfão${orfaos.removidos === 1 ? "" : "s"} removido${orfaos.removidos === 1 ? "" : "s"}.`
        : `${limpas} galeria${limpas === 1 ? "" : "s"} limpa${limpas === 1 ? "" : "s"}; ${falhas} falha${falhas === 1 ? "" : "s"} ficará${falhas === 1 ? "" : "ão"} para nova tentativa.`,
  });
}
