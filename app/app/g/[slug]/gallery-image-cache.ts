import type { GallerySignedPayload } from "./gallery-types";

type CacheEntry={expiresAt:number;payload:GallerySignedPayload};
const gradeCache=new Map<string,CacheEntry>();
const gradePending=new Map<string,Promise<{status:number;ok:boolean;payload:GallerySignedPayload|null}>>();
const TTL_MS=44*60*1000;

export function getCachedGalleryGrid(galeria:string){
  const entry=gradeCache.get(galeria);
  if(!entry)return null;
  if(entry.expiresAt<=Date.now()){gradeCache.delete(galeria);return null}
  return entry.payload;
}

export function setCachedGalleryGrid(galeria:string,payload:GallerySignedPayload){
  gradeCache.set(galeria,{payload,expiresAt:Date.now()+TTL_MS});
}

export function clearCachedGalleryGrid(galeria:string){
  gradeCache.delete(galeria);
}

export async function loadGalleryGrid(galeria:string,force=false):Promise<{status:number;ok:boolean;payload:GallerySignedPayload|null}>{
  if(!force){
    const cached=getCachedGalleryGrid(galeria);
    if(cached)return{status:200,ok:true,payload:cached};
    const pending=gradePending.get(galeria);
    if(pending)return pending;
  }
  const request=(async()=>{
    const response=await fetch(`/api/fotos/signed?galeria=${encodeURIComponent(galeria)}&modo=grade`,{cache:"no-store"});
    const payload=response.ok?await response.json() as GallerySignedPayload:null;
    if(response.ok&&payload)setCachedGalleryGrid(galeria,payload);
    return{status:response.status,ok:response.ok,payload};
  })();
  if(!force)gradePending.set(galeria,request);
  try{return await request}
  finally{if(!force&&gradePending.get(galeria)===request)gradePending.delete(galeria)}
}
