"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-client";

type Pasta={id:string;titulo:string;etapa:string;qtd:number};
type Foto={nome:string;thumb:string|null};
export default function ProjectPhotoManager({projetoId,pastas,pastaInicial,fechar,atualizar}:{projetoId:string;pastas:Pasta[];pastaInicial:string;fechar:()=>void;atualizar:()=>void}){
 const supabase=useMemo(()=>createClient(),[]);
 const [pasta,setPasta]=useState(pastaInicial),[destino,setDestino]=useState(""),[fotos,setFotos]=useState<Foto[]>([]),[selecionadas,setSelecionadas]=useState<string[]>([]);
 const [alterou,setAlterou]=useState(false),[carregando,setCarregando]=useState(false),[busy,setBusy]=useState(false),[aviso,setAviso]=useState(""),[erro,setErro]=useState(false),[proximo,setProximo]=useState<number|null>(null),[capa,setCapa]=useState<string|null>(null);
 const origem=pastas.find(x=>x.id===pasta);const destinos=pastas.filter(x=>x.id!==pasta&&x.etapa==="prova");
 async function token(){return (await supabase.auth.getSession()).data.session?.access_token??""}
 async function listar(id:string,offset=0){
  setCarregando(true);
  if(offset===0){setFotos([]);setSelecionadas([])}
  try{const access=await token();if(!access)throw Error("Sessão expirada.");const u=new URLSearchParams({projeto:projetoId,pasta:id,offset:String(offset)});
   const r=await fetch("/api/projeto/fotos?"+u,{headers:{Authorization:`Bearer ${access}`},cache:"no-store"});const data=await r.json();if(!r.ok)throw Error(data.error??"Não foi possível carregar.");
   setFotos(a=>offset===0?data.fotos:[...a,...data.fotos]);setProximo(data.hasMore?data.proximoOffset:null);setCapa(data.capa??null);
  }catch(e){setErro(true);setAviso(e instanceof Error?e.message:"Erro ao listar fotos.")}finally{setCarregando(false)}
 }
 useEffect(()=>{void listar(pasta)},[pasta,projetoId]);
 function encerrar(){if(alterou)atualizar();fechar()}
 useEffect(()=>{function esc(e:KeyboardEvent){if(e.key==="Escape"&&!busy){if(alterou)atualizar();fechar()}}window.addEventListener("keydown",esc);return()=>window.removeEventListener("keydown",esc)},[busy,fechar,alterou,atualizar]);
 function alternar(nome:string){setSelecionadas(a=>a.includes(nome)?a.filter(n=>n!==nome):[...a,nome])}
 async function acao(operacao:"capa"|"mover"){
  setErro(false);setAviso("");setBusy(true);
  try{
   if(operacao==="mover"&&(!destino||selecionadas.length>25))throw Error("Escolha a pasta de destino e até 25 fotos por operação.");
   const access=await token();
   const r=await fetch("/api/projeto/fotos",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify(operacao==="capa"?{acao:"capa",projeto:projetoId,pasta,foto:selecionadas[0]}:{acao:"mover",projeto:projetoId,pasta,destino,fotos:selecionadas})});
   const data=await r.json();if(!r.ok){if((data.movidas??[]).length){setAviso(`${data.movidas.length} fotos foram movidas, mas houve uma falha. Atualize o painel.`);await listar(pasta);setAlterou(true)}throw Error(data.error||"Não foi possível concluir.")}
   setAviso(operacao==="capa"?"Capa da pasta atualizada.":`${data.movidas.length} foto(s) movida(s) com sucesso.`);setSelecionadas([]);await listar(pasta);setAlterou(true);
  }catch(e){setErro(true);setAviso(e instanceof Error?e.message:"Erro.")}finally{setBusy(false)}
 }
 return <div className="ft-photo-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)encerrar()}}>
  <section className="ft-photo-manager" role="dialog" aria-modal="true" aria-label="Gerenciar fotos do projeto">
   <header><div><small>ORGANIZAÇÃO DE FOTOS</small><h2>Gerenciar fotos</h2><p>Selecione fotos para definir a capa ou movê-las entre pastas antes da seleção do cliente.</p></div><button type="button" onClick={encerrar} disabled={busy} aria-label="Fechar">✕</button></header>
   <div className="ft-photo-controls"><label>Pasta de origem<select value={pasta} disabled={busy} onChange={e=>{setPasta(e.target.value);setDestino("");setAviso("");setErro(false)}}>{pastas.map(x=><option key={x.id} value={x.id}>{x.titulo} · {x.qtd} fotos</option>)}</select></label><label>Destino (para mover)<select value={destino} disabled={busy||origem?.etapa!=="prova"} onChange={e=>setDestino(e.target.value)}><option value="">Escolher outra pasta</option>{destinos.map(x=><option key={x.id} value={x.id}>{x.titulo}</option>)}</select></label></div>
   <div className="ft-photo-toolbar"><span>{selecionadas.length} selecionada(s) · {fotos.length} carregada(s)</span><button type="button" onClick={()=>setSelecionadas(fotos.map(f=>f.nome))} disabled={busy||!fotos.length}>Selecionar visíveis</button><button type="button" onClick={()=>setSelecionadas([])} disabled={busy||!selecionadas.length}>Limpar seleção</button></div>
   {origem?.etapa!=="prova"&&<p className="ft-photo-warning">Esta pasta já está em preparação ou entrega. A movimentação está bloqueada para preservar os arquivos do cliente.</p>}
   {aviso&&<p className={"ft-photo-message"+(erro?" err":"")} role="status">{aviso}</p>}
   <div className="ft-photo-grid">
    {fotos.map(f=><button className={"ft-photo-tile"+(selecionadas.includes(f.nome)?" selected":"")} type="button" key={f.nome} onClick={()=>alternar(f.nome)} aria-pressed={selecionadas.includes(f.nome)} disabled={busy}><div className="ft-photo-preview">{f.thumb?<img src={f.thumb} alt="" loading="lazy"/>:<span>Foto</span>}{capa===f.nome&&<span className="ft-photo-coverflag">Capa</span>}</div><div className="ft-photo-name"><span className="ft-photo-check" aria-hidden="true">{selecionadas.includes(f.nome)?"☑":"☐"}</span><span title={f.nome}>{f.nome}</span></div></button>)}
    {!carregando&&!fotos.length&&<p>Nenhuma foto nesta pasta.</p>}
   </div>
   {proximo!==null&&<button className="ft-photo-more" type="button" disabled={carregando||busy} onClick={()=>void listar(pasta,proximo)}>{carregando?"Carregando…":"Carregar mais fotos"}</button>}
   <footer><small>Movimentações: até 25 fotos por vez, apenas antes de seleções, vendas e entregas.</small><div><button type="button" onClick={()=>void acao("capa")} disabled={busy||selecionadas.length!==1}>Definir como capa</button><button type="button" className="primary" onClick={()=>void acao("mover")} disabled={busy||!destino||!selecionadas.length||selecionadas.length>25||origem?.etapa!=="prova"}>{busy?"Processando…":"Mover fotos"}</button></div></footer>
  </section><style>{`
.ft-photo-overlay{position:fixed;inset:0;z-index:145;padding:20px;display:grid;place-items:center;background:#151321aa;backdrop-filter:blur(5px)}
.ft-photo-manager{width:min(860px,100%);max-height:93vh;overflow:auto;padding:20px;border-radius:18px;border:1px solid #dcd4eb;background:#fff;color:#282c42;box-shadow:0 30px 90px #17112866}
.ft-photo-manager header{display:flex;justify-content:space-between;gap:20px}.ft-photo-manager header small{font:800 10px inherit;color:#7464b7;letter-spacing:1px}.ft-photo-manager h2{margin:4px 0;font-size:22px}.ft-photo-manager header p{margin:0 0 14px;color:#7e8396;font-size:12px}.ft-photo-manager header button{height:33px;width:33px;border:1px solid #dcd6ea;border-radius:50%;background:#faf8fd}
.ft-photo-controls{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ft-photo-controls label{display:grid;gap:5px;color:#676d87;font-size:11px;font-weight:700}.ft-photo-controls select{min-width:0;max-width:100%;padding:10px;border:1px solid #dcd5e9;border-radius:9px;color:#343851;background:#faf9fd}
.ft-photo-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:13px 0;font-size:11px;color:#777d96}.ft-photo-toolbar button{border:0;background:transparent;color:#6151ab;font-weight:750;cursor:pointer}
.ft-photo-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;min-height:90px}.ft-photo-grid>p{grid-column:1/-1;text-align:center;color:#85899b}.ft-photo-tile{min-width:0;text-align:left;border:2px solid transparent;border-radius:10px;background:#f6f3fa;padding:5px;cursor:pointer}.ft-photo-tile.selected{border-color:#7860dc;background:#ede8fc}.ft-photo-preview{position:relative;aspect-ratio:4/3;display:grid;place-items:center;overflow:hidden;border-radius:7px;background:#e6e0ec;color:#85839a}.ft-photo-preview img{height:100%;width:100%;object-fit:cover}.ft-photo-coverflag{position:absolute;top:5px;left:5px;padding:3px 7px;border-radius:8px;color:#fff;background:#5c4caa;font-size:9px}
.ft-photo-name{display:flex;gap:6px;align-items:center;padding:6px 2px 2px}.ft-photo-name span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:10px}.ft-photo-name .ft-photo-check{font-size:15px;color:#6a54c5;line-height:1}
.ft-photo-message,.ft-photo-warning{padding:10px;border-radius:8px;background:#ede9fa;color:#6351ad;font-size:11px}.ft-photo-message.err,.ft-photo-warning{background:#fff1de;color:#9a6116}
.ft-photo-more{display:block;margin:12px auto;padding:8px 13px;border:1px solid #d8d0e5;border-radius:9px;background:#fff;color:#5f4fa9;cursor:pointer}
.ft-photo-manager footer{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-top:16px;margin-top:16px;border-top:1px solid #e9e3f0}.ft-photo-manager footer small{color:#84869b;font-size:10px;max-width:400px}.ft-photo-manager footer>div{display:flex;gap:8px}.ft-photo-manager footer button{min-height:38px;border:1px solid #d8d1e4;border-radius:9px;padding:9px 12px;background:#fff;color:#605682;font-size:11px;font-weight:700;white-space:nowrap}.ft-photo-manager footer button.primary{border:0;color:#fff;background:#624cc2}.ft-photo-manager footer button:disabled{opacity:.5}
@media(max-width:700px){.ft-photo-overlay{padding:10px}.ft-photo-manager{padding:13px}.ft-photo-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.ft-photo-controls{grid-template-columns:1fr}.ft-photo-manager footer{flex-direction:column;align-items:stretch}.ft-photo-manager footer>div button{flex:1}}
`}</style>
 </div>
}
