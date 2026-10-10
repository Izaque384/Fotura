import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { temAcessoGaleria } from "../../../../lib/gallery-access";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { uuidValido } from "../../../../lib/validation";
import { dataCalendarioExpirada } from "../../../../lib/date-only";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, private" } });
}

function nomeArquivoValido(valor: unknown): valor is string {
  return typeof valor === "string" && valor.length > 0 && valor.length <= 300 && !valor.includes("/") && !valor.includes("\\") && !/[\u0000-\u001f\u007f]/.test(valor);
}

function comentariosValidos(valor: unknown) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const saida: Record<string, string> = {};
  for (const [chave, texto] of Object.entries(valor as Record<string, unknown>)) {
    if (!nomeArquivoValido(chave) || typeof texto !== "string" || texto.length > 2000) return null;
    saida[chave] = texto;
    if (Object.keys(saida).length > 500) return null;
  }
  return saida;
}

async function contexto(req: NextRequest, galeria: string) {
  const supabase = createServiceClient();
  const { data: g } = await supabase.from("galerias").select("id,user_id,tem_senha,link_ate").eq("id", galeria).maybeSingle();
  if (!g) return { erro: json({ error: "Galeria não encontrada." }, 404), supabase, g: null };
  if (dataCalendarioExpirada((g.link_ate as string | null) ?? null)) return { erro: json({ error: "Link expirado." }, 403), supabase, g: null };
  if (g.tem_senha && !temAcessoGaleria(req, galeria)) return { erro: json({ error: "Acesso à galeria necessário." }, 401), supabase, g: null };
  return { erro: null, supabase, g };
}

export async function GET(req: NextRequest) {
  const galeria = req.nextUrl.searchParams.get("galeria")?.trim() ?? "";
  if (!uuidValido(galeria)) return json({ error: "Galeria inválida." }, 400);
  const ctx = await contexto(req, galeria);
  if (ctx.erro || !ctx.g) return ctx.erro!;
  const { data, error } = await ctx.supabase.from("selecao_listas").select("id,nome,fotos,comentarios,finalizada,criado_em,atualizado_em").eq("galeria", galeria).order("criado_em", { ascending: true });
  return error ? json({ error: "Não foi possível carregar as listas." }, 500) : json({ listas: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return json({ error: "Origem inválida." }, 403);
  let body: { galeria?: string; nome?: string };
  try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }
  if (!uuidValido(body.galeria)) return json({ error: "Galeria inválida." }, 400);
  const nome = body.nome?.trim().slice(0, 80) ?? "";
  if (!nome) return json({ error: "Informe o nome da lista." }, 400);
  const permitido = await consumirRateLimit(req, "gallery_named_list", body.galeria, 10 * 60, 20);
  if (!permitido) return json({ error: "Muitas alterações em pouco tempo." }, 429);
  const ctx = await contexto(req, body.galeria);
  if (ctx.erro || !ctx.g) return ctx.erro!;
  const { count } = await ctx.supabase.from("selecao_listas").select("id", { count: "exact", head: true }).eq("galeria", body.galeria);
  if ((count ?? 0) >= 8) return json({ error: "Esta galeria já possui o máximo de 8 listas adicionais." }, 400);
  const { data, error } = await ctx.supabase.from("selecao_listas").insert({
    galeria: body.galeria, user_id: ctx.g.user_id, nome,
  }).select("id,nome,fotos,comentarios,finalizada,criado_em,atualizado_em").single();
  if (error) return json({ error: error.code === "23505" ? "Já existe uma lista com esse nome." : "Não foi possível criar a lista." }, 400);
  await ctx.supabase.from("produto_eventos").insert({
    user_id: ctx.g.user_id, evento: "gallery_favorite_list_created", rota: `/g/${body.galeria}`, entidade: "galeria", entidade_id: body.galeria, detalhes: { lista: nome },
  });
  return json({ lista: data }, 201);
}

export async function PATCH(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return json({ error: "Origem inválida." }, 403);
  let body: { galeria?: string; id?: string; fotos?: unknown; comentarios?: unknown; nome?: string; finalizada?: boolean };
  try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }
  if (!uuidValido(body.galeria) || !uuidValido(body.id)) return json({ error: "Dados inválidos." }, 400);
  const ctx = await contexto(req, body.galeria);
  if (ctx.erro || !ctx.g) return ctx.erro!;
  const update: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (body.fotos !== undefined) {
    if (!Array.isArray(body.fotos) || body.fotos.length > 500 || !body.fotos.every(nomeArquivoValido)) return json({ error: "Seleção inválida." }, 400);
    update.fotos = Array.from(new Set(body.fotos as string[]));
  }
  if (body.comentarios !== undefined) {
    const comentarios = comentariosValidos(body.comentarios);
    if (!comentarios) return json({ error: "Comentários inválidos." }, 400);
    update.comentarios = comentarios;
  }
  if (body.nome !== undefined) {
    const nome = body.nome.trim().slice(0, 80);
    if (!nome) return json({ error: "Nome inválido." }, 400);
    update.nome = nome;
  }
  if (typeof body.finalizada === "boolean") update.finalizada = body.finalizada;
  const { data, error } = await ctx.supabase.from("selecao_listas").update(update).eq("id", body.id).eq("galeria", body.galeria).select("id,nome,fotos,comentarios,finalizada,criado_em,atualizado_em").maybeSingle();
  if (error || !data) return json({ error: "Não foi possível atualizar a lista." }, 500);
  return json({ lista: data });
}

export async function DELETE(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return json({ error: "Origem inválida." }, 403);
  const galeria = req.nextUrl.searchParams.get("galeria")?.trim() ?? "";
  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!uuidValido(galeria) || !uuidValido(id)) return json({ error: "Dados inválidos." }, 400);
  const ctx = await contexto(req, galeria);
  if (ctx.erro || !ctx.g) return ctx.erro!;
  const { error } = await ctx.supabase.from("selecao_listas").delete().eq("id", id).eq("galeria", galeria);
  return error ? json({ error: "Não foi possível excluir a lista." }, 500) : json({ ok: true });
}
