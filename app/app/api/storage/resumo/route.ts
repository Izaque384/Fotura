import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { contextoPlano } from "../../../../lib/billing-usage";
import { registrarErro } from "../../../../lib/observability";
import { dataCalendarioExpirada } from "../../../../lib/date-only";

export const dynamic="force-dynamic";

export async function GET(req:NextRequest){
 const h=req.headers.get("authorization")??"",m=h.match(/^Bearer\s+(.+)$/i);
 if(!m)return NextResponse.json({error:"Não autorizado."},{status:401});
 const supabase=createServiceClient();
 const{data:auth,error:authError}=await supabase.auth.getUser(m[1]);
 if(authError||!auth.user)return NextResponse.json({error:"Não autorizado."},{status:401});
 try{
  const[contexto,{data,error}]=await Promise.all([
   contextoPlano(supabase,auth.user.id),
   supabase.rpc("resumo_storage_conta_backend",{p_user_id:auth.user.id}),
  ]);
  if(error)throw error;
  const galerias=(data??[]).map((g:any)=>({
   id:String(g.galeria_id),titulo:String(g.titulo||"Galeria"),etapa:String(g.etapa||"prova"),
   criadoEm:g.criado_em??null,linkAte:g.link_ate??null,expirada:dataCalendarioExpirada(g.link_ate??null),
   storageLimpo:Boolean(g.storage_limpo),bytesTotal:Number(g.bytes_total??0),arquivosTotal:Number(g.arquivos_total??0),
   bytesEntrega:Number(g.bytes_entrega??0),arquivosEntrega:Number(g.arquivos_entrega??0),
  }));
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
