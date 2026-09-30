import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { registrarErro } from "../../../../lib/observability";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { consumirRateLimit } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRAZO_SEGURANCA_DIAS = 7;
const STATUS_STRIPE_ATIVOS = new Set(["active", "trialing", "past_due"]);

type Acao = "solicitar" | "cancelar" | "confirmar";
type Body = { acao?: Acao; motivo?: string; confirmacao?: string; emailConfirmacao?: string };

async function autenticar(req: NextRequest) {
  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

async function estado(supabase: ReturnType<typeof createServiceClient>, userId: string) {
  const [encerramentoRes, assinaturaRes, adminRes] = await Promise.all([
    supabase.from("admin_encerramentos")
      .select("status,motivo,solicitado_em,elegivel_em,cancelado_em,confirmado_em,executado_em")
      .eq("user_id", userId).maybeSingle(),
    supabase.from("assinaturas")
      .select("provedor,provedor_assinatura_id,status,cancelar_no_fim")
      .eq("user_id", userId).maybeSingle(),
    supabase.from("admin_usuarios").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (encerramentoRes.error) throw encerramentoRes.error;
  if (assinaturaRes.error) throw assinaturaRes.error;
  if (adminRes.error) throw adminRes.error;
  const assinaturaAtiva = Boolean(
    assinaturaRes.data?.provedor === "stripe" &&
    assinaturaRes.data?.provedor_assinatura_id &&
    STATUS_STRIPE_ATIVOS.has(String(assinaturaRes.data?.status))
  );
  return {
    encerramento: encerramentoRes.data ?? null,
    assinaturaAtiva,
    cancelarNoFim: Boolean(assinaturaRes.data?.cancelar_no_fim),
    contaAdministrativa: Boolean(adminRes.data),
  };
}

export async function GET(req: NextRequest) {
  const auth = await autenticar(req);
  if (!auth) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const atual = await estado(auth.supabase, auth.user.id);
    return NextResponse.json({
      ...atual,
      prazoDias: PRAZO_SEGURANCA_DIAS,
      email: auth.user.email ?? null,
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    registrarErro("account.closure.get", req, error, { userId: auth.user.id });
    return NextResponse.json({ error: "Não foi possível carregar o estado do encerramento." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  const auth = await autenticar(req);
  if (!auth) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { supabase, user } = auth;
  const permitido = await consumirRateLimit(req, "account_closure", user.id, 10 * 60, 10);
  if (!permitido) return NextResponse.json({ error: "Muitas tentativas em pouco tempo. Aguarde alguns minutos." }, { status: 429, headers: { "Retry-After": "600" } });
  const body = await req.json().catch(() => null) as Body | null;
  const acao = body?.acao;
  if (!acao || !["solicitar", "cancelar", "confirmar"].includes(acao)) {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  }

  try {
    const atual = await estado(supabase, user.id);
    if (atual.contaAdministrativa) {
      return NextResponse.json({ error: "Contas administrativas precisam ser encerradas pelo fluxo administrativo." }, { status: 409 });
    }

    const registro = atual.encerramento;

    if (acao === "solicitar") {
      const motivo = String(body?.motivo ?? "").trim();
      if (motivo.length < 8) return NextResponse.json({ error: "Informe um motivo com pelo menos 8 caracteres." }, { status: 400 });
      if (registro?.status === "pendente") return NextResponse.json({ error: "Já existe uma solicitação de encerramento pendente." }, { status: 409 });
      if (registro?.status === "confirmado" || registro?.status === "executado") {
        return NextResponse.json({ error: "O encerramento desta conta já foi confirmado." }, { status: 409 });
      }
      const agora = new Date();
      const elegivel = new Date(agora.getTime() + PRAZO_SEGURANCA_DIAS * 86400000);
      const { error } = await supabase.from("admin_encerramentos").upsert({
        user_id: user.id,
        status: "pendente",
        motivo,
        solicitado_por: user.id,
        solicitado_em: agora.toISOString(),
        elegivel_em: elegivel.toISOString(),
        cancelado_por: null,
        cancelado_em: null,
        confirmado_por: null,
        confirmado_em: null,
        executado_por: null,
        executado_em: null,
        atualizado_em: agora.toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
      return NextResponse.json({
        ok: true,
        mensagem: `Solicitação registrada. Você pode cancelar a qualquer momento nos próximos ${PRAZO_SEGURANCA_DIAS} dias.`,
        elegivelEm: elegivel.toISOString(),
      });
    }

    if (acao === "cancelar") {
      if (registro?.status !== "pendente") return NextResponse.json({ error: "Não existe solicitação pendente para cancelar." }, { status: 409 });
      const agora = new Date().toISOString();
      const { error } = await supabase.from("admin_encerramentos").update({
        status: "cancelado",
        cancelado_por: user.id,
        cancelado_em: agora,
        atualizado_em: agora,
      }).eq("user_id", user.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, mensagem: "Solicitação de encerramento cancelada. Nenhum dado foi removido." });
    }

    if (registro?.status !== "pendente") return NextResponse.json({ error: "Não existe solicitação pendente para confirmar." }, { status: 409 });
    if (!registro.elegivel_em || Date.now() < new Date(registro.elegivel_em).getTime()) {
      return NextResponse.json({ error: "O período de segurança ainda não terminou.", elegivelEm: registro.elegivel_em }, { status: 409 });
    }
    if (String(body?.confirmacao ?? "").trim().toUpperCase() !== "ENCERRAR") {
      return NextResponse.json({ error: "Digite ENCERRAR para confirmar." }, { status: 400 });
    }
    const emailEsperado = String(user.email ?? "").trim().toLowerCase();
    if (!emailEsperado || String(body?.emailConfirmacao ?? "").trim().toLowerCase() !== emailEsperado) {
      return NextResponse.json({ error: "Digite exatamente o e-mail da conta para confirmar." }, { status: 400 });
    }
    if (atual.assinaturaAtiva) {
      return NextResponse.json({
        error: atual.cancelarNoFim
          ? "Sua assinatura paga ainda está vigente. Aguarde o fim do período contratado antes de confirmar o encerramento."
          : "Cancele sua assinatura paga em Planos antes de confirmar o encerramento.",
      }, { status: 409 });
    }

    const agora = new Date().toISOString();
    const motivo = String(registro.motivo || "Encerramento solicitado pelo titular");

    const { error: suspensaoError } = await supabase.from("admin_suspensoes").upsert({
      user_id: user.id,
      ativa: true,
      motivo: `Encerramento confirmado pelo titular: ${motivo}`,
      suspenso_por: user.id,
      suspenso_em: agora,
      reativado_por: null,
      reativado_em: null,
      atualizado_em: agora,
    }, { onConflict: "user_id" });
    if (suspensaoError) throw suspensaoError;

    const { data: takedownAnterior, error: takedownLookupError } = await supabase
      .from("admin_takedowns_publicos")
      .select("criado_por,criado_em")
      .eq("user_id", user.id).maybeSingle();
    if (takedownLookupError) throw takedownLookupError;

    const { error: takedownError } = await supabase.from("admin_takedowns_publicos").upsert({
      user_id: user.id,
      ativo: true,
      motivo: `Encerramento confirmado pelo titular: ${motivo}`,
      criado_por: takedownAnterior?.criado_por ?? user.id,
      criado_em: takedownAnterior?.criado_em ?? agora,
      atualizado_por: user.id,
      atualizado_em: agora,
      removido_por: null,
      removido_em: null,
    }, { onConflict: "user_id" });
    if (takedownError) throw takedownError;

    const { error: aplicarError } = await supabase.rpc("aplicar_takedown_publico_backend", { p_user_id: user.id });
    if (aplicarError) throw aplicarError;

    const { error: encerramentoError } = await supabase.from("admin_encerramentos").update({
      status: "confirmado",
      confirmado_por: user.id,
      confirmado_em: agora,
      atualizado_em: agora,
    }).eq("user_id", user.id);
    if (encerramentoError) throw encerramentoError;

    return NextResponse.json({
      ok: true,
      mensagem: "Encerramento confirmado. O acesso e o conteúdo público foram bloqueados. A exclusão definitiva seguirá o período de segurança administrativo.",
    });
  } catch (error) {
    registrarErro("account.closure.post", req, error, { userId: user.id, acao });
    return NextResponse.json({ error: "Não foi possível concluir a ação de encerramento." }, { status: 500 });
  }
}
