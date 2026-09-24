import { NextRequest, NextResponse } from "next/server";
import { validarAdmin } from "../../../../lib/admin-server";
import { registrarErro } from "../../../../lib/observability";

export const dynamic = "force-dynamic";

type ProdutoEvento = {
  evento: string;
  user_id: string | null;
  sessao_id: string | null;
  detalhes: Record<string, unknown> | null;
  criado_em: string;
};

type Atividade = {
  user_id: string;
  acao: string;
  criado_em: string;
};

function contarUnicos(valores: Array<string | null | undefined>) {
  return new Set(valores.filter((v): v is string => Boolean(v))).size;
}

export async function GET(req: NextRequest) {
  const validacao = await validarAdmin(req, "admin.analytics.auth");
  if ("error" in validacao) return validacao.error;
  const { supabase, adminUserId } = validacao;

  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();

  try {
    const [eventosRes, atividadesRes, assinaturasRes] = await Promise.all([
      supabase
        .from("produto_eventos")
        .select("evento,user_id,sessao_id,detalhes,criado_em")
        .gte("criado_em", desde)
        .order("criado_em", { ascending: false })
        .limit(10_000),
      supabase
        .from("atividade_auditoria")
        .select("user_id,acao,criado_em")
        .gte("criado_em", desde)
        .in("acao", ["galeria_criada", "selecao_finalizada"])
        .limit(10_000),
      supabase
        .from("assinaturas")
        .select("user_id,plano_codigo,status"),
    ]);
    if (eventosRes.error) throw eventosRes.error;
    if (atividadesRes.error) throw atividadesRes.error;
    if (assinaturasRes.error) throw assinaturasRes.error;

    const eventos = (eventosRes.data ?? []) as ProdutoEvento[];
    const atividades = (atividadesRes.data ?? []) as Atividade[];
    const porEvento: Record<string, number> = {};
    for (const item of eventos) porEvento[item.evento] = (porEvento[item.evento] ?? 0) + 1;

    const landing = eventos.filter((e) => e.evento === "landing_view");
    const signup = eventos.filter((e) => e.evento === "landing_signup_clicked");
    const dashboard = eventos.filter((e) => e.evento === "dashboard_view");
    const checkoutPlano = eventos.filter((e) => e.evento === "plan_checkout_started");
    const compartilhamentos = eventos.filter((e) => e.evento === "gallery_shared");
    const galeriasPublicas = eventos.filter((e) => e.evento === "public_gallery_view");

    const sessoesLanding = new Set(landing.map((e) => e.sessao_id).filter(Boolean) as string[]);
    const sessoesDashboard = new Set(dashboard.map((e) => e.sessao_id).filter(Boolean) as string[]);
    let mesmaSessaoPainel = 0;
    for (const sessao of sessoesLanding) if (sessoesDashboard.has(sessao)) mesmaSessaoPainel += 1;

    const fontes: Record<string, number> = {};
    for (const item of landing) {
      const origemRaw = item.detalhes?.utm_source;
      const origem = typeof origemRaw === "string" && origemRaw.trim() ? origemRaw.trim().slice(0, 60) : "Direto / sem UTM";
      fontes[origem] = (fontes[origem] ?? 0) + 1;
    }

    const galeriasCriadas = atividades.filter((a) => a.acao === "galeria_criada");
    const selecoesFinalizadas = atividades.filter((a) => a.acao === "selecao_finalizada");
    const pagos = (assinaturasRes.data ?? []).filter((a) =>
      ["essencial", "profissional", "studio"].includes(String(a.plano_codigo)) &&
      ["active", "trialing", "past_due"].includes(String(a.status))
    );

    const dias: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const data = new Date();
      data.setUTCDate(data.getUTCDate() - i);
      dias[data.toISOString().slice(0, 10)] = 0;
    }
    for (const item of eventos) {
      const chave = item.criado_em.slice(0, 10);
      if (chave in dias) dias[chave] += 1;
    }

    return NextResponse.json({
      janelaDias: 30,
      atualizadoEm: new Date().toISOString(),
      volumes: {
        landingViews: landing.length,
        signupClicks: signup.length,
        usuariosNoPainel: contarUnicos(dashboard.map((e) => e.user_id)),
        criadoresDeGaleria: contarUnicos(galeriasCriadas.map((a) => a.user_id)),
        contasComSelecaoFinalizada: contarUnicos(selecoesFinalizadas.map((a) => a.user_id)),
        contasPagasAtivas: contarUnicos(pagos.map((a) => String(a.user_id))),
        checkoutsDePlano: checkoutPlano.length,
        compartilhamentos: compartilhamentos.length,
        visualizacoesGaleriaPublica: galeriasPublicas.length,
        sessoesLanding: sessoesLanding.size,
        sessoesLandingQueChegaramAoPainel: mesmaSessaoPainel,
      },
      porEvento,
      fontes: Object.entries(fontes)
        .map(([fonte, total]) => ({ fonte, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 12),
      ultimos14Dias: Object.entries(dias).map(([data, total]) => ({ data, total })),
    }, {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (error) {
    registrarErro("admin.analytics", req, error, { userId: adminUserId });
    return NextResponse.json({ error: "Não foi possível carregar as métricas de produto." }, { status: 500 });
  }
}
