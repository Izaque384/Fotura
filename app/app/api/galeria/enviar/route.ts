import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { registrarErro } from "../../../../lib/observability";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { uuidValido } from "../../../../lib/validation";

type Body={galeria?:unknown};

function escapeHtml(value:string){return value.replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]||ch));}

async function authUser(req:NextRequest){
  const h=req.headers.get("authorization")||"";
  const token=h.startsWith("Bearer ")?h.slice(7).trim():"";
  if(!token)return null;
  const supabase=createServiceClient();
  const {data,error}=await supabase.auth.getUser(token);
  return error||!data.user?null:{supabase,user:data.user};
}

export async function POST(req:NextRequest){
  if(!requisicaoMesmoOrigin(req))return NextResponse.json({error:"Origem da requisição não permitida."},{status:403});

  const auth=await authUser(req);
  if(!auth)return NextResponse.json({error:"Não autorizado."},{status:401});

  let body:Body;
  try{body=await req.json()}catch{return NextResponse.json({error:"Requisição inválida."},{status:400})}
  const galeria=typeof body.galeria==="string"?body.galeria.trim():"";
  if(!uuidValido(galeria))return NextResponse.json({error:"Galeria inválida."},{status:400});

  const permitido=await consumirRateLimit(req,"gallery_email_send",`${auth.user.id}:${galeria}`,10*60,10);
  if(!permitido)return NextResponse.json({error:"Muitos envios em pouco tempo. Aguarde alguns minutos."},{status:429,headers:{"Retry-After":"600"}});

  const {supabase,user}=auth;
  const {data:g,error:galleryError}=await supabase.from("galerias")
    .select("id,titulo,cliente_id,prova,prazo,link_ate,config_revisada_em,perfis:user_id(nome_estudio)")
    .eq("id",galeria).eq("user_id",user.id).maybeSingle();
  if(galleryError){
    registrarErro("gallery.send.lookup",req,galleryError,{galeria});
    return NextResponse.json({error:"Não foi possível verificar a galeria."},{status:500});
  }
  if(!g)return NextResponse.json({error:"Galeria não encontrada."},{status:404});
  if(!g.config_revisada_em)return NextResponse.json({error:"Revise e confirme as configurações da galeria antes de enviá-la."},{status:409});
  if(!g.cliente_id)return NextResponse.json({error:"Vincule um cliente à galeria antes de enviar."},{status:400});

  const {data:cliente,error:clienteError}=await supabase.from("clientes").select("nome,email").eq("id",g.cliente_id).eq("user_id",user.id).maybeSingle();
  if(clienteError){
    registrarErro("gallery.send.client",req,clienteError,{galeria});
    return NextResponse.json({error:"Não foi possível verificar os dados do cliente."},{status:500});
  }
  if(!cliente?.email)return NextResponse.json({error:"O cliente não possui e-mail cadastrado."},{status:400});

  const apiKey=process.env.RESEND_API_KEY?.trim();
  const from=process.env.FOTURA_EMAIL_FROM?.trim()||"Fotura <galerias@foturax.com.br>";
  if(!apiKey)return NextResponse.json({error:"O envio de e-mail ainda precisa ser ativado no Fotura."},{status:503});

  const origin=(process.env.NEXT_PUBLIC_SITE_URL||"https://foturax.com.br").replace(/\/$/,"");
  const link=`${origin}/g/${g.id}`;
  const studio=((g as unknown as {perfis?:{nome_estudio?:string}|{nome_estudio?:string}[]}).perfis as {nome_estudio?:string}|undefined)?.nome_estudio||"Fotura";
  const titulo=escapeHtml(g.titulo||"Sua galeria");
  const nome=escapeHtml(cliente.nome||"cliente");
  const estudio=escapeHtml(studio);
  const prazo=g.prova&&g.prazo?`<p style="margin:0 0 18px;color:#70748a;font-size:14px">Prazo para seleção: <strong>${escapeHtml(String(g.prazo))}</strong></p>`:"";
  const validade=g.link_ate?`<p style="margin:0 0 18px;color:#70748a;font-size:14px">Link disponível até: <strong>${escapeHtml(String(g.link_ate))}</strong></p>`:"";
  const html=`<!doctype html><html><body style="margin:0;background:#0b0b1a;font-family:Arial,sans-serif;color:#f0f0f5"><div style="max-width:620px;margin:0 auto;padding:42px 20px"><div style="font-weight:800;letter-spacing:3px;margin-bottom:28px">FOTURA</div><div style="background:#14142b;border:1px solid #23233c;border-radius:18px;padding:30px"><p style="margin:0 0 8px;color:#8c91aa;font-size:14px">Olá, ${nome}.</p><h1 style="font-size:25px;margin:0 0 12px">Sua galeria está disponível</h1><p style="color:#9ba0b8;line-height:1.6;margin:0 0 22px">${estudio} compartilhou a galeria <strong style="color:#fff">${titulo}</strong> com você.</p>${prazo}${validade}<a href="${link}" style="display:inline-block;background:linear-gradient(90deg,#1196fc,#5d0dfa);color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:11px">Ver galeria</a><p style="margin:24px 0 0;color:#666c86;font-size:12px;line-height:1.5">Se o botão não abrir, copie este endereço:<br>${link}</p></div></div></body></html>`;

  let response:Response;
  try{
    response=await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({from,to:[cliente.email],subject:`${g.titulo||"Sua galeria"} — ${studio}`,html})
    });
  }catch(error){
    registrarErro("gallery.send.resend_network",req,error,{galeria});
    return NextResponse.json({error:"Não foi possível enviar o e-mail agora."},{status:502});
  }

  if(!response.ok){
    registrarErro("gallery.send.resend",req,new Error(`Resend respondeu ${response.status}`),{galeria,status:response.status});
    return NextResponse.json({error:"Não foi possível enviar o e-mail agora."},{status:502});
  }
  return NextResponse.json({ok:true,email:cliente.email});
}
