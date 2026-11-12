import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { contextoPlano } from "../../../../lib/billing-usage";
import { registrarErro } from "../../../../lib/observability";
import { dataCalendarioExpirada } from "../../../../lib/date-only";
import { isR2ReadEnabled } from "../../../../lib/r2-storage";

export const dynamic="force-dynamic";

export async function GET(req:NextRequest){
 const h=req.headers.get("authorization")??"",m=h.match(/^Bearer\s+(.+)$/i);
 if(!m)return NextResponse.json({error:"Não autorizado."},{status:401});
 const supabase=createServiceClient();
 const{data:auth,error:authError}=await supabase.auth.getUser(m[1]);
 if(authError||!auth.user)return NextResponse.json({error:"Não autorizado."},{status:401});
 try{
  const [contexto,{data,error},r2Extra]=await Promise.all([
   contextoPlano(supabase,auth.user.id),
   supabase.rpc("resumo_storage_conta_backend",{p_user_id:auth.user.id}),
   isR2ReadEnabled()
    ? supabase.rpc("r2_extra_storage_gallery_summary_backend",{p_user_id:auth.user.id})
    : Promise.resolve({data:[],error:null}),
  ]);
  if(error)throw error;
  if(r2Extra.error)throw r2Extra.error;
  const extras=new Map((r2Extra.data??[]).map((r:any)=>[String(r.galeria_id),r]));
  function safeExtra(value:unknown){
   const number=Number(value??0);
   if(!Number.isSafeInteger(number)||number<0)throw new Error("Uso R2 inválido.");
   return number;
  }
  const galerias=(data??[]).map((g:any)=>{
    const r=extras.get(String(g.galeria_id)) as Record<string,unknown>|undefined;
    return {
   id:String(g.galeria_id),titulo:String(g.titulo||"Galeria"),etapa:String(g.etapa||"prova"),
   criadoEm:g.criado_em??null,linkAte:g.link_ate??null,expirada:dataCalendarioExpirada(g.link_ate??null),
   storageLimpo:Boolean(g.storage_limpo),
   bytesTotal:Number(g.bytes_total??0)+safeExtra(r?.bytes_extra),
   arquivosTotal:Number(g.arquivos_total??0)+safeExtra(r?.arquivos_extra),
   bytesEntrega:Number(g.bytes_entrega??0)+safeExtra(r?.bytes_entrega_extra),
   arquivosEntrega:Number(g.arquivos_entrega??0)+safeExtra(r?.arquivos_entrega_extra),
  };
  });
  const conhecido=galerias.reduce((a:number,g:any)=>a+g.bytesTotal,0);
  const residual=Math.max(0,contexto.uso.armazenamentoBytes-conhecido);
  return NextResponse.json({
   plano:{codigo:contexto.plano.codigo,nome:contexto.plano.nome},
   usoBytes:contexto.uso.armazenamentoBytes,
   limiteGb:contexto.limites.armazenamento.limiteGb,
   residualBytes:residual,
   galerias,
  },{headers:{"Cache-Control":"no-store, private"}});
 }catch(error){
  registrarErro("storage.summary",req,error,{userId:auth.user.id});
  return NextResponse.json({error:"Não foi possível carregar o armazenamento."},{status:500});
 }
}
