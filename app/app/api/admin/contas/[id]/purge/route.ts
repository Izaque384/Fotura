import { NextRequest, NextResponse } from "next/server";
import { executarPurgeDefinitivo } from "../../../../../../lib/admin-purge-executor";
import { validarAdmin, registrarAdminAuditoria } from "../../../../../../lib/admin-server";
import { registrarErro } from "../../../../../../lib/observability";
import { createServiceClient } from "../../../../../../lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRAZO_PURGE_DIAS = 7;
const STATUS_STRIPE_ATIVOS = new Set(["active", "trialing", "past_due"]);

type Body = {
  acao?: "agendar" | "cancelar" | "executar";
  motivo?: string;
  confirmacao?: string;
  emailConfirmacao?: string;
};

async function carregarEstado(supabase: ReturnType<typeof createServiceClient>, userId: string) {
  const [encerramentoRes, purgeRes, previewRes, assinaturaRes] = await Promise.all([
    supabase.from("admin_encerramentos").select("status,motivo,confirmado_em,executado_em").eq("user_id", userId).maybeSingle(),
    supabase.from("admin_purges").select("status,motivo,agendado_por,agendado_em,elegivel_em,cancelado_por,cancelado_em,executado_por,executado_em,atualizado_em,execucao_etapa,execucao_iniciada_em,execucao_atualizada_em,execucao_erro,preview_snapshot,alvo_email_snapshot").eq("user_id", userId).maybeSingle(),
    supabase.rpc("admin_purge_preview_backend", { p_user_id: userId }),
    supabase.from("assinaturas").select("provedor,provedor_assinatura_id,status,cancelar_no_fim").eq("user_id", userId).maybeSingle(),
  ]);
  if (encerramentoRes.error) throw encerramentoRes.error;
  if (purgeRes.error) throw purgeRes.error;
  if (previewRes.error) throw previewRes.error;
  if (assinaturaRes.error) throw assinaturaRes.error;
  return {
    encerramento: encerramentoRes.data ?? null,
    purge: purgeRes.data ?? null,
    preview: previewRes.data ?? null,
    assinatura: assinaturaRes.data ?? null,
  };
}

