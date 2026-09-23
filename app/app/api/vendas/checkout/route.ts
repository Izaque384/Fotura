import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { stripeConnectedPost, obterContaFotografo, recebimentosAtivos, type StripeSaleCheckout } from "../../../../lib/stripe-connect";
import { temAcessoGaleria } from "../../../../lib/gallery-access";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { uuidValido } from "../../../../lib/validation";

export const dynamic = "force-dynamic";

type Body = { galeria?: string };

export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 400 }); }
  const galeria = body.galeria?.trim();
  if (!uuidValido(galeria)) return NextResponse.json({ error: "Galeria inválida." }, { status: 400 });

  const permitido = await consumirRateLimit(req, "gallery_extra_checkout", galeria, 10 * 60, 20);
  if (!permitido) return NextResponse.json({ error: "Muitas tentativas de pagamento. Aguarde alguns minutos." }, { status: 429 });

  const supabase = createServiceClient();
  const { data: g } = await supabase.from("galerias")
    .select("id,user_id,titulo,prova,limite,prazo,link_ate,tem_senha,cliente_id,venda_extras_ativa,preco_foto_extra_centavos")
    .eq("id", galeria).maybeSingle();
  if (!g) return NextResponse.json({ error: "Galeria não encontrada." }, { status: 404 });
  if (!g.prova) return NextResponse.json({ error: "Esta galeria não está em modo prova." }, { status: 403 });

  const linkAte = g.link_ate as string | null;
  if (linkAte && Date.now() > new Date(`${linkAte}T23:59:59`).getTime()) return NextResponse.json({ error: "Link expirado." }, { status: 403 });
  const prazo = g.prazo as string | null;
  if (prazo && Date.now() > new Date(`${prazo}T23:59:59`).getTime()) return NextResponse.json({ error: "Prazo da seleção encerrado." }, { status: 403 });
  if (g.tem_senha && !temAcessoGaleria(req, galeria)) return NextResponse.json({ error: "Acesso à galeria necessário." }, { status: 401 });

  const limite = Number(g.limite ?? 0);
  const preco = Number(g.preco_foto_extra_centavos ?? 0);
  if (!g.venda_extras_ativa || limite <= 0 || preco < 100) {
    return NextResponse.json({ error: "Venda de fotos extras não está disponível nesta galeria." }, { status: 409 });
  }

  const [{ data: assinatura }, { data: perfil }, { data: selecao }, { data: cliente }] = await Promise.all([
    supabase.from("assinaturas").select("plano_codigo,status").eq("user_id", g.user_id).maybeSingle(),
    supabase.from("perfis").select("stripe_conta_id,stripe_recebimentos_ativo").eq("id", g.user_id).maybeSingle(),
    supabase.from("selecoes").select("fotos,finalizada,comentarios").eq("galeria", galeria).maybeSingle(),
    g.cliente_id ? supabase.from("clientes").select("email").eq("id", g.cliente_id).eq("user_id", g.user_id).maybeSingle() : Promise.resolve({ data:null }),
  ]);

  const planoPago = Boolean(
    assinatura &&
    ["active","trialing","past_due"].includes(String(assinatura.status)) &&
    ["legacy","essencial","profissional","studio"].includes(String(assinatura.plano_codigo))
  );
  if (!planoPago) return NextResponse.json({ error: "O fotógrafo precisa de um plano pago para vender fotos extras." }, { status: 409 });
  if (!selecao || selecao.finalizada) return NextResponse.json({ error: "Esta seleção não está disponível para compra." }, { status: 409 });

  const fotos = Array.from(new Set((selecao.fotos as string[]) ?? []));
  const extras = Math.max(0, fotos.length - limite);
  if (extras <= 0) return NextResponse.json({ error: "Não há fotos extras nesta seleção." }, { status: 409 });

  const accountId = (perfil?.stripe_conta_id as string | null) ?? null;
  if (!accountId) return NextResponse.json({ error: "O fotógrafo ainda não configurou os recebimentos." }, { status: 409 });

  try {
    const account = await obterContaFotografo(accountId);
    const ativo = recebimentosAtivos(account);
    await supabase.from("perfis").update({
      stripe_recebimentos_ativo: ativo,
      stripe_recebimentos_atualizado_em: new Date().toISOString(),
    }).eq("id", g.user_id);
    if (!ativo) return NextResponse.json({ error: "Os recebimentos do fotógrafo ainda não estão ativos." }, { status: 409 });

    const total = extras * preco;
    const { data: pedido, error: pedidoError } = await supabase.from("vendas_fotos").insert({
      galeria,
      fotografo_id: g.user_id,
      fotos,
      qtd_incluidas: limite,
      qtd_extras: extras,
      valor_unitario_centavos: preco,
      valor_total_centavos: total,
      moeda: "brl",
      status: "pendente",
      stripe_conta_id: accountId,
    }).select("id").single();
    if (pedidoError || !pedido) throw pedidoError ?? new Error("Pedido não criado");

    const sucesso = `${req.nextUrl.origin}/g/${galeria}?compra=sucesso&pedido=${pedido.id}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelar = `${req.nextUrl.origin}/g/${galeria}?compra=cancelada`;
    const session = await stripeConnectedPost<StripeSaleCheckout>(accountId, "/checkout/sessions", {
      mode: "payment",
      "automatic_payment_methods[enabled]": "true",
      locale: "pt-BR",
      "line_items[0][price_data][currency]": "brl",
      "line_items[0][price_data][product_data][name]": `Fotos adicionais — ${String(g.titulo || "Galeria")}`,
      "line_items[0][price_data][unit_amount]": preco,
      "line_items[0][quantity]": extras,
      success_url: sucesso,
      cancel_url: cancelar,
      ...(cliente?.email ? { customer_email: String(cliente.email) } : {}),
      "metadata[pedido_id]": pedido.id,
      "metadata[galeria_id]": galeria,
      "payment_intent_data[metadata][pedido_id]": pedido.id,
      "payment_intent_data[metadata][galeria_id]": galeria,
    }, `fotura-extra-${pedido.id}`);

    if (!session.url) throw new Error("Checkout sem URL");
    const { error: updateError } = await supabase.from("vendas_fotos").update({
      stripe_checkout_session_id: session.id,
      atualizado_em: new Date().toISOString(),
    }).eq("id", pedido.id);
    if (updateError) throw updateError;

    return NextResponse.json({ url: session.url, pedido: pedido.id, extras, totalCentavos: total });
  } catch (error) {
    console.error("[sales-checkout] failed", error);
    return NextResponse.json({ error: "Não foi possível iniciar o pagamento agora." }, { status: 502 });
  }
}
