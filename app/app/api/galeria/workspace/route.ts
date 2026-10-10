import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { publicGalleryRef } from "../../../../lib/gallery-links";
import { hashDownloadPin } from "../../../../lib/gallery-download-access";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { uuidValido } from "../../../../lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, private" } });
}

async function usuario(req: NextRequest) {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : data.user ?? null;
}

async function galeriaDoUsuario(galeria: string, userId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase.from("galerias")
    .select("id,user_id,slug,titulo,capa,prova,limite,prazo,link_ate,tem_senha,cliente_id,etapa,entrega_publicada_em,venda_extras_ativa,preco_foto_extra_centavos,projeto_id,download_ativo,download_individual,download_completo,download_tamanho,download_pin_hash,watermark_ativo,watermark_texto,watermark_opacidade,assistente_ativo,criado_em")
    .eq("id", galeria).eq("user_id", userId).maybeSingle();
  return data ?? null;
}

export async function GET(req: NextRequest) {
  const user = await usuario(req);
  if (!user) return json({ error: "Não autorizado." }, 401);
  const galeria = req.nextUrl.searchParams.get("galeria")?.trim() ?? "";
  if (!uuidValido(galeria)) return json({ error: "Galeria inválida." }, 400);
  const supabase = createServiceClient();
  const g = await galeriaDoUsuario(galeria, user.id);
  if (!g) return json({ error: "Galeria não encontrada." }, 404);

  const ref = publicGalleryRef(String(g.slug || "galeria"), String(g.id));
  const [clienteR, selecaoR, listasR, projetosR, presetsR, vendasR, eventosIdR, eventosRefR] = await Promise.all([
    g.cliente_id ? supabase.from("clientes").select("id,nome,email,telefone").eq("id", g.cliente_id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("selecoes").select("fotos,finalizada,comentarios,atualizado_em").eq("galeria", galeria).maybeSingle(),
    supabase.from("selecao_listas").select("id,nome,fotos,comentarios,finalizada,criado_em,atualizado_em").eq("galeria", galeria).eq("user_id", user.id).order("atualizado_em", { ascending: false }),
    supabase.from("galeria_projetos").select("id,nome,descricao,cliente_id,criado_em,atualizado_em").eq("user_id", user.id).order("atualizado_em", { ascending: false }),
    supabase.from("galeria_presets").select("id,nome,config,criado_em,atualizado_em").eq("user_id", user.id).order("atualizado_em", { ascending: false }),
    supabase.from("vendas_fotos").select("id,qtd_extras,valor_total_centavos,moeda,status,criado_em,pago_em").eq("galeria", galeria).eq("fotografo_id", user.id).order("criado_em", { ascending: false }).limit(50),
    supabase.from("produto_eventos").select("id,evento,detalhes,criado_em,sessao_id").eq("entidade", "galeria").eq("entidade_id", galeria).order("criado_em", { ascending: false }).limit(80),
    supabase.from("produto_eventos").select("id,evento,detalhes,criado_em,sessao_id").eq("entidade", "galeria").eq("entidade_id", ref).order("criado_em", { ascending: false }).limit(80),
  ]);

  const eventos = [...(eventosIdR.data ?? []), ...(eventosRefR.data ?? [])]
    .sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)))
    .slice(0, 100);

  return json({
    galeria: {
      ...g,
      download_pin_configurado: Boolean(g.download_pin_hash),
      download_pin_hash: undefined,
      publicRef: ref,
    },
    cliente: clienteR.data ?? null,
    selecao: selecaoR.data ?? null,
    listas: listasR.data ?? [],
    projetos: projetosR.data ?? [],
    presets: presetsR.data ?? [],
    vendas: vendasR.data ?? [],
    eventos,
  });
}

type PatchBody = {
  galeria?: string;
  downloadAtivo?: boolean;
  downloadIndividual?: boolean;
  downloadCompleto?: boolean;
  downloadTamanho?: "original" | "web";
  downloadPin?: string | null;
  watermarkAtivo?: boolean;
  watermarkTexto?: string | null;
  watermarkOpacidade?: number;
  assistenteAtivo?: boolean;
  projetoId?: string | null;
};

