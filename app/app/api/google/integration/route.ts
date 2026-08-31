import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { statusGoogle } from "../../../../lib/google-contacts";

async function user(req:NextRequest){const h=req.headers.get("authorization")||"";const token=h.startsWith("Bearer ")?h.slice(7).trim():"";if(!token)return null;const supabase=createServiceClient();const {data,error}=await supabase.auth.getUser(token);return error||!data.user?null:{supabase,user:data.user};}

export async function GET(req:NextRequest){
  const a=await user(req);if(!a)return NextResponse.json({error:"Não autorizado."},{status:401});
  const [status,perfil]=await Promise.all([
    statusGoogle(a.user.id),
    a.supabase.from("perfis").select("logo_url").eq("id",a.user.id).maybeSingle(),
  ]);
  const avatar=(perfil.data?.logo_url as string|null)??null;
  return NextResponse.json({...status,avatar});
}

export async function DELETE(req:NextRequest){const a=await user(req);if(!a)return NextResponse.json({error:"Não autorizado."},{status:401});const {error}=await a.supabase.from("google_integracoes").delete().eq("user_id",a.user.id);if(error)return NextResponse.json({error:"Não foi possível desconectar o Google."},{status:500});return NextResponse.json({ok:true});}
