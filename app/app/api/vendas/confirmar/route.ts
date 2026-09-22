import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { stripeConnectedGet, type StripeSaleCheckout } from "../../../../lib/stripe-connect";
import { temAcessoGaleria } from "../../../../lib/gallery-access";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { uuidValido } from "../../../../lib/validation";

export const dynamic = "force-dynamic";

function paymentIntentId(valor: StripeSaleCheckout["payment_intent"]) {
  if (typeof valor === "string") return valor;
  return valor?.id ?? null;
}

export async function GET(req: NextRequest) {
  const galeria = req.nextUrl.searchParams.get("galeria")?.trim();
  const pedido = req.nextUrl.searchParams.get("pedido")?.trim();
  const sessionId = req.nextUrl.searchParams.get("session_id")?.trim();
  if (!uuidValido(galeria) || !uuidValido(pedido) || !sessionId?.startsWith("cs_")) {
    return NextResponse.json({ error: "Confirmação inválida." }, { status: 400 });
  }

  const permitido = await consumirRateLimit(req, "gallery_extra_confirm", pedido, 10 * 60, 30);
  if (!permitido) return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });

  const supabase = createServiceClient();
  const [{ data: g }, { data: venda }] = await Promise.all([
    supabase.from("galerias").select("id,user_id,titulo,tem_senha").eq("id", galeria).maybeSingle(),
    supabase.from("vendas_fotos").select("*").eq("id", pedido).eq("galeria", galeria).maybeSingle(),
  ]);
  if (!g || !venda) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  if (g.tem_senha && !temAcessoGaleria(req, galeria)) return NextResponse.json({ error: "Acesso à galeria necessário." }, { status: 401 });
  if (venda.status === "pago") {
    return NextResponse.json({ ok:true, pago:true, fotos:venda.fotos, extras:venda.qtd_extras, totalCentavos:venda.valor_total_centavos });
  }
  if (venda.stripe_checkout_session_id !== sessionId) return NextResponse.json({ error: "Sessão de pagamento inválida." }, { status: 400 });

  try {
    const session = await stripeConnectedGet<StripeSaleCheckout>(String(venda.stripe_conta_id), `/checkout/sessions/${encodeURIComponent(sessionId)}`);
    if (session.metadata?.pedido_id !== pedido || session.metadata?.galeria_id !== galeria) {
      return NextResponse.json({ error: "Pagamento não corresponde a este pedido." }, { status: 400 });
    }
    if (session.payment_status !== "paid") {
      return NextResponse.json({ ok:true, pago:false, status:session.payment_status ?? "unpaid" });
    }

    const fotos = (venda.fotos as string[]) ?? [];
    const { data: atual } = await supabase.from("selecoes").select("comentarios,finalizada").eq("galeria", galeria).maybeSingle();
    const comentarios = (atual?.comentarios as Record<string,string> | null) ?? {};
    const agora = new Date().toISOString();

    const { error: selError } = await supabase.from("selecoes").upsert({
      galeria,
      fotos,
      finalizada:true,
      comentarios,
      atualizado_em:agora,
    });
    if (selError) throw selError;

    await Promise.all([
      supabase.from("vendas_fotos").update({
        status:"pago",
        stripe_payment_intent_id:paymentIntentId(session.payment_intent),
        pago_em:agora,
        atualizado_em:agora,
      }).eq("id", pedido),
      supabase.from("galerias").update({ etapa:"selecao_finalizada" }).eq("id", galeria).eq("user_id", g.user_id),
    ]);

    return NextResponse.json({
      ok:true,
      pago:true,
      fotos,
      extras:venda.qtd_extras,
      totalCentavos:venda.valor_total_centavos,
    });
  } catch (error) {
    console.error("[sales-confirm] failed", error);
    return NextResponse.json({ error: "Não foi possível confirmar o pagamento agora." }, { status: 502 });
  }
}
