import { NextRequest, NextResponse } from "next/server";
import { validarAdmin, registrarAdminAuditoria } from "../../../../../../lib/admin-server";
import { registrarErro } from "../../../../../../lib/observability";
import { createServiceClient } from "../../../../../../lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRAZO_PURGE_DIAS = 7;
const STATUS_STRIPE_ATIVOS = new Set(["active", "trialing", "past_due"]);

type Body = {
  acao?: "agendar" | "cancelar";
  motivo?: string;
  confirmacao?: string;
};

async function carregarEstado(supabase: ReturnType<typeof createServiceClient>, userId: string) {
  const [encerramentoRes, purgeRes, previewRes, assinaturaRes] = await Promise.all([
    supabase.from("admin_encerramentos").select("status,motivo,confirmado_em,executado_em").eq("user_id", userId).maybeSingle(),
    supabase.from("admin_purges").select("status,motivo,agendado_por,agendado_em,elegivel_em,cancelado_por,cancelado_em,executado_por,executado_em,atualizado_em").eq("user_id", userId).maybeSingle(),
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
    const { data: alvo, error: alvoError } = await supabase.auth.admin.getUserById(alvoUserId);
    if (alvoError || !alvo.user) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    const estado = await carregarEstado(supabase, alvoUserId);
    return NextResponse.json({
      ...estado,
      papel,
      podeAgendar: papel === "owner" && estado.encerramento?.status === "confirmado" && estado.purge?.status !== "agendado",
      exclusaoFisicaHabilitada: false,
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
  if (alvoUserId === adminUserId) return NextResponse.json({ error: "Você não pode preparar o purge da própria conta administrativa." }, { status: 409 });

  const body = await req.json().catch(() => null) as Body | null;
  const acao = body?.acao;
  const motivo = String(body?.motivo ?? "").trim();
  if (!acao || !["agendar", "cancelar"].includes(acao)) return NextResponse.json({ error: "Ação de purge inválida." }, { status: 400 });
  if (motivo.length < 8) return NextResponse.json({ error: "Informe um motivo com pelo menos 8 caracteres." }, { status: 400 });

  try {
    const { data: alvo, error: alvoError } = await supabase.auth.admin.getUserById(alvoUserId);
    if (alvoError || !alvo.user) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    const estado = await carregarEstado(supabase, alvoUserId);

    if (acao === "agendar") {
      if (estado.encerramento?.status !== "confirmado") {
        return NextResponse.json({ error: "O encerramento precisa estar confirmado antes de preparar o purge definitivo." }, { status: 409 });
      }
      if (estado.purge?.status === "agendado") return NextResponse.json({ error: "O purge desta conta já está agendado." }, { status: 409 });
      if (String(body?.confirmacao ?? "").trim().toUpperCase() !== "PURGAR") {
        return NextResponse.json({ error: "Digite PURGAR para armar a exclusão definitiva." }, { status: 400 });
      }
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

    if (estado.purge?.status !== "agendado") return NextResponse.json({ error: "Não existe purge agendado para cancelar." }, { status: 409 });
    const agora = new Date().toISOString();
    const { error } = await supabase.from("admin_purges").update({
      status: "cancelado",
      cancelado_por: adminUserId,
      cancelado_em: agora,
      atualizado_em: agora,
    }).eq("user_id", alvoUserId);
    if (error) throw error;

    await registrarAdminAuditoria({
      supabase, req, adminUserId, papel,
      acao: "conta.purge_cancelar",
      alvoUserId,
      entidade: "purge",
      entidadeId: alvoUserId,
      detalhes: { motivo, anterior: estado.purge, exclusao_executada: false },
    });
    return NextResponse.json({ ok: true, mensagem: "Purge cancelado. Nenhum dado foi removido." });
  } catch (error) {
    registrarErro("admin.purge.post", req, error, { userId: adminUserId, alvoUserId, acao });
    return NextResponse.json({ error: "Não foi possível concluir a ação de purge." }, { status: 500 });
  }
}
