
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MenuFotografo from "../../MenuFotografo";
import { createClient } from "../../../lib/supabase-client";

type Projeto={id:string;nome:string;descricao:string|null;cliente_id:string|null;criado_em:string;atualizado_em:string};
type Galeria={id:string;titulo:string;projeto_id:string|null;cliente_id:string|null;etapa:string;criado_em:string};
type Cliente={id:string;nome:string};

export default function ProjetosPage(){
 const router=useRouter(),supabase=useMemo(()=>createClient(),[]);
 const[projetos,setProjetos]=useState<Projeto[]>([]),[galerias,setGalerias]=useState<Galeria[]>([]),[clientes,setClientes]=useState<Cliente[]>([]);
 const[carregando,setCarregando]=useState(true),[nome,setNome]=useState(""),[descricao,setDescricao]=useState(""),[aviso,setAviso]=useState(""),[criando,setCriando]=useState(false);

 async function token(){const{data}=await supabase.auth.getSession();return data.session?.access_token||""}
 async function carregar(){
  setCarregando(true);const{data:auth}=await supabase.auth.getUser();if(!auth.user){router.replace("/login");return}
  const[p,g,c]=await Promise.all([
   supabase.from("galeria_projetos").select("id,nome,descricao,cliente_id,criado_em,atualizado_em").eq("user_id",auth.user.id).order("atualizado_em",{ascending:false}),
   supabase.from("galerias").select("id,titulo,projeto_id,cliente_id,etapa,criado_em").eq("user_id",auth.user.id).order("criado_em",{ascending:false}),
   supabase.from("clientes").select("id,nome").eq("user_id",auth.user.id).order("nome"),
  ]);
  setProjetos((p.data??[]) as Projeto[]);setGalerias((g.data??[]) as Galeria[]);setClientes((c.data??[]) as Cliente[]);setCarregando(false);
 }
 useEffect(()=>{void carregar()},[]);

 async function criar(){
  if(!nome.trim()||criando)return;setCriando(true);setAviso("");
  try{const access=await token();const r=await fetch("/api/galeria/workspace",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify({acao:"criar_projeto",nome:nome.trim(),descricao:descricao.trim()||null})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Não foi possível criar o projeto.");setNome("");setDescricao("");setAviso("Projeto criado.");await carregar()}catch(e){setAviso(e instanceof Error?e.message:"Não foi possível criar o projeto.")}finally{setCriando(false)}
 }
 async function excluir(id:string){
  if(!window.confirm("Excluir este projeto? As galerias continuarão existindo e ficarão sem projeto."))return;
  try{const access=await token();const r=await fetch("/api/galeria/workspace",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify({acao:"excluir_projeto",projetoId:id})});if(!r.ok)throw new Error();setAviso("Projeto excluído. As galerias foram preservadas.");await carregar()}catch{setAviso("Não foi possível excluir o projeto.")}
 }
 function nomeCliente(id:string|null){return clientes.find(c=>c.id===id)?.nome||null}
 function status(etapa:string){return etapa==="entrega"?"Entregue":etapa==="preparando_entrega"?"Preparando entrega":etapa==="selecao_finalizada"?"Seleção finalizada":"Em andamento"}

 if(carregando)return <div className="pj-page"><MenuFotografo/><div className="pj-state">Carregando projetos…</div><style>{css}</style></div>;
 const semProjeto=galerias.filter(g=>!g.projeto_id);
 return <div className="pj-page"><MenuFotografo/><style>{css}</style><main className="pj-shell">
  <header className="pj-head"><div><span>PROJETOS</span><h1>Organize trabalhos, não só galerias</h1><p>Agrupe pré-wedding, making of, cerimônia, festa e outras entregas dentro do mesmo trabalho.</p></div></header>
  {aviso&&<div className="pj-notice">{aviso}</div>}
  <section className="pj-create"><div><strong>Novo projeto</strong><p>Você poderá associar galerias existentes pelo workspace de cada galeria.</p></div><div className="pj-form"><input value={nome} onChange={e=>setNome(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void criar()}} placeholder="Ex: Casamento Ana e João"/><input value={descricao} onChange={e=>setDescricao(e.target.value)} placeholder="Descrição opcional"/><button onClick={()=>void criar()} disabled={criando}>{criando?"Criando…":"Criar projeto"}</button></div></section>
  <section className="pj-grid">
   {projetos.map(p=>{const gs=galerias.filter(g=>g.projeto_id===p.id);return <article className="pj-card" key={p.id}><div className="pj-card-head"><div><span>{gs.length} galeria{gs.length===1?"":"s"}</span><h2>{p.nome}</h2>{p.descricao&&<p>{p.descricao}</p>}</div><button aria-label={"Excluir "+p.nome} onClick={()=>void excluir(p.id)}>×</button></div><div className="pj-galleries">{gs.length?gs.map(g=><button className="pj-gallery" key={g.id} onClick={()=>router.push(`/dashboard/galerias/${g.id}`)}><div><strong>{g.titulo}</strong><p>{nomeCliente(g.cliente_id)||"Sem cliente vinculado"}</p></div><span>{status(g.etapa)} →</span></button>):<div className="pj-empty">Nenhuma galeria associada ainda.</div>}</div></article>})}
   {!projetos.length&&<div className="pj-zero"><strong>Crie seu primeiro projeto</strong><p>Projetos são pastas de trabalho. As galerias continuam independentes e podem ser movidas entre projetos.</p></div>}
  </section>
  {semProjeto.length>0&&<section className="pj-unassigned"><div><span>SEM PROJETO</span><h2>Galerias ainda não agrupadas</h2></div><div className="pj-unassigned-grid">{semProjeto.map(g=><button key={g.id} onClick={()=>router.push(`/dashboard/galerias/${g.id}`)}><div><strong>{g.titulo}</strong><small>{nomeCliente(g.cliente_id)||"Sem cliente"}</small></div><span>Abrir workspace →</span></button>)}</div></section>}
 </main></div>
}

const css=`
.pj-page{min-height:100vh;background:#ece8f4;color:#22263b}.pj-shell{margin-left:236px;padding:38px clamp(24px,4vw,62px) 70px;min-height:100vh;box-sizing:border-box}.pj-state{margin-left:236px;min-height:100vh;display:grid;place-items:center;color:#797c8f}.pj-head span,.pj-unassigned>div>span{font-size:9px;letter-spacing:.14em;font-weight:850;color:#716a92}.pj-head h1{margin:7px 0 6px;font-size:clamp(30px,4vw,46px);letter-spacing:-.045em;font-weight:650}.pj-head p{margin:0;color:#74798e;font-size:12px}.pj-notice{margin:18px 0 0;padding:11px 14px;border:1px solid #d7cee7;border-radius:11px;background:#f8f5fb;color:#62667c;font-size:12px}.pj-create{display:grid;grid-template-columns:1fr 2fr;gap:20px;align-items:center;margin:22px 0;padding:19px;border:1px solid #d8d1e7;border-radius:15px;background:#faf8fd}.pj-create strong{font-size:14px}.pj-create p{margin:4px 0 0;color:#85889a;font-size:10px}.pj-form{display:grid;grid-template-columns:1fr 1fr auto;gap:8px}.pj-form input{min-width:0;min-height:40px;padding:0 11px;border:1px solid #d7d0e3;border-radius:9px;background:#fff;color:#30354a}.pj-form button{border:0;border-radius:9px;padding:0 15px;background:linear-gradient(90deg,#1196fc,#5d0dfa);color:#fff;font-weight:800;cursor:pointer}.pj-form button:disabled{opacity:.55}.pj-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.pj-card,.pj-zero,.pj-unassigned{border:1px solid #d7d0e7;border-radius:16px;background:#faf8fd;box-shadow:0 10px 30px rgba(47,39,74,.035)}.pj-card{padding:18px}.pj-card-head{display:flex;justify-content:space-between;gap:15px}.pj-card-head span{font-size:9px;text-transform:uppercase;letter-spacing:.09em;color:#858899}.pj-card-head h2{margin:5px 0 4px;font-size:19px}.pj-card-head p{margin:0;color:#7b7f90;font-size:10.5px}.pj-card-head>button{width:32px;height:32px;border:1px solid #ddd6e8;border-radius:50%;background:#f5f1f9;color:#8e6570;cursor:pointer}.pj-galleries{margin-top:15px;display:grid;gap:7px}.pj-gallery,.pj-unassigned-grid button{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;padding:11px;border:1px solid #e0d9eb;border-radius:10px;background:#f7f4fa;color:#30354a;cursor:pointer}.pj-gallery:hover,.pj-unassigned-grid button:hover{background:#f0ebf6;border-color:#ccc2df}.pj-gallery strong,.pj-unassigned-grid strong{font-size:11.5px}.pj-gallery p,.pj-unassigned-grid small{display:block;margin:3px 0 0;color:#858899;font-size:9.5px}.pj-gallery>span,.pj-unassigned-grid button>span{color:#716a92;font-size:9.5px;white-space:nowrap}.pj-empty{padding:16px;border:1px dashed #d7cfe5;border-radius:10px;color:#87899a;font-size:10.5px}.pj-zero{grid-column:1/-1;padding:36px;text-align:center}.pj-zero strong{font-size:17px}.pj-zero p{margin:6px auto 0;max-width:520px;color:#7d8092;font-size:11px}.pj-unassigned{margin-top:18px;padding:18px}.pj-unassigned h2{margin:5px 0 14px;font-size:17px}.pj-unassigned-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
@media(max-width:980px){.pj-shell,.pj-state{margin-left:0}.pj-shell{padding-top:88px}}@media(max-width:760px){.pj-shell{padding:82px 13px 50px}.pj-create{grid-template-columns:1fr}.pj-form{grid-template-columns:1fr}.pj-form button{min-height:42px}.pj-grid,.pj-unassigned-grid{grid-template-columns:1fr}}
`;
