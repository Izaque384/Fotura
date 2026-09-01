import { NextRequest, NextResponse } from "next/server";
import { planoPorStripePrice, periodoAssinatura, stripeWebhookSecret, verificarAssinaturaStripe, type StripeCheckoutSession, type StripeSubscription } from "../../../../lib/stripe-billing";
import { registrarErro } from "../../../../lib/observability";
import { createServiceClient } from "../../../../lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function iso(epoch: number | null | undefined) {
  return epoch ? new Date(epoch * 1000).toISOString() : null;
}

async function atualizarPorSubscription(req: NextRequest, subscription: StripeSubscription) {
  const supabase = createServiceClient();
  const userId = subscription.metadata?.fotura_user_id || null;
  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  const plano = planoPorStripePrice(priceId) ?? (subscription.metadata?.plan_code as "essencial" | "profissional" | "studio" | undefined) ?? null;
  const periodo = periodoAssinatura(subscription);

  let filtro: { coluna: "user_id" | "provedor_assinatura_id"; valor: string } | null = null;
  if (userId) filtro = { coluna: "user_id", valor: userId };
  else if (subscription.id) filtro = { coluna: "provedor_assinatura_id", valor: subscription.id };
  if (!filtro) throw new Error("Subscription Stripe sem vínculo com usuário Fotura");

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
  if (plano) patch.plano_codigo = plano;

  const { data, error } = await supabase.from("assinaturas").update(patch).eq(filtro.coluna, filtro.valor).select("user_id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Assinatura Fotura não encontrada para evento Stripe");
}

async function atualizarCheckout(req: NextRequest, session: StripeCheckoutSession) {
  const userId = session.metadata?.fotura_user_id || session.client_reference_id;
  if (!userId) throw new Error("Checkout Stripe sem usuário Fotura");

  const supabase = createServiceClient();
  const patch: Record<string, unknown> = {
    provedor: "stripe",
    atualizado_em: new Date().toISOString(),
  };
  if (typeof session.customer === "string") patch.provedor_cliente_id = session.customer;
  if (typeof session.subscription === "string") patch.provedor_assinatura_id = session.subscription;

  const { error } = await supabase.from("assinaturas").update(patch).eq("user_id", userId);
  if (error) throw error;
}

export async function POST(req: NextRequest) {
  const assinatura = req.headers.get("stripe-signature");
  if (!assinatura) return NextResponse.json({ error: "Assinatura Stripe ausente." }, { status: 400 });

  const payload = await req.text();
  let secret: string;
  try { secret = stripeWebhookSecret(); }
  catch (error) {
    registrarErro("billing.webhook.config", req, error);
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });
  }

  if (!verificarAssinaturaStripe(payload, assinatura, secret)) {
    return NextResponse.json({ error: "Assinatura Stripe inválida." }, { status: 400 });
  }

  let event: { id?: string; type?: string; data?: { object?: unknown } };
  try { event = JSON.parse(payload) as typeof event; }
  catch { return NextResponse.json({ error: "Evento inválido." }, { status: 400 }); }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await atualizarCheckout(req, event.data?.object as StripeCheckoutSession);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await atualizarPorSubscription(req, event.data?.object as StripeSubscription);
        break;
      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    registrarErro("billing.webhook.process", req, error, { eventType: event.type ?? "unknown", eventId: event.id ?? "unknown" });
    return NextResponse.json({ error: "Falha ao processar evento." }, { status: 500 });
  }
}
