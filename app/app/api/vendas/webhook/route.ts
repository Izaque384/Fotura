import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { verificarAssinaturaStripe } from "../../../../lib/stripe-billing";
import { registrarErro } from "../../../../lib/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckoutSession = {
  id?: string;
  payment_status?: string | null;
  payment_intent?: string | { id?: string } | null;
  metadata?: Record<string,string>;
};

type StripeEvent = {
  id?: string;
  type?: string;
  account?: string;
  data?: { object?: CheckoutSession };
};

function paymentIntentId(valor:CheckoutSession["payment_intent"]){
  if(typeof valor==="string")return valor;
  return valor?.id??null;
}

async function segredoWebhook(){
  const supabase=createServiceClient();
  const {data,error}=await supabase.rpc("server_secret",{p_name:"fotura_stripe_connect_webhook_secret"});
  if(error)throw error;
  const secret=typeof data==="string"?data.trim():"";
  if(!secret)throw new Error("Segredo do webhook Connect não configurado");
  return secret;
}

async function localizarVenda(session:CheckoutSession,accountId:string|null){
  const pedido=session.metadata?.pedido_id?.trim();
  const galeria=session.metadata?.galeria_id?.trim();
  if(!pedido||!galeria||!session.id)return null;
  const supabase=createServiceClient();

  let query=supabase.from("vendas_fotos")
    .select("id,galeria,fotografo_id,qtd_extras,valor_total_centavos,stripe_conta_id,stripe_checkout_session_id,status")
    .eq("id",pedido)
    .eq("galeria",galeria);
  if(accountId)query=query.eq("stripe_conta_id",accountId);

  const {data,error}=await query.maybeSingle();
  if(error)throw error;
  if(!data)return null;

  const sessaoGravada=typeof data.stripe_checkout_session_id==="string"?data.stripe_checkout_session_id:null;
  if(sessaoGravada&&sessaoGravada!==session.id)return null;

  // O webhook pode chegar nos poucos milissegundos entre a criação do Checkout
  // e a gravação do session_id no pedido. A metadata assinada pelo Stripe contém
  // pedido + galeria; nesse caso vinculamos a sessão de forma condicional.
  if(!sessaoGravada){
    let update=supabase.from("vendas_fotos")
      .update({stripe_checkout_session_id:session.id,atualizado_em:new Date().toISOString()})
      .eq("id",pedido)
      .eq("galeria",galeria)
      .is("stripe_checkout_session_id",null);
    if(accountId)update=update.eq("stripe_conta_id",accountId);
    const {error:updateError}=await update;
    if(updateError)throw updateError;

    let confirmar=supabase.from("vendas_fotos")
      .select("stripe_checkout_session_id")
      .eq("id",pedido)
      .eq("galeria",galeria);
    if(accountId)confirmar=confirmar.eq("stripe_conta_id",accountId);
    const {data:confirmado,error:confirmError}=await confirmar.maybeSingle();
    if(confirmError)throw confirmError;
    if(confirmado?.stripe_checkout_session_id!==session.id)return null;
    data.stripe_checkout_session_id=session.id;
  }

  return {pedido,galeria,venda:data};
}

async function confirmarPagamento(event:StripeEvent,session:CheckoutSession){
  const vinculo=await localizarVenda(session,event.account??null);
  if(!vinculo)return;
  const supabase=createServiceClient();
  const {error}=await supabase.rpc("finalizar_venda_fotos_server",{
    p_venda:vinculo.pedido,
    p_session_id:session.id!,
    p_payment_intent_id:paymentIntentId(session.payment_intent),
    p_event_id:event.id??null,
    p_metodo_pagamento:null,
  });
  if(error)throw error;

  const {error:analyticsError}=await supabase.from("produto_eventos").insert({
    user_id:vinculo.venda.fotografo_id,
    evento:"extra_sale_payment_confirmed",
    rota:`/g/${vinculo.galeria}`,
    entidade:"venda",
    entidade_id:vinculo.pedido,
    detalhes:{
      extras:Number(vinculo.venda.qtd_extras??0),
      total_centavos:Number(vinculo.venda.valor_total_centavos??0),
    },
  });
  if(analyticsError&&analyticsError.code!=="23505"){
    console.error("[sales-webhook] analytics failed",{code:analyticsError.code,pedido:vinculo.pedido});
  }
}

async function marcarStatus(event:StripeEvent,session:CheckoutSession,status:"cancelado"|"falhou"){
  const vinculo=await localizarVenda(session,event.account??null);
  if(!vinculo||vinculo.venda.status==="pago")return;
  const supabase=createServiceClient();
  const {error}=await supabase.from("vendas_fotos").update({
    status,
    ultimo_evento_stripe_id:event.id??null,
    atualizado_em:new Date().toISOString(),
  }).eq("id",vinculo.pedido).neq("status","pago");
  if(error)throw error;
}

export async function POST(req:NextRequest){
  const assinatura=req.headers.get("stripe-signature");
  if(!assinatura)return NextResponse.json({error:"Assinatura Stripe ausente."},{status:400});
  const payload=await req.text();

  let secret:string;
  try{secret=await segredoWebhook()}
  catch(error){registrarErro("sales.webhook.config",req,error);return NextResponse.json({error:"Webhook não configurado."},{status:503})}

  if(!verificarAssinaturaStripe(payload,assinatura,secret)){
    return NextResponse.json({error:"Assinatura Stripe inválida."},{status:400});
  }

  let event:StripeEvent;
  try{event=JSON.parse(payload) as StripeEvent}
  catch{return NextResponse.json({error:"Evento inválido."},{status:400})}

  try{
    const session=event.data?.object;
    if(!session)return NextResponse.json({received:true});
    if(event.type==="checkout.session.async_payment_succeeded"){
      await confirmarPagamento(event,session);
    }else if(event.type==="checkout.session.completed"&&session.payment_status==="paid"){
      await confirmarPagamento(event,session);
    }else if(event.type==="checkout.session.async_payment_failed"){
      await marcarStatus(event,session,"falhou");
    }else if(event.type==="checkout.session.expired"){
      await marcarStatus(event,session,"cancelado");
    }
    return NextResponse.json({received:true});
  }catch(error){
    registrarErro("sales.webhook.process",req,error,{eventType:event.type??"unknown",eventId:event.id??"unknown"});
    return NextResponse.json({error:"Falha ao processar evento."},{status:500});
  }
}
