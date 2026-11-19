import { NextRequest } from "next/server";
import sharp from "sharp";
import { createServiceClient } from "../../../../lib/supabase-server";
import { temAcessoGaleria } from "../../../../lib/gallery-access";
import { dataCalendarioExpirada } from "../../../../lib/date-only";
import { uuidValido } from "../../../../lib/validation";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { listarCatalogoGaleriaHibrido } from "../../../../lib/gallery-media-catalog";
import { variantePublicaDaGaleria } from "../../../../lib/public-gallery-media-variant";
import { downloadPrivateMediaBlob } from "../../../../lib/media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function erro(status: number) {
 return new Response(null, {status, headers:{"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, noarchive"}});
}

/** Renderiza uma prévia de maior qualidade, inclusive para fotos antigas.
 * Nunca entrega diretamente os bytes originais e aplica as regras de acesso. */
export async function GET(req: NextRequest) {
 const galeriaId=req.nextUrl.searchParams.get("galeria")?.trim()??"";
 const arquivo=req.nextUrl.searchParams.get("arquivo")?.trim()??"";
 const modo=req.nextUrl.searchParams.get("modo");
 if(!uuidValido(galeriaId)||!arquivo||arquivo.length>300||
    /[\\/\u0000-\u001f\u007f]/.test(arquivo)||arquivo==="."||arquivo===".."||
    (modo!=="grade"&&modo!=="lightbox"))return erro(400);
 if(!await consumirRateLimit(req,"gallery_preview_image",galeriaId,60,180))return erro(429);

 const db=createServiceClient();
 const {data:galeria,error:erroGaleria}=await db.from("galerias")
  .select("id,user_id,visivel,link_ate,tem_senha,etapa,prova,entrega_publicada_em")
  .eq("id",galeriaId).maybeSingle();
 if(erroGaleria)return erro(503);
 if(!galeria||galeria.visivel===false)return erro(404);
 if(dataCalendarioExpirada(galeria.link_ate as string|null))return erro(403);
 if(galeria.tem_senha&&!temAcessoGaleria(req,galeriaId))return erro(401);
 try{
  const variante=await variantePublicaDaGaleria(db,galeria);
  const {data:catalogo,error:erroCatalogo}=await listarCatalogoGaleriaHibrido(db,String(galeria.user_id),galeriaId,variante);
  if(erroCatalogo)return erro(503);
  if(!(catalogo??[]).some(item=>item.nome===arquivo))return erro(404);
  const path=String(galeria.user_id)+"/"+galeriaId+(variante==="entrega"?"/entrega":"")+"/"+arquivo;
  const blob=await downloadPrivateMediaBlob(db,"fotos",path);
  if(!blob||blob.size<1||blob.size>50*1024*1024)return erro(404);
  const limite=modo==="grade"?1080:2100;
  const image=await sharp(Buffer.from(await blob.arrayBuffer()),{limitInputPixels:65_000_000})
   .rotate().resize({width:limite,height:limite,fit:"inside",withoutEnlargement:true})
   .jpeg({quality:modo==="grade"?90:91,mozjpeg:true,chromaSubsampling:"4:4:4"})
   .toBuffer();
  return new Response(new Uint8Array(image),{status:200,headers:{
   "Content-Type":"image/jpeg","Content-Length":String(image.length),
   "Cache-Control":"private, no-store","X-Robots-Tag":"noindex, noarchive",
   "X-Content-Type-Options":"nosniff"
  }});
 }catch{return erro(503)}
}
