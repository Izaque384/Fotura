import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { publicGalleryRef } from "../../../../lib/gallery-links";
import { publicProjectRef } from "../../../../lib/project-links";
import { hashDownloadPin } from "../../../../lib/gallery-download-access";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { registrarErro } from "../../../../lib/observability";
import { uuidValido } from "../../../../lib/validation";
import { ordemFotosValida, type OrdemFotos } from "../../../../lib/gallery-photo-order";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { validarAbertura } from "../../../../lib/cinematic-intro";
import { MODELOS_PROJETO,modeloValido,configProjeto } from "../../../../lib/project-templates";

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

function slugify(valor: string) {
  return valor.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "") || "pasta";
}

async function projetoDoUsuario(projeto: string, userId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase.from("galeria_projetos")
    .select("id,user_id,cliente_id,nome,descricao,slug,capa_galeria_id,capa_arquivo,prova,limite,prazo,link_ate,tem_senha,venda_extras_ativa,preco_foto_extra_centavos,download_ativo,download_individual,download_completo,download_tamanho,download_pin_hash,watermark_ativo,watermark_texto,watermark_opacidade,assistente_ativo,abertura_config,config_revisada_em,criado_em,atualizado_em")
    .eq("id", projeto).eq("user_id", userId).maybeSingle();
  return data ?? null;
}

async function contarFotos(userId: string, pasta: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("listar_fotos_galeria_storage", {
    p_galeria: pasta,
    p_user: userId,
    p_variante: "principal",
  });
  return error || !Array.isArray(data) ? 0 : data.length;
}

async function urlCapa(projeto: {
  user_id: string;
  capa_galeria_id: string | null;
  capa_arquivo: string | null;
}) {
  if (!projeto.capa_galeria_id || !projeto.capa_arquivo) return null;
  const supabase = createServiceClient();
  const caminho=`${projeto.user_id}/${projeto.capa_galeria_id}/thumbs/${projeto.capa_arquivo}`;
  const { data } = await supabase.storage.from("fotos").createSignedUrl(caminho, 60 * 60);
  return data?.signedUrl ?? null;
}

async function urlsCapasPastas(userId: string, pastas: Array<{ id: unknown; capa: unknown }>) {
  const comCapa = pastas
    .map((g) => ({ id: String(g.id), capa: typeof g.capa === "string" && g.capa ? g.capa : null }))
    .filter((g): g is { id: string; capa: string } => Boolean(g.capa));
  const mapa = new Map<string, string>();
  if (!comCapa.length) return mapa;

  const supabase = createServiceClient();
  const thumbs = comCapa.map((g) => `${userId}/${g.id}/thumbs/${g.capa}`);
  const thumbPorPasta = new Map(comCapa.map((g) => [`${userId}/${g.id}/thumbs/${g.capa}`, g.id]));
  const { data: thumbsAssinadas } = await supabase.storage.from("fotos").createSignedUrls(thumbs, 60 * 60);
  for (const item of thumbsAssinadas ?? []) {
    if (!item.path || !item.signedUrl) continue;
    const pastaId = thumbPorPasta.get(item.path);
    if (pastaId) mapa.set(pastaId, item.signedUrl);
  }

  return mapa;
}