export async function PATCH(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return json({ error: "Origem inválida." }, 403);
  const user = await usuario(req);
  if (!user) return json({ error: "Não autorizado." }, 401);
  let body: PatchBody;
  try { body = await req.json() as PatchBody; } catch { return json({ error: "Dados inválidos." }, 400); }
  if (!uuidValido(body.galeria)) return json({ error: "Galeria inválida." }, 400);
  const supabase = createServiceClient();
  const g = await galeriaDoUsuario(body.galeria, user.id);
  if (!g) return json({ error: "Galeria não encontrada." }, 404);

  const update: Record<string, unknown> = {};
  if (typeof body.downloadAtivo === "boolean") update.download_ativo = body.downloadAtivo;
  if (typeof body.downloadIndividual === "boolean") update.download_individual = body.downloadIndividual;
  if (typeof body.downloadCompleto === "boolean") update.download_completo = body.downloadCompleto;
  if (body.downloadTamanho === "original" || body.downloadTamanho === "web") update.download_tamanho = body.downloadTamanho;
  if (body.downloadPin !== undefined) {
    if (body.downloadPin === null || body.downloadPin.trim() === "") update.download_pin_hash = null;
    else {
      const pin = body.downloadPin.trim();
      if (!/^\d{4,8}$/.test(pin)) return json({ error: "O PIN deve ter de 4 a 8 dígitos." }, 400);
      update.download_pin_hash = hashDownloadPin(pin);
    }
  }
  if (typeof body.watermarkAtivo === "boolean") update.watermark_ativo = body.watermarkAtivo;
  if (body.watermarkTexto !== undefined) update.watermark_texto = body.watermarkTexto?.trim().slice(0, 80) || null;
  if (body.watermarkOpacidade !== undefined) {
    const op = Math.round(Number(body.watermarkOpacidade));
    if (!Number.isFinite(op) || op < 5 || op > 70) return json({ error: "Opacidade inválida." }, 400);
    update.watermark_opacidade = op;
  }
  if (typeof body.assistenteAtivo === "boolean") update.assistente_ativo = body.assistenteAtivo;
  if (body.projetoId !== undefined) {
    if (body.projetoId === null || body.projetoId === "") update.projeto_id = null;
    else {
      if (!uuidValido(body.projetoId)) return json({ error: "Projeto inválido." }, 400);
      const { data: projeto } = await supabase.from("galeria_projetos").select("id").eq("id", body.projetoId).eq("user_id", user.id).maybeSingle();
      if (!projeto) return json({ error: "Projeto não encontrado." }, 404);
      update.projeto_id = body.projetoId;
    }
  }
  if (!Object.keys(update).length) return json({ ok: true });
  const { error } = await supabase.from("galerias").update(update).eq("id", body.galeria).eq("user_id", user.id);
  if (error) return json({ error: "Não foi possível salvar as configurações." }, 500);
  return json({ ok: true, downloadPinConfigurado: update.download_pin_hash !== null ? (body.downloadPin !== undefined ? Boolean(update.download_pin_hash) : Boolean(g.download_pin_hash)) : false });
}

type PostBody =
  | { acao: "criar_projeto"; nome?: string; descricao?: string | null; clienteId?: string | null }
  | { acao: "excluir_projeto"; projetoId?: string }
  | { acao: "salvar_preset"; galeria?: string; nome?: string }
  | { acao: "aplicar_preset"; galeria?: string; presetId?: string }
  | { acao: "excluir_preset"; presetId?: string };

