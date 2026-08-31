import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { getGoogleAccessToken } from "../../../../lib/google-contacts";

type Body={emails?:unknown};
type GooglePerson={
  emailAddresses?:Array<{value?:string}>;
  photos?:Array<{url?:string;default?:boolean}>;
};
type ConnectionsResponse={connections?:GooglePerson[];nextPageToken?:string};

async function authUser(req:NextRequest){const h=req.headers.get("authorization")||"";const token=h.startsWith("Bearer ")?h.slice(7).trim():"";if(!token)return null;const supabase=createServiceClient();const {data,error}=await supabase.auth.getUser(token);return error||!data.user?null:data.user;}

async function photoDataUrl(url:string,headers:{Authorization:string}){
  try{
    const r=await fetch(url,{headers,cache:"no-store"});
    if(!r.ok)return null;
    const type=r.headers.get("content-type")||"image/jpeg";
    if(!type.startsWith("image/"))return null;
    const buf=Buffer.from(await r.arrayBuffer());
    if(!buf.length||buf.length>1_000_000)return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  }catch{return null}
}

export async function POST(req:NextRequest){
  const user=await authUser(req);if(!user)return NextResponse.json({error:"Não autorizado."},{status:401});
  let body:Body;try{body=await req.json()}catch{return NextResponse.json({error:"Requisição inválida."},{status:400})}
  const emails=Array.isArray(body.emails)?body.emails.filter((x):x is string=>typeof x==="string").map(x=>x.trim().toLowerCase()).filter(Boolean).slice(0,50):[];
  if(!emails.length)return NextResponse.json({avatars:{}});
  let access:string|null=null;try{access=await getGoogleAccessToken(user.id)}catch{}
  if(!access)return NextResponse.json({avatars:{},conectado:false});

  const headers={Authorization:`Bearer ${access}`};
  const wanted=new Set(emails);
  const photoUrls:Record<string,string>={};
  let pageToken="";

  try{
    do{
      const params=new URLSearchParams({personFields:"emailAddresses,photos",pageSize:"500",sortOrder:"LAST_MODIFIED_DESCENDING"});
      if(pageToken)params.set("pageToken",pageToken);
      const r=await fetch(`https://people.googleapis.com/v1/people/me/connections?${params}`,{headers,cache:"no-store"});
      if(!r.ok)break;
      const d=await r.json() as ConnectionsResponse;
      for(const person of d.connections??[]){
        const matched=person.emailAddresses?.map(e=>(e.value||"").trim().toLowerCase()).find(email=>wanted.has(email));
        if(!matched||photoUrls[matched])continue;
        const photo=person.photos?.find(p=>p.url&&!p.default)?.url??person.photos?.find(p=>p.url)?.url;
        if(photo)photoUrls[matched]=photo;
      }
      pageToken=d.nextPageToken??"";
    }while(pageToken&&Object.keys(photoUrls).length<wanted.size);
  }catch{}

  const avatars:Record<string,string>={};
  await Promise.all(Object.entries(photoUrls).map(async([email,url])=>{
    const dataUrl=await photoDataUrl(url,headers);
    if(dataUrl)avatars[email]=dataUrl;
  }));

  return NextResponse.json({avatars,conectado:true});
}
