import {NextRequest,NextResponse} from "next/server";
import {createServiceClient} from "../../../../lib/supabase-server";
import {requisicaoMesmoOrigin} from "../../../../lib/request-security";
import {consumirRateLimit} from "../../../../lib/rate-limit";
import {uuidValido} from "../../../../lib/validation";
import {configProjeto} from "../../../../lib/project-templates";

export const dynamic="force-dynamic";
function json(v:unknown,s=200){return NextResponse.json(v,{status:s,headers:{"Cache-Control":"no-store, private"}})}
async function user(req:NextRequest){const bearer=req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];if(!bearer)return null;const x=await createServiceClient().auth.getUser(bearer);return x.error?null:x.data.user??null}
export async function GET(req:NextRequest){
 const u=await user(req);if(!u)return json({error:"Não autorizado."},401);
 const {data,error}=await createServiceClient().from("galeria_presets").select("id,nome,config,atualizado_em").eq("user_id",u.id).order("atualizado_em",{ascending:false}).limit(15);
 return error?json({error:"Não foi possível consultar seus modelos."},500):json({presets:(data??[]).filter(x=>configProjeto(x.config))});
}
export async function POST(req:NextRequest){
 if(!requisicaoMesmoOrigin(req))return json({error:"Origem inválida."},403);
 const u=await user(req);if(!u)return json({error:"Não autorizado."},401);
 if(!await consumirRateLimit(req,"project_write",u.id,600,120))return json({error:"Muitas solicitações."},429);
 const b=await req.json().catch(()=>({})) as {projetoId?:string;nome?:string};
 const nome=b.nome?.trim().slice(0,70);if(!nome||!uuidValido(b.projetoId))return json({error:"Informe nome e projeto válidos."},400);
 const db=createServiceClient();
 const [{count},{data:p}]=await Promise.all([db.from("galeria_presets").select("id",{head:true,count:"exact"}).eq("user_id",u.id),db.from("galeria_projetos").select("prova,limite,download_ativo,download_individual,download_completo,download_tamanho,watermark_ativo,watermark_texto,watermark_opacidade,assistente_ativo").eq("id",b.projetoId).eq("user_id",u.id).maybeSingle()]);
 if(!p)return json({error:"Projeto não encontrado."},404);if((count??0)>=12)return json({error:"Você já tem 12 modelos. Exclua um antes de salvar outro."},409);
 const cfg=configProjeto(p);if(!cfg)return json({error:"Configurações incompatíveis para modelo."},400);
 const {data,error}=await db.from("galeria_presets").insert({user_id:u.id,nome,config:cfg}).select("id,nome,config,atualizado_em").single();
 return error||!data?json({error:"Não foi possível salvar o modelo."},500):json({preset:data},201);
}
export async function DELETE(req:NextRequest){
 if(!requisicaoMesmoOrigin(req))return json({error:"Origem inválida."},403);
 const u=await user(req);if(!u)return json({error:"Não autorizado."},401);
 const b=await req.json().catch(()=>({})) as {id?:string};if(!uuidValido(b.id))return json({error:"Modelo inválido."},400);
 const {error}=await createServiceClient().from("galeria_presets").delete().eq("id",b.id).eq("user_id",u.id);
 return error?json({error:"Não foi possível excluir o modelo."},500):json({ok:true});
}
