import { NextRequest, NextResponse } from "next/server";
import { planoFotura, type PlanoCodigo } from "../../../../lib/billing-plans";
import { registrarErro } from "../../../../lib/observability";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { createServiceClient } from "../../../../lib/supabase-server";
import { STRIPE_PRICE_POR_PLANO, stripePost, type StripeCheckoutSession } from "../../../../lib/stripe-billing";

export const dynamic = "force-dynamic";

const PLANOS_COMERCIAIS = new Set<PlanoCodigo>(["essencial", "profissional", "studio"]);

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

  let body: { plano?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Payload inválido." }, { status: 400 }); }
  const planoCodigo = body.plano as PlanoCodigo | undefined;
  if (!planoCodigo || !PLANOS_COMERCIAIS.has(planoCodigo)) {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }

  const priceId = STRIPE_PRICE_POR_PLANO[planoCodigo];
  if (!priceId) return NextResponse.json({ error: "Plano ainda não disponível para contratação." }, { status: 503 });

  const { data: assinatura, error: assinaturaError } = await supabase
    .from("assinaturas")
    .select("plano_codigo,status,provedor,provedor_cliente_id,provedor_assinatura_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (assinaturaError) {
    registrarErro("billing.checkout.subscription_lookup", req, assinaturaError, { userId: auth.user.id });
    return NextResponse.json({ error: "Não foi possível preparar a contratação." }, { status: 500 });
  }
  if (!assinatura) return NextResponse.json({ error: "Assinatura não encontrada." }, { status: 404 });

  if (assinatura.plano_codigo === planoCodigo && ["active", "trialing", "past_due"].includes(assinatura.status)) {
    return NextResponse.json({ error: `O plano ${planoFotura(planoCodigo).nome} já é o plano atual.` }, { status: 409 });
  }

  if (assinatura.provedor === "stripe" && assinatura.provedor_assinatura_id && ["active", "trialing", "past_due"].includes(assinatura.status)) {
    return NextResponse.json({ error: "Sua assinatura já é gerenciada pela Stripe. Use a opção de gerenciar assinatura para alterar o plano." }, { status: 409, headers: { "X-Billing-Portal": "required" } });
  }

  try {
    let customerId = assinatura.provedor_cliente_id as string | null;
    if (!customerId) {
      const customer = await stripePost<{ id: string }>("/customers", {
        email: auth.user.email ?? undefined,
        "metadata[fotura_user_id]": auth.user.id,
      }, `fotura-customer-${auth.user.id}`);
      customerId = customer.id;

      const { error: customerSaveError } = await supabase.from("assinaturas").update({
        provedor: "stripe",
        provedor_cliente_id: customerId,
        atualizado_em: new Date().toISOString(),
      }).eq("user_id", auth.user.id);
      if (customerSaveError) throw customerSaveError;
    }

    const origem = req.nextUrl.origin;
    const session = await stripePost<StripeCheckoutSession>("/checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      client_reference_id: auth.user.id,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": 1,
      success_url: `${origem}/dashboard/assinatura?checkout=success`,
      cancel_url: `${origem}/dashboard/assinatura?checkout=cancel`,
      "metadata[fotura_user_id]": auth.user.id,
      "metadata[plan_code]": planoCodigo,
      "subscription_data[metadata][fotura_user_id]": auth.user.id,
      "subscription_data[metadata][plan_code]": planoCodigo,
    });

    if (!session.url) throw new Error("Checkout Session sem URL");
    return NextResponse.json({ url: session.url }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    registrarErro("billing.checkout.create", req, error, { userId: auth.user.id, plano: planoCodigo });
    const naoConfigurado = error instanceof Error && error.message.includes("STRIPE_SECRET_KEY");
    return NextResponse.json({ error: naoConfigurado ? "Checkout ainda não configurado no ambiente." : "Não foi possível iniciar o checkout." }, { status: naoConfigurado ? 503 : 502 });
  }
}
