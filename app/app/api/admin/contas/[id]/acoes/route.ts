import { NextRequest, NextResponse } from "next/server";
import { validarAdmin, registrarAdminAuditoria } from "../../../../../../lib/admin-server";
import { registrarErro } from "../../../../../../lib/observability";
import { periodoAssinatura, planoPorStripePrice, stripeGet, type StripeSubscription } from "../../../../../../lib/stripe-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PLANOS_MANUAIS = new Set(["sem_plano", "legacy", "essencial", "profissional", "studio"]);

function iso(epoch: number | null | undefined) {
  return epoch ? new Date(epoch * 1000).toISOString() : null;
}

export async function POST(req: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const validacao = await validarAdmin(req, "admin.conta.acao.auth");
  if ("error" in validacao) return validacao.error;
  const { supabase, adminUserId, papel } = validacao;
  if (papel !== "owner") return NextResponse.json({ error: "Esta ação exige papel owner." }, { status: 403 });

  const { id: alvoUserId } = await contexto.params;
  const body = await req.json().catch(() => null) as { acao?: string; plano?: string; motivo?: string } | null;
  const acao = String(body?.acao ?? "");
  const motivo = String(body?.motivo ?? "").trim();
  if (motivo.length < 8) return NextResponse.json({ error: "Informe um motivo com pelo menos 8 caracteres." }, { status: 400 });

  try {
    const { data: alvo } = await supabase.auth.admin.getUserById(alvoUserId);
    if (!alvo.user) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });

    const { data: atual, error: assinaturaError } = await supabase
      .from("assinaturas")
      .select("plano_codigo,status,provedor,provedor_cliente_id,provedor_assinatura_id,periodo_inicio,periodo_fim,cancelar_no_fim")
      .eq("user_id", alvoUserId)
      .maybeSingle();
    if (assinaturaError) throw assinaturaError;

    if (acao === "suspender") {
      if (alvoUserId === adminUserId) {
        return NextResponse.json({ error: "Você não pode suspender a própria conta administrativa." }, { status: 409 });
      }
      const agora = new Date().toISOString();
      const { data: anterior, error: suspensaoLookupError } = await supabase
        .from("admin_suspensoes")
        .select("ativa,motivo,suspenso_por,suspenso_em,reativado_por,reativado_em")
        .eq("user_id", alvoUserId)
        .maybeSingle();
      if (suspensaoLookupError) throw suspensaoLookupError;
      if (anterior?.ativa) return NextResponse.json({ error: "Esta conta já está suspensa." }, { status: 409 });

      const { error } = await supabase.from("admin_suspensoes").upsert({
        user_id: alvoUserId,
        ativa: true,
        motivo,
        suspenso_por: adminUserId,
        suspenso_em: agora,
        reativado_por: null,
        reativado_em: null,
        atualizado_em: agora,
      }, { onConflict: "user_id" });
      if (error) throw error;

      await registrarAdminAuditoria({
        supabase, req, adminUserId, papel,
        acao: "conta.suspender",
        alvoUserId,
        entidade: "conta",
        entidadeId: alvoUserId,
        detalhes: { motivo, anterior: anterior ?? null },
      });
      return NextResponse.json({ ok: true, mensagem: "Conta suspensa administrativamente." });
    }

    if (acao === "reativar") {
      const { data: anterior, error: suspensaoLookupError } = await supabase
        .from("admin_suspensoes")
        .select("ativa,motivo,suspenso_por,suspenso_em,reativado_por,reativado_em")
        .eq("user_id", alvoUserId)
        .maybeSingle();
      if (suspensaoLookupError) throw suspensaoLookupError;
      if (!anterior?.ativa) return NextResponse.json({ error: "Esta conta não está suspensa." }, { status: 409 });

      const agora = new Date().toISOString();
      const { error } = await supabase.from("admin_suspensoes").update({
        ativa: false,
        reativado_por: adminUserId,
        reativado_em: agora,
        atualizado_em: agora,
      }).eq("user_id", alvoUserId);
      if (error) throw error;

      await registrarAdminAuditoria({
        supabase, req, adminUserId, papel,
        acao: "conta.reativar",
        alvoUserId,
        entidade: "conta",
        entidadeId: alvoUserId,
        detalhes: { motivo, anterior },
      });
      return NextResponse.json({ ok: true, mensagem: "Conta reativada administrativamente." });
    }

    if (acao === "plano_manual") {
      const plano = String(body?.plano ?? "");
      if (!PLANOS_MANUAIS.has(plano)) return NextResponse.json({ error: "Plano manual inválido." }, { status: 400 });
      if (atual?.provedor === "stripe" && atual?.provedor_assinatura_id) {
        return NextResponse.json({ error: "Esta conta possui assinatura Stripe. Use Sincronizar com Stripe." }, { status: 409 });
      }

      const patch = plano === "sem_plano"
        ? { plano_codigo: plano, status: "active", provedor: null, provedor_cliente_id: null, provedor_assinatura_id: null, periodo_inicio: null, periodo_fim: null, cancelar_no_fim: false, atualizado_em: new Date().toISOString() }
        : { plano_codigo: plano, status: "active", provedor: "manual", provedor_cliente_id: null, provedor_assinatura_id: null, periodo_inicio: null, periodo_fim: null, cancelar_no_fim: false, atualizado_em: new Date().toISOString() };

      const { error } = await supabase.from("assinaturas").update(patch).eq("user_id", alvoUserId);
      if (error) throw error;

      await registrarAdminAuditoria({ supabase, req, adminUserId, papel, acao: "conta.plano_manual", alvoUserId, entidade: "assinatura", entidadeId: alvoUserId, detalhes: { motivo, anterior: atual ?? null, novo_plano: plano } });
      return NextResponse.json({ ok: true, mensagem: `Plano manual alterado para ${plano}.` });
    }

    if (acao === "sincronizar_stripe") {
      const subscriptionId = atual?.provedor_assinatura_id;
      if (!subscriptionId || atual?.provedor !== "stripe") return NextResponse.json({ error: "A conta não possui assinatura Stripe vinculada." }, { status: 409 });

      const subscription = await stripeGet<StripeSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
      const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
      const plano = planoPorStripePrice(priceId) ?? subscription.metadata?.plan_code ?? null;
      const periodo = periodoAssinatura(subscription);
      const patch: Record<string, unknown> = {
        provedor: "stripe",
        provedor_cliente_id: subscription.customer,
        provedor_assinatura_id: subscription.id,
        status: subscription.status,
        periodo_inicio: iso(periodo.inicio),
        periodo_fim: iso(periodo.fim),
        cancelar_no_fim: Boolean(subscription.cancel_at_period_end),
        atualizado_em: new Date().toISOString(),
      };
      if (plano && PLANOS_MANUAIS.has(String(plano))) patch.plano_codigo = plano;

      const { error } = await supabase.from("assinaturas").update(patch).eq("user_id", alvoUserId);
      if (error) throw error;

      await registrarAdminAuditoria({ supabase, req, adminUserId, papel, acao: "conta.sincronizar_stripe", alvoUserId, entidade: "assinatura", entidadeId: subscription.id, detalhes: { motivo, anterior: atual ?? null, sincronizado: patch } });
      return NextResponse.json({ ok: true, mensagem: "Assinatura sincronizada com a Stripe." });
    }

    return NextResponse.json({ error: "Ação administrativa inválida." }, { status: 400 });
  } catch (error) {
    registrarErro("admin.conta.acao", req, error, { userId: adminUserId, alvoUserId, acao });
    return NextResponse.json({ error: "Não foi possível concluir a ação administrativa." }, { status: 500 });
  }
}
