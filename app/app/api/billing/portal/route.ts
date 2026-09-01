import { NextRequest, NextResponse } from "next/server";
import { registrarErro } from "../../../../../lib/observability";
import { requisicaoMesmoOrigin } from "../../../../../lib/request-security";
import { createServiceClient } from "../../../../../lib/supabase-server";
import { stripePost, type StripePortalSession } from "../../../../../lib/stripe-billing";

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

  const { data: assinatura, error } = await supabase
    .from("assinaturas")
    .select("provedor,provedor_cliente_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    registrarErro("billing.portal.subscription_lookup", req, error, { userId: auth.user.id });
    return NextResponse.json({ error: "Não foi possível carregar sua assinatura." }, { status: 500 });
  }
  if (!assinatura?.provedor_cliente_id || assinatura.provedor !== "stripe") {
    return NextResponse.json({ error: "Sua assinatura ainda não é gerenciada pela Stripe." }, { status: 409 });
  }

  try {
    const session = await stripePost<StripePortalSession>("/billing_portal/sessions", {
      customer: assinatura.provedor_cliente_id,
      return_url: `${req.nextUrl.origin}/dashboard/assinatura`,
    });
    return NextResponse.json({ url: session.url }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (portalError) {
    registrarErro("billing.portal.create", req, portalError, { userId: auth.user.id });
    const naoConfigurado = portalError instanceof Error && portalError.message.includes("STRIPE_SECRET_KEY");
    return NextResponse.json({ error: naoConfigurado ? "Portal de cobrança ainda não configurado no ambiente." : "Não foi possível abrir o gerenciamento da assinatura." }, { status: naoConfigurado ? 503 : 502 });
  }
}
