import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { decryptToken, encryptToken, validarOAuthState } from "../../../../lib/google-contacts";

export async function GET(req:NextRequest){
  const code=req.nextUrl.searchParams.get("code")||"";
  const state=req.nextUrl.searchParams.get("state")||"";
  let uid:string|null=null;
  try{uid=validarOAuthState(state)}catch{}
  if(!uid||!code)return NextResponse.redirect(new URL("/configuracoes?google=erro",req.url));
  const clientId=process.env.GOOGLE_OAUTH_CLIENT_ID,clientSecret=process.env.GOOGLE_OAUTH_CLIENT_SECRET,redirectUri=process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if(!clientId||!clientSecret||!redirectUri)return NextResponse.redirect(new URL("/configuracoes?google=config",req.url));
  try{
    const tokenRes=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:"authorization_code"}),cache:"no-store"});
    if(!tokenRes.ok)throw new Error();
    const tokens=await tokenRes.json() as {access_token:string;refresh_token?:string;expires_in?:number;scope?:string};
    const supabase=createServiceClient();
    const {data:anterior}=await supabase.from("google_integracoes").select("refresh_token_encrypted").eq("user_id",uid).maybeSingle();
    const refresh=tokens.refresh_token||(anterior?.refresh_token_encrypted?decryptToken(anterior.refresh_token_encrypted as string):"");
    if(!refresh)throw new Error();
    const infoRes=await fetch("https://www.googleapis.com/oauth2/v2/userinfo",{headers:{Authorization:`Bearer ${tokens.access_token}`},cache:"no-store"});
    const info=infoRes.ok?await infoRes.json() as {email?:string}:{};
    await supabase.from("google_integracoes").upsert({user_id:uid,google_email:info.email??null,access_token_encrypted:encryptToken(tokens.access_token),refresh_token_encrypted:encryptToken(refresh),expires_at:new Date(Date.now()+(tokens.expires_in??3600)*1000).toISOString(),scope:tokens.scope??null,atualizado_em:new Date().toISOString()},{onConflict:"user_id"});
    return NextResponse.redirect(new URL("/configuracoes?google=conectado",req.url));
  }catch{return NextResponse.redirect(new URL("/configuracoes?google=erro",req.url));}
}
