import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { registrarErro } from "../../../../lib/observability";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { uuidValido } from "../../../../lib/validation";

export const dynamic = "force-dynamic";

async function usuario(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

async function listarFinais(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  galeriaId: string
) {
  const arquivos: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage.from("fotos").list(`${userId}/${galeriaId}/entrega`, {
      limit: 1000,
      offset,
      sortBy: { column: "created_at", order: "asc" },
    });
    if (error) throw error;
    const pagina = data ?? [];
    arquivos.push(...pagina.filter((item) => item.id !== null && item.name !== "thumbs").map((item) => item.name));
    if (pagina.length < 1000) break;
    offset += 1000;
  }
  return arquivos;
}

export async function GET(req: NextRequest) {
  const auth = await usuario(req);
  if (!auth) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const galeria = req.nextUrl.searchParams.get("galeria")?.trim();
  if (!uuidValido(galeria)) return NextResponse.json({ error: "Galeria inválida." }, { status: 400 });

  const { data: g, error: galleryError } = await auth.supabase
    .from("galerias")
    .select("id,titulo,etapa,prova,cliente_id,link_ate")
    .eq("id", galeria)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (galleryError) {
    registrarErro("gallery.delivery.lookup", req, galleryError, { galeria });
    return NextResponse.json({ error: "Não foi possível verificar a galeria." }, { status: 500 });
  }
  if (!g) return NextResponse.json({ error: "Galeria não encontrada." }, { status: 404 });

  const { data: selecao, error: selectionError } = await auth.supabase
    .from("selecoes")
    .select("fotos,finalizada")
    .eq("galeria", galeria)
    .maybeSingle();
  if (selectionError) {
    registrarErro("gallery.delivery.selection", req, selectionError, { galeria });
    return NextResponse.json({ error: "Não foi possível carregar a seleção da galeria." }, { status: 500 });
  }

  let finais: string[] = [];
  try { finais = await listarFinais(auth.supabase, auth.user.id, galeria); }
  catch (error) {
    registrarErro("gallery.delivery.storage_list", req, error, { galeria });
    return NextResponse.json({ error: "Não foi possível carregar a entrega final." }, { status: 500 });
  }

  return NextResponse.json({
    galeria: {
      id: g.id,
      titulo: (g.titulo as string) || "Galeria",
      etapa: (g.etapa as string | null) || (g.prova ? "prova" : "entrega"),
      prova: Boolean(g.prova),
      clienteId: (g.cliente_id as string | null) ?? null,
      linkAte: (g.link_ate as string | null) ?? null,
    },
    selecao: {
      fotos: (selecao?.fotos as string[]) ?? [],
      finalizada: Boolean(selecao?.finalizada),
    },
    finais,
  }, { headers: { "Cache-Control": "no-store, private" } });
}

type Body = { galeria?: string; acao?: "iniciar" | "publicar" };

export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) {
    return NextResponse.json({ error: "Origem da requisição não permitida." }, { status: 403 });
  }

  const auth = await usuario(req);
  if (!auth) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  let body: Body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 400 }); }

  const galeria = body.galeria?.trim();
  if (!uuidValido(galeria) || (body.acao !== "iniciar" && body.acao !== "publicar")) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const permitido = await consumirRateLimit(req, "gallery_delivery_write", `${auth.user.id}:${galeria}`, 10 * 60, 60);
  if (!permitido) {
    return NextResponse.json(
      { error: "Muitas alterações em pouco tempo. Aguarde alguns minutos." },
      { status: 429, headers: { "Retry-After": "600" } }
    );
  }

  const { data: g, error: galleryError } = await auth.supabase
    .from("galerias")
    .select("id,etapa,prova")
    .eq("id", galeria)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (galleryError) {
    registrarErro("gallery.delivery.write_lookup", req, galleryError, { galeria, acao: body.acao });
    return NextResponse.json({ error: "Não foi possível verificar a galeria." }, { status: 500 });
  }
  if (!g) return NextResponse.json({ error: "Galeria não encontrada." }, { status: 404 });

  const etapa = (g.etapa as string | null) || (g.prova ? "prova" : "entrega");

  if (body.acao === "iniciar") {
    if (etapa === "entrega") return NextResponse.json({ ok: true, etapa: "entrega" });
    const { data: selecao, error: selectionError } = await auth.supabase
      .from("selecoes")
      .select("finalizada,fotos")
      .eq("galeria", galeria)
      .maybeSingle();
    if (selectionError) {
      registrarErro("gallery.delivery.start_selection", req, selectionError, { galeria });
      return NextResponse.json({ error: "Não foi possível verificar a seleção da galeria." }, { status: 500 });
    }
    if (!selecao?.finalizada || !Array.isArray(selecao.fotos) || selecao.fotos.length === 0) {
      return NextResponse.json({ error: "O cliente ainda não finalizou uma seleção válida." }, { status: 409 });
    }
    if (etapa !== "selecao_finalizada" && etapa !== "preparando_entrega") {
      return NextResponse.json({ error: "Esta galeria ainda não está pronta para preparar a entrega." }, { status: 409 });
    }
    if (etapa === "preparando_entrega") return NextResponse.json({ ok: true, etapa });
    const { error } = await auth.supabase.from("galerias").update({ etapa: "preparando_entrega", prova: true }).eq("id", galeria).eq("user_id", auth.user.id);
    if (error) {
      registrarErro("gallery.delivery.start_update", req, error, { galeria });
      return NextResponse.json({ error: "Não foi possível iniciar a preparação da entrega." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, etapa: "preparando_entrega" });
  }

  let finais: string[];
  try { finais = await listarFinais(auth.supabase, auth.user.id, galeria); }
  catch (error) {
    registrarErro("gallery.delivery.publish_storage", req, error, { galeria });
    return NextResponse.json({ error: "Não foi possível validar as fotos finais." }, { status: 500 });
  }
  if (!finais.length) return NextResponse.json({ error: "Envie pelo menos uma foto final antes de publicar." }, { status: 409 });
  if (etapa !== "preparando_entrega" && etapa !== "selecao_finalizada" && etapa !== "entrega") {
    return NextResponse.json({ error: "Esta galeria não está pronta para publicação final." }, { status: 409 });
  }

  const { error } = await auth.supabase.from("galerias").update({
    etapa: "entrega",
    prova: false,
    storage_limpo: false,
    storage_limpo_em: null,
  }).eq("id", galeria).eq("user_id", auth.user.id);
  if (error) {
    registrarErro("gallery.delivery.publish_update", req, error, { galeria });
    return NextResponse.json({ error: "Não foi possível publicar a entrega." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, etapa: "entrega", quantidade: finais.length });
}
