import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { uuidValido } from "../../../../lib/validation";

export const dynamic="force-dynamic";
export const runtime="nodejs";

type Entrada={
  nome?:unknown;largura?:unknown;altura?:unknown;bytes?:unknown;mimeType?:unknown;thumbBytes?:unknown;
};

async function usuario(req:NextRequest){
  const token=req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token)return null;
  const supabase=createServiceClient();
  const{data,error}=await supabase.auth.getUser(token);
  return error?null:data.user??null;
}

const numero=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)?v:null;

export async function POST(req:NextRequest){
  if(!requisicaoMesmoOrigin(req))return NextResponse.json({error:"Origem inválida."},{status:403});
  const user=await usuario(req);
  if(!user)return NextResponse.json({error:"Não autorizado."},{status:401});
  const body=await req.json().catch(()=>null) as {galeria?:unknown;variante?:unknown;fotos?:unknown}|null;
  const galeria=typeof body?.galeria==="string"?body.galeria:"";
  const variante=body?.variante==="entrega"?"entrega":"principal";
  if(!uuidValido(galeria)||!Array.isArray(body?.fotos)||body!.fotos.length>200){
    return NextResponse.json({error:"Metadados inválidos."},{status:400});
  }

  const supabase=createServiceClient();
  const{data:g}=await supabase.from("galerias").select("id,user_id").eq("id",galeria).eq("user_id",user.id).maybeSingle();
  if(!g)return NextResponse.json({error:"Galeria não encontrada."},{status:404});

  const linhas=(body!.fotos as Entrada[]).flatMap(item=>{
    const nome=typeof item.nome==="string"?item.nome.trim():"";
    if(!nome||nome.length>500||nome.includes("/")||nome.includes("\\"))return[];
    const largura=numero(item.largura),altura=numero(item.altura),bytes=numero(item.bytes),thumbBytes=numero(item.thumbBytes);
    return [{
      galeria_id:galeria,user_id:user.id,variante,nome,
      largura:largura&&largura>0?Math.round(largura):null,
      altura:altura&&altura>0?Math.round(altura):null,
      bytes:bytes!==null&&bytes>=0?Math.round(bytes):null,
      mime_type:typeof item.mimeType==="string"?item.mimeType.slice(0,120):null,
      thumb_bytes:thumbBytes!==null&&thumbBytes>=0?Math.round(thumbBytes):null,
      atualizado_em:new Date().toISOString(),
    }];
  });
  if(!linhas.length)return NextResponse.json({ok:true,gravadas:0});

  const{error}=await supabase.from("galeria_foto_metadata").upsert(linhas,{onConflict:"galeria_id,variante,nome"});
  if(error)return NextResponse.json({error:"Não foi possível registrar os metadados."},{status:500});
  return NextResponse.json({ok:true,gravadas:linhas.length},{headers:{"Cache-Control":"no-store, private"}});
}