export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return json({ error: "Origem inválida." }, 403);
  const user = await usuario(req);
  if (!user) return json({ error: "Não autorizado." }, 401);
  let body: PostBody;
  try { body = await req.json() as PostBody; } catch { return json({ error: "Dados inválidos." }, 400); }
  const supabase = createServiceClient();

  if (body.acao === "criar_projeto") {
    const nome = body.nome?.trim().slice(0, 120) ?? "";
    if (!nome) return json({ error: "Informe o nome do projeto." }, 400);
    let clienteId: string | null = body.clienteId || null;
    if (clienteId) {
      if (!uuidValido(clienteId)) return json({ error: "Cliente inválido." }, 400);
      const { data: cliente } = await supabase.from("clientes").select("id").eq("id", clienteId).eq("user_id", user.id).maybeSingle();
      if (!cliente) return json({ error: "Cliente não encontrado." }, 404);
    }
    const { data, error } = await supabase.from("galeria_projetos").insert({
      user_id: user.id, cliente_id: clienteId, nome, descricao: body.descricao?.trim().slice(0, 500) || null,
    }).select("id,nome,descricao,cliente_id,criado_em,atualizado_em").single();
    return error ? json({ error: "Não foi possível criar o projeto." }, 500) : json({ projeto: data }, 201);
  }

  if (body.acao === "excluir_projeto") {
    if (!uuidValido(body.projetoId)) return json({ error: "Projeto inválido." }, 400);
    await supabase.from("galerias").update({ projeto_id: null }).eq("projeto_id", body.projetoId).eq("user_id", user.id);
    const { error } = await supabase.from("galeria_projetos").delete().eq("id", body.projetoId).eq("user_id", user.id);
    return error ? json({ error: "Não foi possível excluir o projeto." }, 500) : json({ ok: true });
  }

  if (body.acao === "salvar_preset") {
    if (!uuidValido(body.galeria)) return json({ error: "Galeria inválida." }, 400);
    const nome = body.nome?.trim().slice(0, 80) ?? "";
    if (!nome) return json({ error: "Informe o nome do preset." }, 400);
    const g = await galeriaDoUsuario(body.galeria, user.id);
    if (!g) return json({ error: "Galeria não encontrada." }, 404);
    const config = {
      prova: Boolean(g.prova),
      limite: Number(g.limite ?? 0),
      downloadAtivo: Boolean(g.download_ativo),
      downloadIndividual: Boolean(g.download_individual),
      downloadCompleto: Boolean(g.download_completo),
      downloadTamanho: String(g.download_tamanho || "original"),
      watermarkAtivo: Boolean(g.watermark_ativo),
      watermarkTexto: (g.watermark_texto as string | null) ?? null,
      watermarkOpacidade: Number(g.watermark_opacidade ?? 22),
      assistenteAtivo: Boolean(g.assistente_ativo),
    };
    const { data, error } = await supabase.from("galeria_presets").upsert({
      user_id: user.id, nome, config, atualizado_em: new Date().toISOString(),
    }, { onConflict: "user_id,nome" }).select("id,nome,config,criado_em,atualizado_em").single();
    return error ? json({ error: "Não foi possível salvar o preset." }, 500) : json({ preset: data });
  }

  if (body.acao === "aplicar_preset") {
    if (!uuidValido(body.galeria) || !uuidValido(body.presetId)) return json({ error: "Dados inválidos." }, 400);
    const g = await galeriaDoUsuario(body.galeria, user.id);
    if (!g) return json({ error: "Galeria não encontrada." }, 404);
    const { data: preset } = await supabase.from("galeria_presets").select("config").eq("id", body.presetId).eq("user_id", user.id).maybeSingle();
    if (!preset) return json({ error: "Preset não encontrado." }, 404);
    const c = (preset.config ?? {}) as Record<string, unknown>;
    const provaPreset = Boolean(c.prova);
    const mudandoModo = Boolean(g.prova) !== provaPreset;
    let etapaPreset: string | null = null;
    if (mudandoModo) {
      const { data: selecaoExistente, error: selecaoError } = await supabase
        .from("selecoes")
        .select("galeria")
        .eq("galeria", body.galeria)
        .maybeSingle();
      if (selecaoError) return json({ error: "Não foi possível verificar o fluxo atual da galeria." }, 500);
      const etapaAtual = String(g.etapa || (g.prova ? "prova" : "entrega"));
      const fluxoAvancado = Boolean(selecaoExistente)
        || Boolean(g.entrega_publicada_em)
        || etapaAtual === "selecao_finalizada"
        || etapaAtual === "preparando_entrega";
      if (fluxoAvancado) {
        return json({ error: "O modo de prova não pode ser alterado por preset depois que o cliente iniciou o fluxo. As demais configurações podem ser ajustadas manualmente." }, 409);
      }
      etapaPreset = provaPreset ? "prova" : "entrega";
    }
    const update = {
      prova: provaPreset,
      ...(etapaPreset ? { etapa: etapaPreset } : {}),
      limite: Math.max(0, Number(c.limite ?? 0) || 0),
      download_ativo: c.downloadAtivo !== false,
      download_individual: c.downloadIndividual !== false,
      download_completo: c.downloadCompleto !== false,
      download_tamanho: c.downloadTamanho === "web" ? "web" : "original",
      watermark_ativo: c.watermarkAtivo === true,
      watermark_texto: typeof c.watermarkTexto === "string" ? c.watermarkTexto.slice(0, 80) : null,
      watermark_opacidade: Math.min(70, Math.max(5, Number(c.watermarkOpacidade ?? 22) || 22)),
      assistente_ativo: c.assistenteAtivo !== false,
    };
    const { error } = await supabase.from("galerias").update(update).eq("id", body.galeria).eq("user_id", user.id);
    return error ? json({ error: "Não foi possível aplicar o preset." }, 500) : json({ ok: true });
  }

  if (body.acao === "excluir_preset") {
    if (!uuidValido(body.presetId)) return json({ error: "Preset inválido." }, 400);
    const { error } = await supabase.from("galeria_presets").delete().eq("id", body.presetId).eq("user_id", user.id);
    return error ? json({ error: "Não foi possível excluir o preset." }, 500) : json({ ok: true });
  }

  return json({ error: "Ação inválida." }, 400);
}
