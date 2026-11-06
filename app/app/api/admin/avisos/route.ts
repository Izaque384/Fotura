import { NextRequest, NextResponse } from "next/server";
import { validarAdmin, registrarAdminAuditoria } from "../../../../lib/admin-server";
import { registrarErro } from "../../../../lib/observability";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIPOS = new Set(["informacao", "novidade", "atencao"]);
const headers = { "Cache-Control": "no-store, private" };

async function autorizar(req: NextRequest) {
  const auth = await validarAdmin(req, "admin.avisos.auth");
  if ("error" in auth) return { error: auth.error } as const;
  if (auth.papel !== "owner") return {
    error: NextResponse.json({ error: "Somente o responsável pelo Fotura pode gerenciar os avisos." }, { status: 403, headers })
  } as const;
  return { auth } as const;
}
function formatar(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const form = raw as Record<string, unknown>;
  const titulo = typeof form.titulo === "string" ? form.titulo.trim() : "";
  const mensagem = typeof form.mensagem === "string" ? form.mensagem.trim() : "";
  const tipo = typeof form.tipo === "string" ? form.tipo : "";
  if (titulo.length < 3 || titulo.length > 120 || mensagem.length < 3 || mensagem.length > 3000 || !TIPOS.has(tipo)) return null;
  return { titulo, mensagem, tipo };
}
function indisponivel() { return NextResponse.json({ error: "Não foi possível concluir a operação com os avisos." }, { status: 500, headers }); }
function invalido() { return NextResponse.json({ error: "Dados inválidos. Revise o conteúdo e tente novamente." }, { status: 400, headers }); }

export async function GET(req: NextRequest) {
  const gate = await autorizar(req);
  if ("error" in gate) return gate.error;
  try {
    const { data, error } = await gate.auth.supabase.from("avisos_globais")
      .select("id,titulo,mensagem,tipo,ativo,versao,publicado_em,criado_em,atualizado_em")
      .order("criado_em", { ascending: false }).limit(200);
    if (error) throw error;
    return NextResponse.json({ avisos: data || [] }, { headers });
  } catch (error) { registrarErro("admin.avisos.list", req, error); return indisponivel(); }
}

export async function POST(req: NextRequest) {
  const gate = await autorizar(req);
  if ("error" in gate) return gate.error;
  const body = await req.json().catch(() => null);
  const data = formatar(body);
  if (!data) return invalido();
  try {
    const { data: aviso, error } = await gate.auth.supabase.from("avisos_globais")
      .insert({ ...data, ativo: false, criado_por: gate.auth.adminUserId })
      .select("id,titulo,mensagem,tipo,ativo,versao,publicado_em,criado_em,atualizado_em").single();
    if (error || !aviso) throw error || new Error("Aviso não retornado");
    await registrarAdminAuditoria({
      ...gate.auth, req, acao: "aviso_criado", entidade: "aviso_global", entidadeId: aviso.id,
      detalhes: { tipo: aviso.tipo }
    });
    return NextResponse.json({ aviso }, { status: 201, headers });
  } catch (error) { registrarErro("admin.avisos.create", req, error, { userId: gate.auth.adminUserId }); return indisponivel(); }
}

export async function PATCH(req: NextRequest) {
  const gate = await autorizar(req);
  if ("error" in gate) return gate.error;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const acao = typeof body?.acao === "string" ? body.acao : "";
  if (!UUID.test(id) || !["editar", "publicar", "desativar"].includes(acao)) return invalido();

  try {
    const { data: anterior, error: readError } = await gate.auth.supabase.from("avisos_globais")
      .select("id,versao,ativo").eq("id", id).single();
    if (readError || !anterior) return NextResponse.json({ error: "Aviso não encontrado." }, { status: 404, headers });
    let update: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
    if (acao === "editar") {
      const parsed = formatar(body);
      if (!parsed) return invalido();
      update = { ...update, ...parsed, versao: anterior.versao + 1 };
    } else if (acao === "publicar") {
      if (anterior.ativo) return invalido();
      update = { ...update, ativo: true, publicado_em: new Date().toISOString(), versao: anterior.versao + 1 };
    } else {
      if (!anterior.ativo) return invalido();
      update = { ...update, ativo: false, publicado_em: null };
    }
    const { data: aviso, error } = await gate.auth.supabase.from("avisos_globais")
      .update(update).eq("id", id).eq("versao", anterior.versao)
      .select("id,titulo,mensagem,tipo,ativo,versao,publicado_em,criado_em,atualizado_em").single();
    if (error || !aviso) throw error || new Error("Aviso desatualizado");
    await registrarAdminAuditoria({
      ...gate.auth, req, acao: "aviso_" + acao, entidade: "aviso_global", entidadeId: id,
      detalhes: { tipo: aviso.tipo, versao: aviso.versao }
    });
    return NextResponse.json({ aviso }, { headers });
  } catch (error) { registrarErro("admin.avisos.update", req, error, { userId: gate.auth.adminUserId }); return indisponivel(); }
}

export async function DELETE(req: NextRequest) {
  const gate = await autorizar(req);
  if ("error" in gate) return gate.error;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!UUID.test(id)) return invalido();
  try {
    const { data, error } = await gate.auth.supabase.from("avisos_globais")
      .delete().eq("id", id).select("id,tipo");
    if (error) throw error;
    if (!data?.length) return NextResponse.json({ error: "Aviso não encontrado." }, { status: 404, headers });
    await registrarAdminAuditoria({
      ...gate.auth, req, acao: "aviso_excluido", entidade: "aviso_global", entidadeId: id,
      detalhes: { tipo: data[0].tipo }
    });
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) { registrarErro("admin.avisos.delete", req, error, { userId: gate.auth.adminUserId }); return indisponivel(); }
}
