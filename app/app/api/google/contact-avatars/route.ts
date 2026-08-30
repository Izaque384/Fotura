import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { getGoogleAccessToken } from "../../../../lib/google-contacts";

type Body={emails?:unknown};

async function authUser(req:NextRequest){const h=req.headers.get("authorization")||"";const token=h.startsWith("Bearer ")?h.slice(7).trim():"";if(!token)return null;const supabase=createServiceClient();const {data,error}=await supabase.auth.getUser(token);return error||!data.user?null:data.user;}

export async function POST(req:NextRequest){
  const user=await authUser(req);if(!user)return NextResponse.json({error:"Não autorizado."},{status:401});
  let body:Body;try{body=await req.json()}catch{return NextResponse.json({error:"Requisição inválida."},{status:400})}
  const emails=Array.isArray(body.emails)?body.emails.filter((x):x is string=>typeof x==="string").map(x=>x.trim().toLowerCase()).filter(Boolean).slice(0,50):[];
  if(!emails.length)return NextResponse.json({avatars:{}});
  let access:string|null=null;try{access=await getGoogleAccessToken(user.id)}catch{}
  if(!access)return NextResponse.json({avatars:{},conectado:false});

  const headers={Authorization:`Bearer ${access}`};
  await fetch("https://people.googleapis.com/v1/people:searchContacts?query=&readMask=emailAddresses,photos",{headers,cache:"no-store"}).catch(()=>null);
  const avatars:Record<string,string>={};
  for(const email of emails){
    const url=`https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(email)}&readMask=emailAddresses,photos&pageSize=10`;
    const r=await fetch(url,{headers,cache:"no-store"});if(!r.ok)continue;
    const d=await r.json() as {results?:Array<{person?:{emailAddresses?:Array<{value?:string}>;photos?:Array<{url?:string;default?:boolean}>}}>};
    const person=d.results?.map(x=>x.person).find(p=>p?.emailAddresses?.some(e=>(e.value||"").trim().toLowerCase()===email));
    const photo=person?.photos?.find(p=>p.url&&!p.default)?.url;
    if(photo)avatars[email]=photo;
  }
  return NextResponse.json({avatars,conectado:true});
}
