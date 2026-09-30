import { NextRequest, NextResponse } from "next/server";
import { validarAdmin } from "../../../../lib/admin-server";
import { registrarErro } from "../../../../lib/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Check = {
  id: string;
  nome: string;
  status: "ok" | "warn" | "error";
  detalhe: string;
};

async function verificarHttp(url: string, init: RequestInit) {
  const inicio = Date.now();
  try {
    const resposta = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(4500) });
    return { ok: resposta.ok, status: resposta.status, ms: Date.now() - inicio };
  } catch {
    return { ok: false, status: 0, ms: Date.now() - inicio };
  }
}

export async function GET(req: NextRequest) {
  const validacao = await validarAdmin(req, "admin.saude.auth");
  if ("error" in validacao) return validacao.error;
  const { supabase, adminUserId } = validacao;
  const checks: Check[] = [];

  try {
    const inicioDb = Date.now();
    const { error: dbError } = await supabase.from("perfis").select("id", { head: true, count: "exact" });
    checks.push({
      id: "database",
      nome: "Banco de dados",
      status: dbError ? "error" : "ok",
      detalhe: dbError ? "Falha ao consultar o Postgres." : `Resposta em ${Date.now() - inicioDb} ms.`,
    });

    const inicioAuth = Date.now();
    const { error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    checks.push({
      id: "auth",
      nome: "Supabase Auth",
      status: authError ? "error" : "ok",
      detalhe: authError ? "Falha na API administrativa de autenticação." : `Resposta em ${Date.now() - inicioAuth} ms.`,
    });

    const inicioStorage = Date.now();
    const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
    const bucketIds = new Set((buckets ?? []).map(b => b.id));
    const bucketsEsperados = ["fotos", "marca"];
    const faltando = bucketsEsperados.filter(b => !bucketIds.has(b));
    checks.push({
      id: "storage",
      nome: "Supabase Storage",
      status: storageError || faltando.length ? "error" : "ok",
      detalhe: storageError ? "Falha ao consultar buckets." : faltando.length ? `Buckets ausentes: ${faltando.join(", ")}.` : `Buckets fotos e marca disponíveis · ${Date.now() - inicioStorage} ms.`,
    });

    const config = [
      ["NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL],
      ["SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY],
      ["STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY],
      ["STRIPE_WEBHOOK_SECRET", process.env.STRIPE_WEBHOOK_SECRET],
    ];
    const ausentes = config.filter(([, valor]) => !valor).map(([nome]) => nome);
    checks.push({
      id: "config",
      nome: "Configuração crítica",
      status: ausentes.length ? "error" : "ok",
      detalhe: ausentes.length ? `Variáveis ausentes: ${ausentes.join(", ")}.` : "Supabase server-side e Stripe configurados.",
    });

    const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (stripeKey) {
      const stripe = await verificarHttp("https://api.stripe.com/v1/account", {
        headers: { Authorization: `Bearer ${stripeKey}` },
      });
      checks.push({
        id: "stripe_api",
        nome: "Stripe API",
        status: stripe.ok ? "ok" : "error",
        detalhe: stripe.ok ? `Credenciais e conectividade validadas · ${stripe.ms} ms.` : `Falha ao consultar a Stripe (HTTP ${stripe.status || "rede"}).`,
      });
    }

    const resendKey = process.env.RESEND_API_KEY?.trim();
    if (!resendKey) {
      checks.push({
        id: "resend",
        nome: "Resend",
        status: "warn",
        detalhe: "RESEND_API_KEY ausente; compartilhamento por e-mail fica indisponível.",
      });
    } else {
      const resend = await verificarHttp("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${resendKey}` },
      });
      checks.push({
        id: "resend",
        nome: "Resend",
        status: resend.ok ? "ok" : "error",
        detalhe: resend.ok ? `Credenciais e conectividade validadas · ${resend.ms} ms.` : `Falha ao consultar a Resend (HTTP ${resend.status || "rede"}).`,
      });
    }

    const { data: recoverySnapshot, error: recoveryError } = await supabase.rpc("operational_recovery_snapshot_backend");
    const recovery = recoverySnapshot as {
      database?: { galerias?: number; clientes?: number };
      storage?: { fotos_objetos?: number; marca_objetos?: number };
    } | null;
    checks.push({
      id: "recovery_snapshot",
      nome: "Snapshot de recuperação",
      status: recoveryError ? "error" : "ok",
      detalhe: recoveryError
        ? "Não foi possível gerar o snapshot usado para validar restores."
        : `Snapshot disponível: ${recovery?.database?.galerias ?? 0} galerias, ${recovery?.database?.clientes ?? 0} clientes, ${recovery?.storage?.fotos_objetos ?? 0} objetos de fotos e ${recovery?.storage?.marca_objetos ?? 0} objetos de marca.`,
    });

    const { data: isolamentoData, error: isolamentoError } = await supabase.rpc("tenant_isolation_audit_backend");
    const isolamento = isolamentoData as { ok?: boolean; checked?: number; issues?: unknown[] } | null;
    checks.push({
      id: "tenant_isolation",
      nome: "Isolamento entre contas",
      status: isolamentoError || isolamento?.ok !== true ? "error" : "ok",
      detalhe: isolamentoError
        ? "Não foi possível auditar as políticas críticas de RLS."
        : isolamento?.ok
          ? `${isolamento.checked ?? 0} políticas críticas de isolamento conferidas, incluindo barreiras restritivas para contas suspensas.`
          : `A auditoria encontrou ${isolamento?.issues?.length ?? 0} divergência(s) nas políticas críticas de RLS.`,
    });

    const [pastDueRes, purgeRes, encerramentoRes, suspensaoRes] = await Promise.all([
      supabase.from("assinaturas").select("user_id", { count: "exact", head: true }).eq("status", "past_due"),
      supabase.from("admin_purges").select("user_id", { count: "exact", head: true }).in("execucao_etapa", ["falhou", "storage", "banco", "auth"]),
      supabase.from("admin_encerramentos").select("user_id", { count: "exact", head: true }).eq("status", "pendente").lte("elegivel_em", new Date().toISOString()),
      supabase.from("admin_suspensoes").select("user_id", { count: "exact", head: true }).eq("ativa", true),
    ]);

    const consultasErro = [pastDueRes.error, purgeRes.error, encerramentoRes.error, suspensaoRes.error].filter(Boolean);
    if (consultasErro.length) throw consultasErro[0];

    const pastDue = pastDueRes.count ?? 0;
    const purgesProblema = purgeRes.count ?? 0;
    const encerramentosElegiveis = encerramentoRes.count ?? 0;
    const suspensas = suspensaoRes.count ?? 0;

    checks.push({
      id: "billing",
      nome: "Cobranças em recuperação",
      status: pastDue > 0 ? "warn" : "ok",
      detalhe: pastDue > 0 ? `${pastDue} assinatura(s) em past_due.` : "Nenhuma assinatura em past_due.",
    });
    checks.push({
      id: "purges",
      nome: "Execuções de purge",
      status: purgesProblema > 0 ? "error" : "ok",
      detalhe: purgesProblema > 0 ? `${purgesProblema} purge(s) com execução pendente/falha.` : "Nenhum purge em estado intermediário ou falho.",
    });
    checks.push({
      id: "closures",
      nome: "Encerramentos elegíveis",
      status: encerramentosElegiveis > 0 ? "warn" : "ok",
      detalhe: encerramentosElegiveis > 0 ? `${encerramentosElegiveis} encerramento(s) já passaram do período de segurança.` : "Nenhum encerramento aguardando confirmação final.",
    });
    checks.push({
      id: "suspensions",
      nome: "Suspensões administrativas",
      status: "ok",
      detalhe: `${suspensas} conta(s) atualmente suspensa(s).`,
    });

    const erros = checks.filter(c => c.status === "error").length;
    const avisos = checks.filter(c => c.status === "warn").length;
    const geral = erros ? "error" : avisos ? "warn" : "ok";

    return NextResponse.json({
      geral,
      checks,
      resumo: { erros, avisos, saudaveis: checks.length - erros - avisos, total: checks.length },
      verificadoEm: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    registrarErro("admin.saude", req, error, { userId: adminUserId });
    return NextResponse.json({ error: "Não foi possível concluir a verificação de saúde." }, { status: 500 });
  }
}