export async function GET(req: NextRequest) {
  const user = await usuario(req);
  if (!user) return json({ error: "Não autorizado." }, 401);
  const projeto = req.nextUrl.searchParams.get("projeto")?.trim() ?? "";
  if (!uuidValido(projeto)) return json({ error: "Projeto inválido." }, 400);

  const supabase = createServiceClient();
  const p = await projetoDoUsuario(projeto, user.id);
  if (!p) return json({ error: "Projeto não encontrado." }, 404);

  const capaPasta = req.nextUrl.searchParams.get("capaPasta")?.trim();
  if (capaPasta) {
    if (!uuidValido(capaPasta)) return json({ error: "Pasta inválida." }, 400);
    const { data: pasta } = await supabase.from("galerias").select("id").eq("id", capaPasta)
      .eq("projeto_id", projeto).eq("user_id", user.id).maybeSingle();
    if (!pasta) return json({ error: "Pasta não encontrada." }, 404);

    const nomes: string[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: arquivos, error } = await supabase.storage.from("fotos").list(`${user.id}/${capaPasta}`, {
        limit: 1000, offset, sortBy: { column: "created_at", order: "asc" },
      });
      if (error) return json({ error: "Não foi possível carregar as fotos." }, 500);
      const pagina = arquivos ?? [];
      nomes.push(...pagina.filter(a => a.id !== null && a.name !== "thumbs" && a.name !== "entrega").map(a => a.name));
      if (pagina.length < 1000) break;
    }
    if (!nomes.length) return json({ fotos: [] });

    const caminhos = nomes.map((nome) => `${user.id}/${capaPasta}/thumbs/${nome}`);
    const mapa = new Map<string, string>();
    for (let i = 0; i < caminhos.length; i += 200) {
      const { data: thumbs, error } = await supabase.storage.from("fotos").createSignedUrls(caminhos.slice(i, i + 200), 15 * 60);
      if (error) return json({ error: "Não foi possível carregar as prévias." }, 500);
      for (const x of thumbs ?? []) if (x.path && x.signedUrl) mapa.set(x.path, x.signedUrl);
    }
    return json({
      fotos: nomes.map((nome) => ({
        nome,
        url: mapa.get(`${user.id}/${capaPasta}/thumbs/${nome}`) || "",
      })).filter((item) => item.url),
    });
  }

  const { data: pastas, error: pastasError } = await supabase.from("galerias")
    .select("id,slug,titulo,capa,ordem,ordem_fotos,visivel,etapa,prova,criado_em,entrega_publicada_em")
    .eq("projeto_id", projeto).eq("user_id", user.id)
    .order("ordem", { ascending: true }).order("criado_em", { ascending: true });
  if (pastasError) return json({ error: "Não foi possível carregar as pastas." }, 500);

  const ids = (pastas ?? []).map((g) => String(g.id));
  const refs = (pastas ?? []).map((g) => publicGalleryRef(String(g.slug || "pasta"), String(g.id)));
  const [clienteR, clientesR, selecoesR, vendasR, eventosR, presetsR, perfilR, assinaturaR, capa, capasPastas] = await Promise.all([
    p.cliente_id ? supabase.from("clientes").select("id,nome,email,telefone").eq("id", p.cliente_id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("clientes").select("id,nome,email,telefone").eq("user_id", user.id).order("nome"),
    ids.length ? supabase.from("selecoes").select("galeria,fotos,finalizada,comentarios,atualizado_em").in("galeria", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("vendas_fotos").select("id,galeria,qtd_extras,valor_total_centavos,moeda,status,criado_em,pago_em").eq("fotografo_id", user.id).in("galeria", ids).order("criado_em", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("produto_eventos").select("id,evento,entidade_id,detalhes,criado_em,sessao_id").eq("entidade", "galeria").in("entidade_id", [...ids, ...refs]).order("criado_em", { ascending: false }).limit(150) : Promise.resolve({ data: [] }),
    supabase.from("galeria_presets").select("id,nome,config,criado_em,atualizado_em").eq("user_id", user.id).order("atualizado_em", { ascending: false }),
    supabase.from("perfis").select("stripe_recebimentos_ativo").eq("id", user.id).maybeSingle(),
    supabase.from("assinaturas").select("plano_codigo,status").eq("user_id", user.id).maybeSingle(),
    urlCapa(p as typeof p & { user_id: string }),
    urlsCapasPastas(user.id, pastas ?? []),
  ]);

  const contagens = await Promise.all((pastas ?? []).map((g) => contarFotos(user.id, String(g.id))));
  const selecaoPorPasta = new Map((selecoesR.data ?? []).map((s) => [String(s.galeria), s]));
  const planoCodigo=String(assinaturaR.data?.plano_codigo??"sem_plano");
  const assinaturaAtiva=["active","trialing","past_due"].includes(String(assinaturaR.data?.status??""));
  const planoComVendas=assinaturaAtiva&&["legacy","essencial","profissional","studio"].includes(planoCodigo);
  const stripeRecebimentosAtivo=Boolean(perfilR.data?.stripe_recebimentos_ativo);

  return json({
    projeto: {
      ...p,
      download_pin_configurado: Boolean(p.download_pin_hash),
      download_pin_hash: undefined,
      publicRef: publicProjectRef(String(p.slug || "projeto"), String(p.id)),
      capaUrl: capa,
    },
    cliente: clienteR.data ?? null,
    clientes: clientesR.data ?? [],
    pastas: (pastas ?? []).map((g, i) => ({
      ...g,
      qtd: contagens[i] ?? 0,
      publicRef: refs[i],
      capaUrl: capasPastas.get(String(g.id)) ?? capa ?? null,
      selecao: selecaoPorPasta.get(String(g.id)) ?? null,
    })),
    vendas: vendasR.data ?? [],
    eventos: eventosR.data ?? [],
    presets: presetsR.data ?? [],
    comercial: {
      planoCodigo,
      assinaturaAtiva,
      stripeRecebimentosAtivo,
      vendaFotosDisponivel: planoComVendas && stripeRecebimentosAtivo,
    },
  });
}

type PatchBody = {
  projeto?: string;
  nome?: string;
  descricao?: string | null;
  clienteId?: string | null;
  prova?: boolean;
  limite?: number;
  prazo?: string | null;
  linkAte?: string | null;
  senha?: string | null;
  removerSenha?: boolean;
  vendaExtrasAtiva?: boolean;
  precoFotoExtraCentavos?: number | null;
  downloadAtivo?: boolean;
  downloadIndividual?: boolean;
  downloadCompleto?: boolean;
  downloadTamanho?: "original" | "web";
  downloadPin?: string | null;
  watermarkAtivo?: boolean;
  watermarkTexto?: string | null;
  watermarkOpacidade?: number;
  assistenteAtivo?: boolean;
  abertura?: unknown;
  capaPastaId?: string | null;
  capaArquivo?: string | null;
  removerCapa?: boolean;
};

export async function PATCH(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return json({ error: "Origem inválida." }, 403);
  const user = await usuario(req);
  if (!user) return json({ error: "Não autorizado." }, 401);
  let body: PatchBody;
  try { body = await req.json() as PatchBody; } catch { return json({ error: "Dados inválidos." }, 400); }
  if (!uuidValido(body.projeto)) return json({ error: "Projeto inválido." }, 400);
  const supabase = createServiceClient();
  const p = await projetoDoUsuario(body.projeto!, user.id);
  if (!p) return json({ error: "Projeto não encontrado." }, 404);

  const update: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (body.nome !== undefined) {
    const nome = body.nome.trim().slice(0, 120);
    if (!nome) return json({ error: "Informe o nome do projeto." }, 400);
    update.nome = nome;
  }
  if (body.descricao !== undefined) update.descricao = body.descricao?.trim().slice(0, 500) || null;
  if (body.clienteId !== undefined) {
    if (body.clienteId) {
      if (!uuidValido(body.clienteId)) return json({ error: "Cliente inválido." }, 400);
      const { data: cliente } = await supabase.from("clientes").select("id").eq("id", body.clienteId).eq("user_id", user.id).maybeSingle();
      if (!cliente) return json({ error: "Cliente não encontrado." }, 404);
      update.cliente_id = body.clienteId;
    } else update.cliente_id = null;
  }
  if (typeof body.prova === "boolean") update.prova = body.prova;
  if (body.limite !== undefined) {
    const limite = Math.round(Number(body.limite));
    if (!Number.isFinite(limite) || limite < 0 || limite > 100000) return json({ error: "Limite inválido." }, 400);
    update.limite = limite;
  }
  if (body.prazo !== undefined) update.prazo = body.prazo || null;
  if (body.linkAte !== undefined) update.link_ate = body.linkAte || null;
  if (typeof body.vendaExtrasAtiva === "boolean") update.venda_extras_ativa = body.vendaExtrasAtiva;
  if (body.precoFotoExtraCentavos !== undefined) {
    const preco = body.precoFotoExtraCentavos === null ? null : Math.round(Number(body.precoFotoExtraCentavos));
    if (preco !== null && (!Number.isFinite(preco) || preco < 100)) return json({ error: "O preço por foto extra deve ser de pelo menos R$ 1,00." }, 400);
    update.preco_foto_extra_centavos = preco;
  }
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
  if (body.abertura !== undefined) {
    const abertura = validarAbertura(body.abertura);
    if (!abertura) return json({ error: "Configuração da abertura inválida. Escolha até três fotos e revise os campos." }, 400);
    if (abertura.fotos.length) {
      const ids = [...new Set(abertura.fotos.map((foto) => foto.pastaId))];
      const { data: permitidas, error: pastasErro } = await supabase.from("galerias").select("id")
        .eq("projeto_id", body.projeto).eq("user_id", user.id).eq("visivel", true).in("id", ids);
      if (pastasErro || (permitidas ?? []).length !== ids.length) {
        return json({ error: "As fotos da abertura devem pertencer a pastas publicadas deste projeto." }, 400);
      }
      const verificacoes = await Promise.all(abertura.fotos.map(async (foto) => {
        const { data, error } = await supabase.storage.from("fotos")
          .list(`${user.id}/${foto.pastaId}`, { limit: 100, search: foto.arquivo });
        return !error && (data ?? []).some((item) => item.id !== null && item.name === foto.arquivo);
      }));
      if (verificacoes.some((existe) => !existe)) {
        return json({ error: "Uma das fotografias da abertura não está mais disponível." }, 400);
      }
    }
    update.abertura_config = abertura;
  }

  if (body.removerCapa) {
    update.capa_galeria_id = null;
    update.capa_arquivo = null;
  } else if (body.capaPastaId !== undefined || body.capaArquivo !== undefined) {
    if (!uuidValido(body.capaPastaId) || !body.capaArquivo || body.capaArquivo.includes("/") || body.capaArquivo.includes("\\")) {
      return json({ error: "Capa inválida." }, 400);
    }
    const { data: pasta } = await supabase.from("galerias").select("id").eq("id", body.capaPastaId)
      .eq("projeto_id", body.projeto).eq("user_id", user.id).maybeSingle();
    if (!pasta) return json({ error: "A pasta da capa não pertence ao projeto." }, 400);
    const { data: encontrados } = await supabase.storage.from("fotos").list(`${user.id}/${body.capaPastaId}`, {
      limit: 20, search: body.capaArquivo,
    });
    if (!(encontrados ?? []).some((item) => item.id !== null && item.name === body.capaArquivo)) {
      return json({ error: "A foto escolhida para capa não foi encontrada." }, 404);
    }
    update.capa_galeria_id = body.capaPastaId;
    update.capa_arquivo = body.capaArquivo;
  }

  const { error } = await supabase.from("galeria_projetos").update(update).eq("id", body.projeto).eq("user_id", user.id);
  if (error) return json({ error: "Não foi possível salvar o projeto." }, 500);
  // Os controles de prova e entrega são globais no workspace: manter cada pasta alinhada.
  const camposPasta = ["prova","limite","prazo","link_ate","download_ativo","download_individual","download_completo","download_tamanho","download_pin_hash","watermark_ativo","watermark_texto","watermark_opacidade","assistente_ativo"];
  const atualizarPastas = Object.fromEntries(Object.entries(update).filter(([campo])=>camposPasta.includes(campo)));
  if(Object.keys(atualizarPastas).length){
    const sincronizacao=await supabase.from("galerias").update(atualizarPastas).eq("projeto_id",body.projeto).eq("user_id",user.id);
    if(sincronizacao.error)return json({error:"O projeto foi salvo, mas não foi possível atualizar todas as pastas. Salve novamente antes de compartilhar."},500);
  }

  const { data: pastas } = await supabase.from("galerias").select("id").eq("projeto_id", body.projeto).eq("user_id", user.id);
  const pastaIds = (pastas ?? []).map((g) => String(g.id));

  if (body.removerSenha) {
    await Promise.all([
      supabase.from("projeto_senhas").delete().eq("projeto", body.projeto),
      pastaIds.length ? supabase.from("senhas").delete().in("galeria", pastaIds) : Promise.resolve({ error: null }),
      supabase.from("galeria_projetos").update({ tem_senha: false, atualizado_em: new Date().toISOString() }).eq("id", body.projeto).eq("user_id", user.id),
    ]);
  } else if (body.senha !== undefined && body.senha !== null && body.senha.trim()) {
    const senha = body.senha.trim();
    if (senha.length > 256) return json({ error: "Senha muito longa." }, 400);
    const { error: senhaError } = await supabase.from("projeto_senhas").upsert({
      projeto: body.projeto, senha, atualizado_em: new Date().toISOString(),
    });
    if (senhaError) return json({ error: "Não foi possível atualizar a senha." }, 500);
    if (pastaIds.length) {
      await supabase.from("senhas").upsert(pastaIds.map((id) => ({ galeria: id, senha, atualizado_em: new Date().toISOString() })), { onConflict: "galeria" });
    }
    await supabase.from("galeria_projetos").update({ tem_senha: true, atualizado_em: new Date().toISOString() }).eq("id", body.projeto).eq("user_id", user.id);
  }

  return json({ ok: true });
}

type PostBody =
  | { acao: "criar_projeto"; nome?: string; descricao?: string | null; clienteId?: string | null; modelo?: string; presetId?: string | null }
  | { acao: "criar_pasta"; projetoId?: string; nome?: string }
  | { acao: "reordenar_pastas"; projetoId?: string; pastas?: string[] }
  | { acao: "atualizar_pasta"; projetoId?: string; pastaId?: string; nome?: string; visivel?: boolean; capaArquivo?: string | null; ordemFotos?: OrdemFotos }
  | { acao: "definir_capa_se_vazia"; projetoId?: string; pastaId?: string; arquivo?: string }
  | { acao: "excluir_projeto"; projetoId?: string; confirmacao?: string };

export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return json({ error: "Origem inválida." }, 403);
  const user = await usuario(req);
  if (!user) return json({ error: "Não autorizado." }, 401);
  let body: PostBody;
  try { body = await req.json() as PostBody; } catch { return json({ error: "Dados inválidos." }, 400); }
  const escopoRate=body.acao==="excluir_projeto"?"project_delete":"project_write";
  const limiteRate=body.acao==="excluir_projeto"?8:120;
  const permitido=await consumirRateLimit(req,escopoRate,user.id,10*60,limiteRate);
  if(!permitido)return json({error:"Muitas alterações em pouco tempo. Aguarde alguns minutos e tente novamente."},429);
  const supabase = createServiceClient();

  if (body.acao === "criar_projeto") {
    const nome = body.nome?.trim().slice(0, 120) ?? "";
    if (!nome) return json({ error: "Informe o nome do projeto." }, 400);
    const clienteId = body.clienteId || null;
    if (clienteId) {
      if (!uuidValido(clienteId)) return json({ error: "Cliente inválido." }, 400);
      const { data: cliente } = await supabase.from("clientes").select("id").eq("id", clienteId).eq("user_id", user.id).maybeSingle();
      if (!cliente) return json({ error: "Cliente não encontrado." }, 404);
    }
    let configuracao = modeloValido(body.modelo) ? MODELOS_PROJETO[body.modelo].config : MODELOS_PROJETO.ensaio.config;
    if(body.presetId){
      if(!uuidValido(body.presetId))return json({error:"Modelo inválido."},400);
      const {data:preset}=await supabase.from("galeria_presets").select("config").eq("id",body.presetId).eq("user_id",user.id).maybeSingle();
      if(!preset)return json({error:"Modelo não encontrado."},404);
      const validado=configProjeto(preset.config);if(!validado)return json({error:"Modelo incompatível."},400);
      configuracao=validado;
    }
    const { data, error } = await supabase.from("galeria_projetos").insert({
      ...configuracao,
      user_id: user.id,
      cliente_id: clienteId,
      nome,
      descricao: body.descricao?.trim().slice(0, 500) || null,
      slug: slugify(nome),
    }).select("id,nome,slug").single();
    if (error || !data) return json({ error: "Não foi possível criar o projeto." }, 500);
    return json({ projeto: { ...data, publicRef: publicProjectRef(String(data.slug), String(data.id)) } }, 201);
  }

  if (body.acao === "criar_pasta") {
    if (!uuidValido(body.projetoId)) return json({ error: "Projeto inválido." }, 400);
    const nome = body.nome?.trim().slice(0, 120) ?? "";
    if (!nome) return json({ error: "Informe o nome da pasta." }, 400);
    const p = await projetoDoUsuario(body.projetoId!, user.id);
    if (!p) return json({ error: "Projeto não encontrado." }, 404);
    const { data: ordemData } = await supabase.from("galerias").select("ordem").eq("projeto_id", body.projetoId).eq("user_id", user.id).order("ordem", { ascending: false }).limit(1);
    const ordem = Number(ordemData?.[0]?.ordem ?? -1) + 1;
    const { data, error } = await supabase.from("galerias").insert({
      user_id: user.id,
      projeto_id: body.projetoId,
      slug: slugify(nome),
      titulo: nome,
      cliente_id: p.cliente_id,
      prova: p.prova,
      limite: p.limite,
      prazo: p.prazo,
      link_ate: p.link_ate,
      download_ativo: p.download_ativo,
      download_individual: p.download_individual,
      download_completo: p.download_completo,
      download_tamanho: p.download_tamanho,
      download_pin_hash: p.download_pin_hash,
      watermark_ativo: p.watermark_ativo,
      watermark_texto: p.watermark_texto,
      watermark_opacidade: p.watermark_opacidade,
      assistente_ativo: p.assistente_ativo,
      ordem,
      visivel: true,
    }).select("id,slug,titulo,ordem,visivel").single();
    if (error || !data) return json({ error: "Não foi possível criar a pasta." }, 500);
    await supabase.from("galeria_projetos").update({ atualizado_em: new Date().toISOString() }).eq("id", body.projetoId).eq("user_id", user.id);
    return json({ pasta: data }, 201);
  }

  if (body.acao === "reordenar_pastas") {
    if (!uuidValido(body.projetoId) || !Array.isArray(body.pastas) || body.pastas.length > 200 || !body.pastas.every(uuidValido)) {
      return json({ error: "Ordem inválida." }, 400);
    }
    const { data: existentes } = await supabase.from("galerias").select("id").eq("projeto_id", body.projetoId).eq("user_id", user.id);
    const ids = (existentes ?? []).map((g) => String(g.id));
    if (ids.length !== body.pastas.length || ids.some((id) => !body.pastas!.includes(id))) return json({ error: "A lista de pastas está incompleta." }, 400);
    for (let i = 0; i < body.pastas.length; i++) {
      const { error } = await supabase.from("galerias").update({ ordem: i }).eq("id", body.pastas[i]).eq("projeto_id", body.projetoId).eq("user_id", user.id);
      if (error) return json({ error: "Não foi possível reordenar as pastas." }, 500);
    }
    await supabase.from("galeria_projetos").update({ atualizado_em: new Date().toISOString() }).eq("id", body.projetoId).eq("user_id", user.id);
    return json({ ok: true });
  }

  if (body.acao === "atualizar_pasta") {
    if (!uuidValido(body.projetoId) || !uuidValido(body.pastaId)) {
      return json({ error: "Pasta inválida." }, 400);
    }
    const projeto = await projetoDoUsuario(body.projetoId!, user.id);
    if (!projeto) return json({ error: "Projeto não encontrado." }, 404);

    const { data: pastaAtual } = await supabase.from("galerias").select("id")
      .eq("id", body.pastaId).eq("projeto_id", body.projetoId).eq("user_id", user.id).maybeSingle();
    if (!pastaAtual) return json({ error: "Pasta não encontrada." }, 404);
    const update: Record<string, unknown> = {};
    if (body.capaArquivo !== undefined) {
      if (body.capaArquivo === null) update.capa = null;
      else {
        const arquivo = body.capaArquivo;
        if (typeof arquivo !== "string" || !arquivo || arquivo.length > 300 || arquivo.includes("/") || arquivo.includes("\\") || /[\u0000-\u001f\u007f]/.test(arquivo)) {
          return json({ error: "Capa inválida." }, 400);
        }
        const { data: encontrados, error: storageError } = await supabase.storage.from("fotos")
          .list(`${user.id}/${body.pastaId}`, { limit: 100, search: arquivo });
        if (storageError) return json({ error: "Não foi possível verificar a foto." }, 500);
        if (!(encontrados ?? []).some(item => item.id !== null && item.name === arquivo)) {
          return json({ error: "A foto escolhida não pertence a esta pasta." }, 404);
        }
        update.capa = arquivo;
      }
    }
    if (body.nome !== undefined) {
      const nome = body.nome.trim().slice(0, 120);
      if (!nome) return json({ error: "Informe o nome da pasta." }, 400);
      update.titulo = nome;
    }
    if (typeof body.visivel === "boolean") update.visivel = body.visivel;
    if (body.ordemFotos !== undefined) {
      if (!ordemFotosValida(body.ordemFotos)) return json({ error: "Ordenação inválida." }, 400);
      update.ordem_fotos = body.ordemFotos;
    }
    if (!Object.keys(update).length) return json({ error: "Nenhuma alteração informada." }, 400);

    const { data: pasta, error } = await supabase.from("galerias")
      .update(update)
      .eq("id", body.pastaId)
      .eq("projeto_id", body.projetoId)
      .eq("user_id", user.id)
      .select("id,titulo,visivel,capa,ordem_fotos")
      .maybeSingle();
    if (error) return json({ error: "Não foi possível atualizar a pasta." }, 500);
    if (!pasta) return json({ error: "Pasta não encontrada." }, 404);

    await supabase.from("galeria_projetos")
      .update({ atualizado_em: new Date().toISOString() })
      .eq("id", body.projetoId)
      .eq("user_id", user.id);

    return json({ ok: true, pasta });
  }

  if (body.acao === "definir_capa_se_vazia") {
    if (!uuidValido(body.projetoId) || !uuidValido(body.pastaId) || !body.arquivo || body.arquivo.includes("/") || body.arquivo.includes("\\")) {
      return json({ error: "Capa inválida." }, 400);
    }
    const p = await projetoDoUsuario(body.projetoId!, user.id);
    if (!p) return json({ error: "Projeto não encontrado." }, 404);
    if (p.capa_arquivo) return json({ ok: true, alterada: false });
    const { data: pasta } = await supabase.from("galerias").select("id").eq("id", body.pastaId).eq("projeto_id", body.projetoId).eq("user_id", user.id).maybeSingle();
    if (!pasta) return json({ error: "Pasta inválida." }, 400);
    const { data: encontrados } = await supabase.storage.from("fotos").list(`${user.id}/${body.pastaId}`, { limit: 20, search: body.arquivo });
    if (!(encontrados ?? []).some((item) => item.id !== null && item.name === body.arquivo)) return json({ error: "Foto não encontrada." }, 404);
    const { error } = await supabase.from("galeria_projetos").update({
      capa_galeria_id: body.pastaId, capa_arquivo: body.arquivo, atualizado_em: new Date().toISOString(),
    }).eq("id", body.projetoId).eq("user_id", user.id).is("capa_arquivo", null);
    return error ? json({ error: "Não foi possível definir a capa." }, 500) : json({ ok: true, alterada: true });
  }

  if (body.acao === "excluir_projeto") {
    if (!uuidValido(body.projetoId)) return json({ error: "Projeto inválido." }, 400);
    const projeto = await projetoDoUsuario(body.projetoId!, user.id);
    if (!projeto) return json({ error: "Projeto não encontrado." }, 404);

    const confirmacao = body.confirmacao?.trim() ?? "";
    if (!confirmacao || confirmacao !== String(projeto.nome)) {
      return json({ error: "Digite o nome exato do projeto para confirmar a exclusão." }, 400);
    }

    const { data: galeriasRemovidas, error: exclusaoError } = await supabase.rpc("excluir_projeto_backend", {
      p_projeto: body.projetoId,
      p_user_id: user.id,
    });
    if (exclusaoError || galeriasRemovidas === null) {
      registrarErro("project.delete.database", req, exclusaoError ?? new Error("RPC retornou nulo"), { projeto: body.projetoId });
      return json({ error: "Não foi possível excluir o projeto." }, 500);
    }

    const ids = Array.isArray(galeriasRemovidas) ? galeriasRemovidas.map(String) : [];
    // The gallery deletion trigger enqueues cleanup in the same transaction.

    return json({
      ok: true,
      galeriasExcluidas: ids.length,
      limpezaPendente: ids.length > 0,
      aviso: ids.length
        ? "O projeto foi excluído. A remoção dos arquivos está na fila e será verificada automaticamente."
        : undefined,
    });
  }

  return json({ error: "Ação inválida." }, 400);
}
