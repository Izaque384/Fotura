import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { registrarErro } from "../../../../lib/observability";
import { consumirRateLimit } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function autenticar(req: NextRequest) {
  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

export async function GET(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { supabase, user } = auth;
  const permitido = await consumirRateLimit(req, "account_export", user.id, 10 * 60, 3);
  if (!permitido) return NextResponse.json({ error: "Muitas exportações em pouco tempo. Aguarde alguns minutos." }, { status: 429, headers: { "Retry-After": "600" } });

  try {
    const [
      perfilRes,
      assinaturaRes,
      clientesRes,
      galeriasRes,
      vendasRes,
      atividadeRes,
      eventosRes,
      googleRes,
    ] = await Promise.all([
      supabase.from("perfis")
        .select("id,nome_estudio,logo_url,cor_hero,hero_galeria_ativo,hero_galeria_estilo,hero_foto_capa_ativo,atualizado_em")
        .eq("id", user.id).maybeSingle(),
      supabase.from("assinaturas")
        .select("plano_codigo,status,provedor,periodo_inicio,periodo_fim,cancelar_no_fim,criado_em,atualizado_em")
        .eq("user_id", user.id).maybeSingle(),
      supabase.from("clientes")
        .select("id,nome,email,telefone,criado_em")
        .eq("user_id", user.id).order("criado_em", { ascending: true }),
      supabase.from("galerias")
        .select("id,slug,titulo,capa,prova,limite,prazo,link_ate,tem_senha,criado_em,cliente_id,etapa,venda_extras_ativa,preco_foto_extra_centavos,entrega_publicada_em")
        .eq("user_id", user.id).order("criado_em", { ascending: true }),
      supabase.from("vendas_fotos")
        .select("id,galeria,fotos,qtd_incluidas,qtd_extras,valor_unitario_centavos,valor_total_centavos,moeda,status,criado_em,pago_em,atualizado_em,metodo_pagamento")
        .eq("fotografo_id", user.id).order("criado_em", { ascending: true }),
      supabase.from("atividade_auditoria")
        .select("acao,entidade,entidade_id,ator,detalhes,criado_em")
        .eq("user_id", user.id).order("criado_em", { ascending: true }),
      supabase.from("produto_eventos")
        .select("evento,rota,entidade,entidade_id,detalhes,criado_em")
        .eq("user_id", user.id).order("criado_em", { ascending: true }),
      supabase.from("google_integracoes")
        .select("google_email,scope,criado_em,atualizado_em")
        .eq("user_id", user.id).maybeSingle(),
    ]);

    const erros = [
      perfilRes.error, assinaturaRes.error, clientesRes.error, galeriasRes.error,
      vendasRes.error, atividadeRes.error, eventosRes.error, googleRes.error,
    ].filter(Boolean);
    if (erros.length) throw erros[0];

    const galeriaIds = (galeriasRes.data ?? []).map((g) => String(g.id));
    let selecoes: unknown[] = [];
    if (galeriaIds.length) {
      const { data, error } = await supabase
        .from("selecoes")
        .select("galeria,fotos,finalizada,atualizado_em,comentarios")
        .in("galeria", galeriaIds);
      if (error) throw error;
      selecoes = data ?? [];
    }

    const payload = {
      schemaVersion: 1,
      exportadoEm: new Date().toISOString(),
      observacao: "Este arquivo contém dados da sua conta no Fotura. Arquivos binários de fotos não são duplicados neste JSON.",
      conta: {
        id: user.id,
        email: user.email ?? null,
        criadoEm: user.created_at ?? null,
        ultimoLoginEm: user.last_sign_in_at ?? null,
        metadados: user.user_metadata ?? {},
      },
      perfil: perfilRes.data ?? null,
      assinatura: assinaturaRes.data ?? null,
      integracoes: {
        google: googleRes.data ?? null,
      },
      clientes: clientesRes.data ?? [],
      galerias: galeriasRes.data ?? [],
      selecoes,
      vendas: vendasRes.data ?? [],
      atividade: atividadeRes.data ?? [],
      eventosProduto: eventosRes.data ?? [],
    };

    const data = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="fotura-dados-${data}.json"`,
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    registrarErro("account.export", req, error, { userId: user.id });
    return NextResponse.json({ error: "Não foi possível preparar a exportação dos seus dados." }, { status: 500 });
  }
}
