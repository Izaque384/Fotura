import "server-only";
import crypto from "node:crypto";
import { createServiceClient } from "./supabase-server";

const GOOGLE_SCOPE = "https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/userinfo.email";

type Integracao = {
  user_id:string;
  google_email:string|null;
  access_token_encrypted:string;
  refresh_token_encrypted:string;
  expires_at:string;
  scope:string|null;
};

function encryptionKey(){
  const raw=process.env.GOOGLE_TOKEN_ENCRYPTION_KEY||"";
  const key=Buffer.from(raw,"base64");
  if(key.length!==32) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY deve conter 32 bytes em base64.");
  return key;
}

export function encryptToken(value:string){
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv("aes-256-gcm",encryptionKey(),iv);
  const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  const tag=cipher.getAuthTag();
  return [iv,tag,encrypted].map(x=>x.toString("base64url")).join(".");
}

export function decryptToken(value:string){
  const [ivB64,tagB64,dataB64]=value.split(".");
  if(!ivB64||!tagB64||!dataB64) throw new Error("Token criptografado inválido.");
  const decipher=crypto.createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(ivB64,"base64url"));
  decipher.setAuthTag(Buffer.from(tagB64,"base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64,"base64url")),decipher.final()]).toString("utf8");
}

function stateSecret(){
  const secret=process.env.GOOGLE_OAUTH_STATE_SECRET||"";
  if(secret.length<32) throw new Error("GOOGLE_OAUTH_STATE_SECRET não configurado.");
  return secret;
}

export function criarOAuthState(userId:string){
  const payload=Buffer.from(JSON.stringify({uid:userId,exp:Date.now()+10*60*1000,nonce:crypto.randomBytes(16).toString("hex")})).toString("base64url");
  const sig=crypto.createHmac("sha256",stateSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function validarOAuthState(state:string){
  const [payload,sig]=state.split(".");
  if(!payload||!sig) return null;
  const expected=crypto.createHmac("sha256",stateSecret()).update(payload).digest("base64url");
  const a=Buffer.from(sig),b=Buffer.from(expected);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b)) return null;
  try{
    const data=JSON.parse(Buffer.from(payload,"base64url").toString("utf8")) as {uid?:string;exp?:number};
    if(!data.uid||!data.exp||Date.now()>data.exp) return null;
    return data.uid;
  }catch{return null}
}

export function googleOAuthUrl(state:string){
  const clientId=process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri=process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if(!clientId||!redirectUri) throw new Error("OAuth Google não configurado.");
  const p=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:"code",scope:GOOGLE_SCOPE,access_type:"offline",include_granted_scopes:"true",prompt:"consent",state});
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function refreshAccessToken(row:Integracao){
  const clientId=process.env.GOOGLE_OAUTH_CLIENT_ID,clientSecret=process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if(!clientId||!clientSecret) throw new Error("OAuth Google não configurado.");
  const refreshToken=decryptToken(row.refresh_token_encrypted);
  const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:"refresh_token"}),cache:"no-store"});
  if(!r.ok) throw new Error("Falha ao renovar acesso ao Google.");
  const d=await r.json() as {access_token:string;expires_in?:number;scope?:string};
  const expiresAt=new Date(Date.now()+(d.expires_in??3600)*1000).toISOString();
  const supabase=createServiceClient();
  await supabase.from("google_integracoes").update({access_token_encrypted:encryptToken(d.access_token),expires_at:expiresAt,scope:d.scope??row.scope,atualizado_em:new Date().toISOString()}).eq("user_id",row.user_id);
  return d.access_token;
}

export async function getGoogleAccessToken(userId:string){
  const supabase=createServiceClient();
  const {data,error}=await supabase.from("google_integracoes").select("user_id,google_email,access_token_encrypted,refresh_token_encrypted,expires_at,scope").eq("user_id",userId).maybeSingle();
  if(error||!data) return null;
  const row=data as Integracao;
  if(new Date(row.expires_at).getTime()>Date.now()+60_000) return decryptToken(row.access_token_encrypted);
  return refreshAccessToken(row);
}

export async function statusGoogle(userId:string){
  const supabase=createServiceClient();
  const {data}=await supabase.from("google_integracoes").select("google_email,expires_at").eq("user_id",userId).maybeSingle();
  return data?{conectado:true,email:(data.google_email as string|null)??null}:{conectado:false,email:null};
}
