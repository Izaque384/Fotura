import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { registrarErro } from "../../../../lib/observability";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { uuidValido } from "../../../../lib/validation";
import { publicGalleryRef } from "../../../../lib/gallery-links";
import { htmlLang, normalizeLocale, translate, withLocalePath } from "../../../../lib/i18n";

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
    .select("id,slug,titulo,cliente_id,prova,prazo,link_ate,config_revisada_em,user_id")
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

  const {data:perfil,error:perfilError}=await supabase
    .from("perfis")
    .select("nome_estudio,configs")
    .eq("id",user.id)
    .maybeSingle();
  if(perfilError){
    registrarErro("gallery.send.profile",req,perfilError,{galeria});
    return NextResponse.json({error:"Não foi possível verificar os dados do estúdio."},{status:500});
  }

  const configs=perfil?.configs&&typeof perfil.configs==="object"&&!Array.isArray(perfil.configs)
    ? perfil.configs as Record<string,unknown>
    : {};
  const locale=normalizeLocale(configs.idioma??user.user_metadata?.language??req.headers.get("x-fotura-locale"));
  const origin=(process.env.NEXT_PUBLIC_SITE_URL||"https://foturax.com.br").replace(/\/$/,"");
  const link=`${origin}${withLocalePath(`/g/${publicGalleryRef(String(g.slug||"galeria"),String(g.id))}`,locale)}`;
  const studio=String(perfil?.nome_estudio||"Fotura");
  const titulo=escapeHtml(String(g.titulo||translate(locale,"Sua galeria")));
  const nome=escapeHtml(String(cliente.nome||translate(locale,"cliente")));
  const estudio=escapeHtml(studio);
  const greeting=locale==="en"?"Hello":locale==="es"?"Hola":"Olá";
  const sharedCopy=locale==="en"
    ? `${estudio} shared the gallery <strong style="color:#2A2F46">${titulo}</strong> with you.`
    : locale==="es"
      ? `${estudio} compartió la galería <strong style="color:#2A2F46">${titulo}</strong> contigo.`
      : `${estudio} compartilhou a galeria <strong style="color:#2A2F46">${titulo}</strong> com você.`;
  const prazo=g.prova&&g.prazo?`<p style="margin:0 0 18px;color:#73758D;font-size:14px">${escapeHtml(translate(locale,"Prazo para seleção:"))} <strong style="color:#2A2F46">${escapeHtml(String(g.prazo))}</strong></p>`:"";
  const validade=g.link_ate?`<p style="margin:0 0 18px;color:#73758D;font-size:14px">${escapeHtml(translate(locale,"Link disponível até:"))} <strong style="color:#2A2F46">${escapeHtml(String(g.link_ate))}</strong></p>`:"";
  const fallbackCopy=locale==="en"?"If the button does not open, copy this address:":locale==="es"?"Si el botón no se abre, copia esta dirección:":"Se o botão não abrir, copie este endereço:";
  const logoUrl=`${origin}/icon-192.png`;
  const html=`<!doctype html>
<html lang="${htmlLang(locale)}">
  <body style="margin:0;padding:0;background:#F0EDF7;font-family:Arial,Helvetica,sans-serif;color:#21253A">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#F0EDF7">
      <tr>
        <td align="center" style="padding:36px 16px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px">
            <tr>
              <td style="padding:0 4px 18px">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;padding-right:10px">
                      <img src="${logoUrl}" width="34" height="34" alt="Fotura" style="display:block;width:34px;height:34px;border:0;border-radius:8px">
                    </td>
                    <td style="vertical-align:middle;font-size:18px;font-weight:800;letter-spacing:3px;color:#21253A">FOTURA</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#FAF8FD;border:1px solid #DCD6EE;border-radius:18px;padding:32px 30px;box-shadow:0 10px 30px rgba(65,52,111,.06)">
                <p style="margin:0 0 8px;color:#777D93;font-size:14px;line-height:1.5">${greeting}, ${nome}.</p>
                <h1 style="margin:0 0 12px;color:#21253A;font-size:27px;line-height:1.18;letter-spacing:-.4px">${escapeHtml(translate(locale,"Sua galeria está disponível"))}</h1>
                <p style="margin:0 0 22px;color:#73758D;font-size:15px;line-height:1.65">${sharedCopy}</p>
                ${prazo}
                ${validade}
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px">
                  <tr>
                    <td style="border-radius:10px;background:#5D0DFA;background-image:linear-gradient(90deg,#1196FC,#5D0DFA)">
                      <a href="${link}" style="display:inline-block;padding:13px 20px;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;line-height:1">${escapeHtml(translate(locale,"Ver galeria"))}</a>
                    </td>
                  </tr>
                </table>
                <div style="height:1px;background:#E5E0EC;margin:0 0 18px"></div>
                <p style="margin:0;color:#8A8FA3;font-size:12px;line-height:1.55">${escapeHtml(fallbackCopy)}</p>
                <p style="margin:5px 0 0;font-size:12px;line-height:1.55;word-break:break-all"><a href="${link}" style="color:#5D55A0;text-decoration:underline">${link}</a></p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 20px 0;color:#989AAC;font-size:11px;line-height:1.5">
                ${escapeHtml(translate(locale,"Entrega realizada com Fotura"))}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  let response:Response;
  try{
    response=await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({from,to:[cliente.email],subject:`${g.titulo||translate(locale,"Sua galeria")} — ${studio}`,html}),
      signal:AbortSignal.timeout(8000)
    });
  }catch(error){
    registrarErro("gallery.send.resend_network",req,error,{galeria});
    return NextResponse.json({error:"Não foi possível enviar o e-mail agora."},{status:502});
  }

  if(!response.ok){
    registrarErro("gallery.send.resend",req,new Error(`Resend respondeu ${response.status}`),{galeria,status:response.status});
    return NextResponse.json({error:"Não foi possível enviar o e-mail agora."},{status:502});
  }
  const { error: analyticsError } = await supabase.from("produto_eventos").insert({
    user_id: user.id,
    evento: "gallery_shared",
    rota: "/dashboard/galerias",
    entidade: "galeria",
    entidade_id: galeria,
    detalhes: { canal: "email" },
  });
  if (analyticsError) console.error("[gallery-send] analytics failed", { code: analyticsError.code });
  return NextResponse.json({ok:true,email:cliente.email});
}
