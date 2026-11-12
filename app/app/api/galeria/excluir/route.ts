import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { registrarErro } from "../../../../lib/observability";
import { uuidValido } from "../../../../lib/validation";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { isR2ReadEnabled } from "../../../../lib/r2-storage";

export async function DELETE(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
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
  if (!uuidValido(galeria)) {
    return NextResponse.json({ error: "Galeria inválida." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: auth, error: authError } = await supabase.auth.getUser(match[1]);
  if (authError || !auth.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const permitido = await consumirRateLimit(req, "gallery_delete", auth.user.id, 10 * 60, 20);
  if (!permitido) return NextResponse.json({ error: "Aguarde alguns minutos e tente novamente." }, { status: 429, headers: { "Retry-After": "600" } });

  const { data: g, error: galleryError } = await supabase
    .from("galerias")
    .select("id,user_id,projeto_id")
    .eq("id", galeria)
    .maybeSingle();

  if (galleryError) {
    registrarErro("gallery.delete.lookup", req, galleryError, { galeria });
    return NextResponse.json({ error: "Não foi possível verificar a galeria." }, { status: 500 });
  }
  if (!g || g.user_id !== auth.user.id) return NextResponse.json({ error: "Galeria não encontrada." }, { status: 404 });

  // Until the R2 cleanup worker is implemented, refuse destructive actions
  // involving registered R2 photos instead of orphaning them after DB deletion.
  if (isR2ReadEnabled()) {
    const prefix = auth.user.id + "/" + galeria + "/";
    const { data: r2Files, error: r2LookupError } = await supabase
      .from("fotura_media_objects").select("object_key")
      .eq("bucket", "fotos").eq("owner_id", auth.user.id)
      .like("object_key", prefix + "%").limit(1);
    if (r2LookupError) {
      return NextResponse.json({ error: "Não foi possível validar os arquivos da galeria." }, { status: 503 });
    }
    if ((r2Files ?? []).length) {
      return NextResponse.json({
        error: "A exclusão de galerias com arquivos no R2 está em preparação. Nenhum dado foi excluído.",
      }, { status: 409 });
    }
    const { data: pending, error: pendingError } = await supabase
      .from("fotura_r2_upload_reservations").select("object_key")
      .eq("bucket", "fotos").eq("owner_id", auth.user.id)
      .like("object_key", prefix + "%").limit(1);
    if (pendingError) return NextResponse.json({
      error: "Não foi possível verificar os uploads R2 pendentes.",
    }, { status: 503 });
    if ((pending ?? []).length) return NextResponse.json({
      error: "Esta galeria possui um envio R2 pendente. Nenhum arquivo foi excluído.",
    }, { status: 409 });
  }


  let eraCapaProjeto = false;
  if (g.projeto_id) {
    const { data: projeto } = await supabase.from("galeria_projetos")
      .select("capa_galeria_id,modelo")
      .eq("id", g.projeto_id)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (projeto?.modelo === "ensaio" || projeto?.modelo === "entrega") {
      return NextResponse.json({ error: "Esta é a galeria principal do projeto. Para remover todas as fotos, exclua o projeto inteiro." }, { status: 409 });
    }
    eraCapaProjeto = projeto?.capa_galeria_id === galeria;
  }

  // The deletion trigger persists the cleanup job in the same transaction.
  // The worker confirms completion only after checking the full storage prefix.
  const { data: removida, error: dbError } = await supabase.rpc("excluir_dados_galeria_backend", {
    p_galeria: galeria,
    p_user_id: auth.user.id,
  });

  if (dbError || removida !== true) {
    registrarErro("gallery.delete.database", req, dbError ?? new Error("RPC retornou falso"), { galeria });
    return NextResponse.json(
      { error: "Não foi possível concluir a exclusão dos dados da galeria." },
      { status: 500 }
    );
  }

  if (g.projeto_id) {
    const agora = new Date().toISOString();
    const projetoUpdate: Record<string, unknown> = { atualizado_em: agora };
    if (eraCapaProjeto) {
      projetoUpdate.capa_galeria_id = null;
      projetoUpdate.capa_arquivo = null;
    }
    await supabase.from("galeria_projetos")
      .update(projetoUpdate)
      .eq("id", g.projeto_id)
      .eq("user_id", auth.user.id);

    const { data: restantes } = await supabase.from("galerias")
      .select("id")
      .eq("projeto_id", g.projeto_id)
      .eq("user_id", auth.user.id)
      .order("ordem", { ascending: true })
      .order("criado_em", { ascending: true });
    for (let i = 0; i < (restantes ?? []).length; i++) {
      await supabase.from("galerias")
        .update({ ordem: i })
        .eq("id", restantes![i].id)
        .eq("user_id", auth.user.id);
    }
  }

  return NextResponse.json({
    ok: true,
    limpezaPendente: true,
    aviso: "A galeria foi excluída. A remoção dos arquivos está na fila e será verificada automaticamente.",
  });
}
