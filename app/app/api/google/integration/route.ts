import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { getGoogleAccessToken, statusGoogle } from "../../../../lib/google-contacts";

async function user(req:NextRequest){const h=req.headers.get("authorization")||"";const token=h.startsWith("Bearer ")?h.slice(7).trim():"";if(!token)return null;const supabase=createServiceClient();const {data,error}=await supabase.auth.getUser(token);return error||!data.user?null:{supabase,user:data.user};}

async function googleProfilePhoto(userId:string){
  try{
    const access=await getGoogleAccessToken(userId);if(!access)return null;
    const headers={Authorization:`Bearer ${access}`};
    const r=await fetch("https://people.googleapis.com/v1/people/me?personFields=photos",{headers,cache:"no-store"});
    if(!r.ok)return null;
    const data=await r.json() as {photos?:Array<{url?:string;default?:boolean}>};
    const url=data.photos?.find(p=>p.url&&!p.default)?.url??data.photos?.find(p=>p.url)?.url;
    if(!url)return null;
    const img=await fetch(url,{headers,cache:"no-store"});if(!img.ok)return null;
    const type=img.headers.get("content-type")||"image/jpeg";if(!type.startsWith("image/"))return null;
    const buf=Buffer.from(await img.arrayBuffer());if(!buf.length||buf.length>1_000_000)return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  }catch{return null}
}

export async function GET(req:NextRequest){
  const a=await user(req);if(!a)return NextResponse.json({error:"Não autorizado."},{status:401});
  const status=await statusGoogle(a.user.id);
  const avatar=status.conectado?await googleProfilePhoto(a.user.id):null;
  return NextResponse.json({...status,avatar});
}

export async function DELETE(req:NextRequest){const a=await user(req);if(!a)return NextResponse.json({error:"Não autorizado."},{status:401});const {error}=await a.supabase.from("google_integracoes").delete().eq("user_id",a.user.id);if(error)return NextResponse.json({error:"Não foi possível desconectar o Google."},{status:500});return NextResponse.json({ok:true});}