export async function GET(req: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const validacao = await validarAdmin(req, "admin.purge.auth");
  if ("error" in validacao) return validacao.error;
  const { supabase, adminUserId, papel } = validacao;
  const { id: alvoUserId } = await contexto.params;

  try {
    const estado = await carregarEstado(supabase, alvoUserId);
    const { data: alvo } = await supabase.auth.admin.getUserById(alvoUserId);
    const purge = estado.purge;
    const execucaoIniciada = Boolean(purge && purge.execucao_etapa && purge.execucao_etapa !== "nao_iniciada");
    const elegivelExecutar = Boolean(
      papel === "owner" &&
      purge?.status === "agendado" &&
      purge.elegivel_em &&
      Date.now() >= new Date(purge.elegivel_em).getTime()
    );

    return NextResponse.json({
      ...estado,
      papel,
      alvoEmail: purge?.alvo_email_snapshot ?? alvo.user?.email ?? null,
      podeAgendar: papel === "owner" && Boolean(alvo.user) && estado.encerramento?.status === "confirmado" && purge?.status !== "agendado",
      podeCancelar: papel === "owner" && purge?.status === "agendado" && !execucaoIniciada,
      podeExecutar: elegivelExecutar,
      exclusaoFisicaHabilitada: true,
      prazoDias: PRAZO_PURGE_DIAS,
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    registrarErro("admin.purge.get", req, error, { userId: adminUserId, alvoUserId });
    return NextResponse.json({ error: "Não foi possível carregar a prévia do purge." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const validacao = await validarAdmin(req, "admin.purge.auth");
  if ("error" in validacao) return validacao.error;
  const { supabase, adminUserId, papel } = validacao;
  if (papel !== "owner") return NextResponse.json({ error: "Esta ação exige papel owner." }, { status: 403 });

  const { id: alvoUserId } = await contexto.params;
  if (alvoUserId === adminUserId) return NextResponse.json({ error: "Você não pode executar purge da própria conta administrativa." }, { status: 409 });

  const body = await req.json().catch(() => null) as Body | null;
  const acao = body?.acao;
  const motivo = String(body?.motivo ?? "").trim();
  if (!acao || !["agendar", "cancelar", "executar"].includes(acao)) return NextResponse.json({ error: "Ação de purge inválida." }, { status: 400 });
  if (motivo.length < 8) return NextResponse.json({ error: "Informe um motivo com pelo menos 8 caracteres." }, { status: 400 });

  try {
    const estado = await carregarEstado(supabase, alvoUserId);
    const { data: adminAlvo, error: adminAlvoError } = await supabase.from("admin_usuarios").select("user_id").eq("user_id", alvoUserId).maybeSingle();
    if (adminAlvoError) throw adminAlvoError;
    if (adminAlvo) return NextResponse.json({ error: "Contas administrativas não podem ser purgadas." }, { status: 409 });

    if (acao === "agendar") {
      const { data: alvo, error: alvoError } = await supabase.auth.admin.getUserById(alvoUserId);
      if (alvoError || !alvo.user) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
      if (estado.encerramento?.status !== "confirmado") return NextResponse.json({ error: "O encerramento precisa estar confirmado antes de preparar o purge definitivo." }, { status: 409 });
      if (estado.purge?.status === "agendado") return NextResponse.json({ error: "O purge desta conta já está agendado." }, { status: 409 });
      if (String(body?.confirmacao ?? "").trim().toUpperCase() !== "PURGAR") return NextResponse.json({ error: "Digite PURGAR para armar a exclusão definitiva." }, { status: 400 });
      const assinatura = estado.assinatura;
      if (assinatura?.provedor === "stripe" && assinatura.provedor_assinatura_id && STATUS_STRIPE_ATIVOS.has(String(assinatura.status))) {
        return NextResponse.json({ error: "A assinatura Stripe ainda está ativa. O purge não pode ser preparado enquanto houver cobrança ativa." }, { status: 409 });
      }

      const agora = new Date();
      const elegivel = new Date(agora.getTime() + PRAZO_PURGE_DIAS * 24 * 60 * 60 * 1000);
      const { error } = await supabase.from("admin_purges").upsert({
        user_id: alvoUserId,
        status: "agendado",
        motivo,
        agendado_por: adminUserId,
        agendado_em: agora.toISOString(),
        elegivel_em: elegivel.toISOString(),
        cancelado_por: null,
        cancelado_em: null,
        executado_por: null,
        executado_em: null,
        atualizado_em: agora.toISOString(),
        execucao_etapa: "nao_iniciada",
        execucao_iniciada_em: null,
        execucao_atualizada_em: null,
        execucao_erro: null,
        preview_snapshot: estado.preview,
        alvo_email_snapshot: alvo.user.email ?? "",
      }, { onConflict: "user_id" });
      if (error) throw error;

      await registrarAdminAuditoria({
        supabase, req, adminUserId, papel,
        acao: "conta.purge_agendar",
        alvoUserId,
        entidade: "purge",
        entidadeId: alvoUserId,
        detalhes: { motivo, prazo_dias: PRAZO_PURGE_DIAS, elegivel_em: elegivel.toISOString(), preview: estado.preview, exclusao_executada: false },
      });
      return NextResponse.json({ ok: true, mensagem: `Purge armado com período adicional de ${PRAZO_PURGE_DIAS} dias. Nenhum dado foi apagado.`, elegivelEm: elegivel.toISOString() });
    }

    if (acao === "cancelar") {
      if (estado.purge?.status !== "agendado") return NextResponse.json({ error: "Não existe purge agendado para cancelar." }, { status: 409 });
      if (estado.purge.execucao_etapa && estado.purge.execucao_etapa !== "nao_iniciada") {
        return NextResponse.json({ error: "A execução física já foi iniciada e não pode mais ser cancelada. Corrija a falha e retome a execução." }, { status: 409 });
      }
      const agora = new Date().toISOString();
      const { error } = await supabase.from("admin_purges").update({ status: "cancelado", cancelado_por: adminUserId, cancelado_em: agora, atualizado_em: agora }).eq("user_id", alvoUserId);
      if (error) throw error;
      await registrarAdminAuditoria({ supabase, req, adminUserId, papel, acao: "conta.purge_cancelar", alvoUserId, entidade: "purge", entidadeId: alvoUserId, detalhes: { motivo, anterior: estado.purge, exclusao_executada: false } });
      return NextResponse.json({ ok: true, mensagem: "Purge cancelado. Nenhum dado foi removido." });
    }

    const purge = estado.purge;
    if (!purge || purge.status !== "agendado") return NextResponse.json({ error: "Não existe purge agendado para executar." }, { status: 409 });
    if (!purge.elegivel_em || Date.now() < new Date(purge.elegivel_em).getTime()) return NextResponse.json({ error: "O período adicional de segurança ainda não terminou.", elegivelEm: purge.elegivel_em }, { status: 409 });
    if (String(body?.confirmacao ?? "").trim().toUpperCase() !== "PURGAR DEFINITIVO") return NextResponse.json({ error: "Digite PURGAR DEFINITIVO para executar a exclusão física." }, { status: 400 });
    const emailEsperado = String(purge.alvo_email_snapshot ?? "").trim().toLowerCase();
    if (!emailEsperado || String(body?.emailConfirmacao ?? "").trim().toLowerCase() !== emailEsperado) return NextResponse.json({ error: "Digite exatamente o e-mail da conta para confirmar o purge." }, { status: 400 });
    if (estado.encerramento?.status !== "confirmado") return NextResponse.json({ error: "O encerramento administrativo precisa continuar confirmado." }, { status: 409 });
    const assinatura = estado.assinatura;
    if (assinatura?.provedor === "stripe" && assinatura.provedor_assinatura_id && STATUS_STRIPE_ATIVOS.has(String(assinatura.status))) return NextResponse.json({ error: "A assinatura Stripe voltou a ficar ativa. O purge foi bloqueado." }, { status: 409 });

    await registrarAdminAuditoria({ supabase, req, adminUserId, papel, acao: "conta.purge_execucao_iniciar", alvoUserId, entidade: "purge", entidadeId: alvoUserId, detalhes: { motivo, preview_snapshot: purge.preview_snapshot ?? estado.preview, etapa_anterior: purge.execucao_etapa ?? "nao_iniciada" } });

    try {
      const resultado = await executarPurgeDefinitivo({ supabase, userId: alvoUserId, adminUserId });
      await registrarAdminAuditoria({ supabase, req, adminUserId, papel, acao: "conta.purge_executado", alvoUserId, entidade: "purge", entidadeId: alvoUserId, detalhes: { motivo, resultado, irreversivel: true } });
      return NextResponse.json({ ok: true, mensagem: "Purge definitivo concluído. Storage, dados operacionais e usuário Auth foram removidos; a auditoria administrativa foi preservada." });
    } catch (error) {
      await registrarAdminAuditoria({ supabase, req, adminUserId, papel, acao: "conta.purge_execucao_falhou", alvoUserId, entidade: "purge", entidadeId: alvoUserId, detalhes: { motivo, erro: error instanceof Error ? error.message : "erro desconhecido" } });
      throw error;
    }
  } catch (error) {
    registrarErro("admin.purge.post", req, error, { userId: adminUserId, alvoUserId, acao });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível concluir a ação de purge." }, { status: 500 });
  }
}
