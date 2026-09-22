import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../../lib/supabase-server";
import { criarContaFotografo, criarLinkOnboardingFotografo } from "../../../../../lib/stripe-connect";
import { requisicaoMesmoOrigin } from "../../../../../lib/request-security";

export const dynamic = "force-dynamic";

function bearer(req: NextRequest) {
  return req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  const token = bearer(req);
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const supabase = createServiceClient();
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const [{ data: assinatura }, { data: perfil }] = await Promise.all([
    supabase.from("assinaturas").select("plano_codigo,status").eq("user_id", auth.user.id).maybeSingle(),
    supabase.from("perfis").select("nome_estudio,stripe_conta_id").eq("id", auth.user.id).maybeSingle(),
  ]);

  const elegivel = Boolean(
    assinatura &&
    ["active","trialing","past_due"].includes(String(assinatura.status)) &&
    ["legacy","essencial","profissional","studio"].includes(String(assinatura.plano_codigo))
  );
  if (!elegivel) {
    return NextResponse.json({ error: "Venda de fotos extras está disponível nos planos pagos." }, { status: 403 });
  }

  try {
    let accountId = (perfil?.stripe_conta_id as string | null) ?? null;
    if (!accountId) {
      const account = await criarContaFotografo(auth.user.email ?? null, (perfil?.nome_estudio as string | null) ?? null);
      accountId = account.id;
      const { error } = await supabase.from("perfis").update({
        stripe_conta_id: accountId,
        stripe_recebimentos_ativo: false,
        stripe_recebimentos_atualizado_em: new Date().toISOString(),
      }).eq("id", auth.user.id);
      if (error) throw error;
    }

    const link = await criarLinkOnboardingFotografo(accountId, req.nextUrl.origin);
    return NextResponse.json({ url: link.url });
  } catch (error) {
    console.error("[sales-connect] onboarding failed", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("signed up for Connect")) {
      return NextResponse.json({
        error: "O Stripe Connect ainda não está ativado na conta do Fotura. Ative o Connect no Dashboard da Stripe e tente novamente.",
        code: "stripe_connect_not_enabled"
      }, { status: 409 });
    }
    return NextResponse.json({ error: "Não foi possível iniciar a configuração de recebimentos." }, { status: 502 });
  }
}
