import {NextRequest,NextResponse} from "next/server";
import {createServiceClient} from "../../../../lib/supabase-server";
import {requisicaoMesmoOrigin} from "../../../../lib/request-security";
import {uuidValido} from "../../../../lib/validation";
import {consumirRateLimit} from "../../../../lib/rate-limit";

export const dynamic="force-dynamic";
export const runtime="nodejs";
function json(v:unknown,s=200){return NextResponse.json(v,{status:s,headers:{"Cache-Control":"no-store, private"}})}
async function session(req:NextRequest){
 const token=req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token)return null;const {data,error}=await createServiceClient().auth.getUser(token);return error?null:data.user??null;
}
function nomeValido(x:unknown):x is string{return typeof x==="string"&&x.length>0&&x.length<=300&&!/[\\/\u0000-\u001f\u007f]/.test(x)&&x!=="."&&x!==".." }
async function pastaDoProjeto(db:ReturnType<typeof createServiceClient>,uid:string,projeto:string,pasta:string){
 const {data}=await db.from("galerias").select("id,projeto_id,user_id,etapa,prova,capa,visivel").eq("id",pasta).eq("projeto_id",projeto).eq("user_id",uid).maybeSingle();
 return data;
}
async function nomesNaPasta(db:ReturnType<typeof createServiceClient>,uid:string,id:string){
 const nomes=new Set<string>();
 for(let offset=0;offset<4000;offset+=100){
  const {data,error}=await db.storage.from("fotos").list(`${uid}/${id}`,{limit:100,offset,sortBy:{column:"name",order:"asc"}});
  if(error)throw error;
  for(const x of data??[])if(x.id!==null&&nomeValido(x.name))nomes.add(x.name);
  if((data??[]).length<100)break;
 }
 return nomes;
}
export async function GET(req:NextRequest){
 const user=await session(req);if(!user)return json({error:"Não autorizado."},401);
 const projeto=req.nextUrl.searchParams.get("projeto")??"",pasta=req.nextUrl.searchParams.get("pasta")??"";
 const offset=Math.max(0,Math.min(3000,Number(req.nextUrl.searchParams.get("offset")??"0")||0));
 if(!uuidValido(projeto)||!uuidValido(pasta))return json({error:"Parâmetros inválidos."},400);
 const db=createServiceClient();const source=await pastaDoProjeto(db,user.id,projeto,pasta);
 if(!source)return json({error:"Pasta não encontrada."},404);
 const {data,error}=await db.storage.from("fotos").list(`${user.id}/${pasta}`,{limit:120,offset,sortBy:{column:"name",order:"asc"}});
 if(error)return json({error:"Não foi possível listar as fotos."},500);
 const nomes=(data??[]).filter(x=>x.id!==null&&nomeValido(x.name)).map(x=>x.name);
 const {data:urls}=nomes.length?await db.storage.from("fotos").createSignedUrls(nomes.map(n=>`${user.id}/${pasta}/thumbs/${n}`),3600):{data:[]};
 const previews=new Map((urls??[]).filter(x=>x.signedUrl&&x.path).map(x=>[String(x.path).split("/").at(-1),x.signedUrl]));
 return json({fotos:nomes.map(nome=>({nome,thumb:previews.get(nome)??null})),hasMore:(data??[]).length===120,proximoOffset:offset+(data??[]).length,capa:source.capa,etapa:source.etapa});
}
export async function POST(req:NextRequest){
 if(!requisicaoMesmoOrigin(req))return json({error:"Origem inválida."},403);
 const user=await session(req);if(!user)return json({error:"Não autorizado."},401);
 if(!await consumirRateLimit(req,"project_write",user.id,10*60,120))return json({error:"Muitas operações. Aguarde alguns minutos."},429);
 const b=await req.json().catch(()=>({})) as {acao?:string;projeto?:string;pasta?:string;destino?:string;fotos?:string[];foto?:string};
 if(!uuidValido(b.projeto)||!uuidValido(b.pasta))return json({error:"Projeto ou pasta inválidos."},400);
 const db=createServiceClient();const origem=await pastaDoProjeto(db,user.id,b.projeto,b.pasta);
 if(!origem)return json({error:"Pasta não encontrada."},404);
 if(b.acao==="capa"){
  if(!nomeValido(b.foto))return json({error:"Foto inválida."},400);
  const existentes=await nomesNaPasta(db,user.id,b.pasta);
  if(!existentes.has(b.foto))return json({error:"A foto não pertence a esta pasta."},404);
  const {error}=await db.from("galerias").update({capa:b.foto}).eq("id",b.pasta).eq("projeto_id",b.projeto).eq("user_id",user.id);
  return error?json({error:"Não foi possível definir a capa."},500):json({ok:true});
 }
 if(b.acao!=="mover")return json({error:"Operação não reconhecida."},400);
 if(!uuidValido(b.destino)||b.destino===b.pasta)return json({error:"Escolha outra pasta do mesmo projeto."},400);
 if(!Array.isArray(b.fotos)||!b.fotos.length||b.fotos.length>25||b.fotos.some(x=>!nomeValido(x))||new Set(b.fotos).size!==b.fotos.length)return json({error:"Selecione até 25 fotos válidas por operação."},400);
 const dest=await pastaDoProjeto(db,user.id,b.projeto,b.destino);
 if(!dest)return json({error:"Pasta de destino não encontrada neste projeto."},404);
 // Nunca movimentar arquivos cuja seleção, venda ou entrega já possa depender do nome e da pasta.
 if(origem.etapa!=="prova"||dest.etapa!=="prova")return json({error:"Só é possível mover fotos entre pastas ainda em prova, antes da entrega."},409);
 const [{data:selecoes,error:erroSelecoes},{data:vendas,error:erroVendas}]=await Promise.all([
   db.from("selecoes").select("galeria").in("galeria",[origem.id,dest.id]).limit(1),
   db.from("vendas_fotos").select("id").in("galeria",[origem.id,dest.id]).limit(1),
 ]);
 if(erroSelecoes||erroVendas)return json({error:"Não foi possível validar o histórico das pastas. Tente novamente."},503);
 if((selecoes??[]).length||(vendas??[]).length)return json({error:"Essas pastas já possuem seleções ou vendas. Mantenha a organização atual para proteger o histórico do cliente."},409);
 const [srcNames,dstNames]=await Promise.all([nomesNaPasta(db,user.id,origem.id),nomesNaPasta(db,user.id,dest.id)]);
 if(b.fotos.some(n=>!srcNames.has(n)||dstNames.has(n)))return json({error:"Alguma foto não existe na origem ou já tem o mesmo nome no destino."},409);
 const thumbNames=new Set<string>();
 for(let offset=0;offset<4000;offset+=100){const r=await db.storage.from("fotos").list(`${user.id}/${origem.id}/thumbs`,{limit:100,offset});if(r.error)return json({error:"Não foi possível verificar as miniaturas."},500);for(const x of r.data??[])if(x.id!==null)thumbNames.add(x.name);if((r.data??[]).length<100)break}
 const movidas:string[]=[];
 for(const nome of b.fotos){
  const de=`${user.id}/${origem.id}/${nome}`,para=`${user.id}/${dest.id}/${nome}`;
  const um=await db.storage.from("fotos").move(de,para);
  if(um.error)return json({error:"Falha ao mover arquivo. Atualize a lista antes de tentar novamente.",movidas},500);
  let mini=false;
  if(thumbNames.has(nome)){
   const thumb=await db.storage.from("fotos").move(`${user.id}/${origem.id}/thumbs/${nome}`,`${user.id}/${dest.id}/thumbs/${nome}`);
   if(thumb.error){await db.storage.from("fotos").move(para,de);return json({error:"Falha ao mover a miniatura. A operação foi interrompida.",movidas},500)}
   mini=true;
  }
  const meta=await db.from("galeria_foto_metadata").update({galeria_id:dest.id}).eq("galeria_id",origem.id).eq("user_id",user.id).eq("variante","principal").eq("nome",nome);
  if(meta.error){
   await db.storage.from("fotos").move(para,de);
   if(mini)await db.storage.from("fotos").move(`${user.id}/${dest.id}/thumbs/${nome}`,`${user.id}/${origem.id}/thumbs/${nome}`);
   return json({error:"Falha ao atualizar os metadados. Operação interrompida.",movidas},500);
  }
  if(origem.capa===nome)await db.from("galerias").update({capa:null}).eq("id",origem.id).eq("user_id",user.id);
  await db.from("galeria_projetos").update({capa_arquivo:null,capa_galeria_id:null}).eq("id",b.projeto).eq("user_id",user.id).eq("capa_galeria_id",origem.id).eq("capa_arquivo",nome);
  movidas.push(nome);
 }
 await db.from("galeria_projetos").update({atualizado_em:new Date().toISOString()}).eq("id",b.projeto).eq("user_id",user.id);
 return json({ok:true,movidas});
}
