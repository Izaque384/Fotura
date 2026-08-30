import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { criarOAuthState, googleOAuthUrl } from "../../../../lib/google-contacts";

export async function POST(req:NextRequest){
  const auth=req.headers.get("authorization")||"";
  const token=auth.startsWith("Bearer ")?auth.slice(7).trim():"";
  if(!token)return NextResponse.json({error:"Não autorizado."},{status:401});
  const supabase=createServiceClient();
  const {data,error}=await supabase.auth.getUser(token);
  if(error||!data.user)return NextResponse.json({error:"Não autorizado."},{status:401});
  try{return NextResponse.json({url:googleOAuthUrl(criarOAuthState(data.user.id))});}
  catch{return NextResponse.json({error:"Integração Google ainda não foi configurada no servidor."},{status:503});}
}
