import { NextRequest, NextResponse } from "next/server";
import { validarAdmin, registrarAdminAuditoria } from "../../../../../../lib/admin-server";
import { registrarErro } from "../../../../../../lib/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRAZO_SEGURANCA_DIAS = 7;
const STATUS_STRIPE_ATIVOS = new Set(["active", "trialing", "past_due"]);

type Body = {
  acao?: "solicitar" | "cancelar" | "confirmar";
  motivo?: string;
  confirmacao?: string;
};

export async function POST(req: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const validacao = await validarAdmin(req, "admin.encerramento.auth");
  if ("error" in validacao) return validacao.error;
  const { supabase, adminUserId, papel } = validacao;
  if (papel !== "owner") return NextResponse.json({ error: "Esta ação exige papel owner." }, { status: 403 });

  const { id: alvoUserId } = await contexto.params;
  if (alvoUserId === adminUserId) {
    return NextResponse.json({ error: "Você não pode iniciar o encerramento da própria conta administrativa." }, { status: 409 });
  }

  const body = await req.json().catch(() => null) as Body | null;
  const acao = body?.acao;
  const motivo = String(body?.motivo ?? "").trim();
  if (!acao || !["solicitar", "cancelar", "confirmar"].includes(acao)) {
    return NextResponse.json({ error: "Ação de encerramento inválida." }, { status: 400 });
  }
  if (motivo.length < 8) return NextResponse.json({ error: "Informe um motivo com pelo menos 8 caracteres." }, { status: 400 });

  try {
    const { data: alvo, error: alvoError } = await supabase.auth.admin.getUserById(alvoUserId);
    if (alvoError || !alvo.user) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });

    const { data: atual, error: atualError } = await supabase
      .from("admin_encerramentos")
      .select("status,motivo,solicitado_por,solicitado_em,elegivel_em,cancelado_por,cancelado_em,confirmado_por,confirmado_em,executado_por,executado_em")
      .eq("user_id", alvoUserId)
      .maybeSingle();
    if (atualError) throw atualError;

    if (acao === "solicitar") {
      if (atual?.status === "pendente") return NextResponse.json({ error: "Já existe um encerramento pendente para esta conta." }, { status: 409 });
      if (atual?.status === "confirmado" || atual?.status === "executado") {
        return NextResponse.json({ error: "Esta conta já possui encerramento confirmado." }, { status: 409 });
      }

      const agora = new Date();
      const elegivel = new Date(agora.getTime() + PRAZO_SEGURANCA_DIAS * 24 * 60 * 60 * 1000);
      const registro = {
        user_id: alvoUserId,
        status: "pendente",
        motivo,
        solicitado_por: adminUserId,
        solicitado_em: agora.toISOString(),
        elegivel_em: elegivel.toISOString(),
        cancelado_por: null,
        cancelado_em: null,
        confirmado_por: null,
        confirmado_em: null,
        executado_por: null,
        executado_em: null,
        atualizado_em: agora.toISOString(),
      };
      const { error } = await supabase.from("admin_encerramentos").upsert(registro, { onConflict: "user_id" });
      if (error) throw error;

      await registrarAdminAuditoria({
        supabase, req, adminUserId, papel,
        acao: "conta.encerramento_solicitar",
        alvoUserId,
        entidade: "encerramento",
        entidadeId: alvoUserId,
        detalhes: { motivo, prazo_dias: PRAZO_SEGURANCA_DIAS, elegivel_em: elegivel.toISOString(), anterior: atual ?? null },
      });

      return NextResponse.json({ ok: true, mensagem: `Encerramento marcado. Confirmação final disponível em ${PRAZO_SEGURANCA_DIAS} dias.`, elegivelEm: elegivel.toISOString() });
    }

    if (acao === "cancelar") {
      if (atual?.status !== "pendente") return NextResponse.json({ error: "Não existe encerramento pendente para cancelar." }, { status: 409 });
      const agora = new Date().toISOString();
      const { error } = await supabase.from("admin_encerramentos").update({
        status: "cancelado",
        cancelado_por: adminUserId,
        cancelado_em: agora,
        atualizado_em: agora,
      }).eq("user_id", alvoUserId);
      if (error) throw error;

      await registrarAdminAuditoria({
        supabase, req, adminUserId, papel,
        acao: "conta.encerramento_cancelar",
        alvoUserId,
        entidade: "encerramento",
        entidadeId: alvoUserId,
        detalhes: { motivo, anterior: atual },
      });
      return NextResponse.json({ ok: true, mensagem: "Encerramento cancelado. Nenhum dado foi removido." });
    }

    if (atual?.status !== "pendente") return NextResponse.json({ error: "Não existe encerramento pendente para confirmar." }, { status: 409 });
    if (!atual.elegivel_em || Date.now() < new Date(atual.elegivel_em).getTime()) {
      return NextResponse.json({ error: "O período de segurança ainda não terminou.", elegivelEm: atual.elegivel_em }, { status: 409 });
    }
    if (String(body?.confirmacao ?? "").trim().toUpperCase() !== "ENCERRAR") {
      return NextResponse.json({ error: "Digite ENCERRAR para confirmar esta etapa." }, { status: 400 });
    }

    const { data: assinatura, error: assinaturaError } = await supabase
      .from("assinaturas")
      .select("provedor,provedor_assinatura_id,status,cancelar_no_fim")
      .eq("user_id", alvoUserId)
      .maybeSingle();
    if (assinaturaError) throw assinaturaError;
    if (assinatura?.provedor === "stripe" && assinatura.provedor_assinatura_id && STATUS_STRIPE_ATIVOS.has(String(assinatura.status))) {
      return NextResponse.json({ error: "A assinatura Stripe ainda está ativa. Cancele/encerre a cobrança antes de confirmar o encerramento da conta." }, { status: 409 });
    }

    const agora = new Date().toISOString();
    const { error: suspensaoError } = await supabase.from("admin_suspensoes").upsert({
      user_id: alvoUserId,
      ativa: true,
      motivo: `Encerramento confirmado: ${motivo}`,
      suspenso_por: adminUserId,
      suspenso_em: agora,
      reativado_por: null,
      reativado_em: null,
      atualizado_em: agora,
    }, { onConflict: "user_id" });
    if (suspensaoError) throw suspensaoError;

    const { data: takedownAnterior, error: takedownLookupError } = await supabase
      .from("admin_takedowns_publicos")
      .select("criado_por,criado_em")
      .eq("user_id", alvoUserId)
      .maybeSingle();
    if (takedownLookupError) throw takedownLookupError;
    const { error: takedownError } = await supabase.from("admin_takedowns_publicos").upsert({
      user_id: alvoUserId,
      ativo: true,
      motivo: `Encerramento confirmado: ${motivo}`,
      criado_por: takedownAnterior?.criado_por ?? adminUserId,
      criado_em: takedownAnterior?.criado_em ?? agora,
      atualizado_por: adminUserId,
      atualizado_em: agora,
      removido_por: null,
      removido_em: null,
    }, { onConflict: "user_id" });
    if (takedownError) throw takedownError;
    const { error: aplicarError } = await supabase.rpc("aplicar_takedown_publico_backend", { p_user_id: alvoUserId });
    if (aplicarError) throw aplicarError;

    const { error: encerramentoError } = await supabase.from("admin_encerramentos").update({
      status: "confirmado",
      confirmado_por: adminUserId,
      confirmado_em: agora,
      atualizado_em: agora,
    }).eq("user_id", alvoUserId);
    if (encerramentoError) throw encerramentoError;

    await registrarAdminAuditoria({
      supabase, req, adminUserId, papel,
      acao: "conta.encerramento_confirmar",
      alvoUserId,
      entidade: "encerramento",
      entidadeId: alvoUserId,
      detalhes: { motivo, anterior: atual, dados_removidos: false, conta_suspensa: true, publico_bloqueado: true },
    });

    return NextResponse.json({ ok: true, mensagem: "Encerramento confirmado. A conta foi suspensa e o conteúdo público bloqueado; nenhum dado foi apagado." });
  } catch (error) {
    registrarErro("admin.encerramento", req, error, { userId: adminUserId, alvoUserId, acao });
    return NextResponse.json({ error: "Não foi possível concluir a ação de encerramento." }, { status: 500 });
  }
}
