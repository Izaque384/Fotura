import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";

const DIAS_APOS_EXPIRACAO = 30;

export async function GET(req: NextRequest) {
  /* Segurança: só aceita chamadas com o CRON_SECRET correto */
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = createServiceClient();
  const limite = new Date(Date.now() - DIAS_APOS_EXPIRACAO * 86400000)
    .toISOString()
    .slice(0, 10);

  /* Busca galerias com link vencido há 30+ dias e que ainda têm fotos */
  const { data: galerias } = await supabase
    .from("galerias")
    .select("id, user_id, titulo, link_ate")
    .not("link_ate", "is", null)
    .lte("link_ate", limite)
    .or("storage_limpo.is.null,storage_limpo.eq.false");

  if (!galerias || galerias.length === 0) {
    return NextResponse.json({ ok: true, mensagem: "Nada para limpar.", limpas: 0 });
  }

  let limpas = 0;

  for (const g of galerias) {
    const dono = g.user_id as string;
    const gid = g.id as string;

    /* Lista fotos da galeria */
    const { data: arquivos } = await supabase.storage
      .from("fotos")
      .list(`${dono}/${gid}`, { limit: 500 });

    /* Lista thumbs */
    const { data: thumbs } = await supabase.storage
      .from("fotos")
      .list(`${dono}/${gid}/thumbs`, { limit: 500 });

    const caminhos: string[] = [];
    for (const f of arquivos ?? []) {
      if (f.id !== null) caminhos.push(`${dono}/${gid}/${f.name}`);
    }
    for (const t of thumbs ?? []) {
      if (t.id !== null) caminhos.push(`${dono}/${gid}/thumbs/${t.name}`);
    }

    if (caminhos.length > 0) {
      await supabase.storage.from("fotos").remove(caminhos);
    }

    /* Marca como limpo */
    await supabase
      .from("galerias")
      .update({ storage_limpo: true })
      .eq("id", gid);

    limpas++;
  }

  return NextResponse.json({
    ok: true,
    mensagem: `${limpas} galeria${limpas === 1 ? "" : "s"} limpa${limpas === 1 ? "" : "s"}.`,
    limpas,
  });
}