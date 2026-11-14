"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MenuFotografo from "../../MenuFotografo";
import FoturaDrawer from "../../components/FoturaDrawer";
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, CloseIcon, FolderIcon as FolderModelIcon, ImageIcon } from "../../components/FoturaIcons";
import { createClient } from "../../../lib/supabase-client";
import { type ModeloProjeto } from "../../../lib/project-templates";

type Projeto={id:string;modelo:ModeloProjeto|null;prova:boolean;nome:string;descricao:string|null;cliente_id:string|null;slug:string|null;capa_galeria_id:string|null;capa_arquivo:string|null;criado_em:string;atualizado_em:string;capaUrl?:string};
type Pasta={id:string;titulo:string;projeto_id:string|null;cliente_id:string|null;etapa:string;criado_em:string};
type Cliente={id:string;nome:string;avatar_path:string|null};
type Filtro="todos"|"sem_pastas"|"modelo_selecao"|"modelo_entrega"|"modelo_pastas"|"aguardando"|"selecao"|"preparando"|"entregue";
type ModoProjetos="lista"|"grade";
type FluxoProjeto="selecao"|"direta";
type EstruturaProjeto="unico"|"galerias";
function statusProjeto(ps:Pasta[],prova:boolean,modelo?:ModeloProjeto|null):{filtro:Filtro;rotulo:string;proxima:string}{
 if(!ps.length)return{filtro:"sem_pastas",rotulo:"Sem galerias",proxima:modelo==="casamento"?"Criar galeria":"Criar primeira galeria"};
 if(ps.every(p=>p.etapa==="entrega"))return{filtro:"entregue",rotulo:"Entregue",proxima:"Abrir projeto"};
 if(ps.some(p=>p.etapa==="preparando_entrega"))return{filtro:"preparando",rotulo:"Preparando entrega",proxima:"Continuar entrega"};
 if(ps.some(p=>p.etapa==="selecao_finalizada"))return{filtro:"selecao",rotulo:"Seleção concluída",proxima:"Preparar entrega"};
 if(prova)return{filtro:"aguardando",rotulo:"Seleção disponível",proxima:"Abrir projeto"};
 return{filtro:"preparando",rotulo:"Entrega direta",proxima:"Abrir projeto"};
}

function SearchIcon(){return <svg className="search-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>}
function FolderIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.3A2.3 2.3 0 0 1 5.8 5h4l1.8 2h6.6a2.3 2.3 0 0 1 2.3 2.3v7.4a2.3 2.3 0 0 1-2.3 2.3H5.8a2.3 2.3 0 0 1-2.3-2.3Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>}
function dataCurta(v:string){const d=new Date(v);return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short",year:"numeric"}).format(d)}

export default function ProjetosPage(){
 const router=useRouter(),supabase=useMemo(()=>createClient(),[]);
 const[uid,setUid]=useState(""),[projetos,setProjetos]=useState<Projeto[]>([]),[pastas,setPastas]=useState<Pasta[]>([]),[clientes,setClientes]=useState<Cliente[]>([]),[carregando,setCarregando]=useState(true);
 const[busca,setBusca]=useState(""),[modo,setModo]=useState<ModoProjetos>("lista"),[filtro,setFiltro]=useState<Filtro>("todos"),[filtroAberto,setFiltroAberto]=useState(false),[projetoDetalhes,setProjetoDetalhes]=useState<string|null>(null);
 const[fotoCliente,setFotoCliente]=useState<{path:string;url:string}|null>(null);
 const[etapaCriacao,setEtapaCriacao]=useState<"fluxo"|"estrutura">("fluxo"),[fluxoProjeto,setFluxoProjeto]=useState<FluxoProjeto|null>(null),[estruturaProjeto,setEstruturaProjeto]=useState<EstruturaProjeto|null>(null);
 const[aviso,setAviso]=useState(""),[avisoErro,setAvisoErro]=useState(false),[modalAberto,setModalAberto]=useState(false),[nome,setNome]=useState(""),[descricao,setDescricao]=useState(""),[clienteId,setClienteId]=useState(""),[criando,setCriando]=useState(false);

 useEffect(()=>{const fora=(e:PointerEvent)=>{const a=e.target;if(!(a instanceof Element)||!a.closest(".filter-wrap"))setFiltroAberto(false)};const tecla=(e:KeyboardEvent)=>{if(e.key==="Escape")setFiltroAberto(false)};document.addEventListener("pointerdown",fora);window.addEventListener("keydown",tecla);return()=>{document.removeEventListener("pointerdown",fora);window.removeEventListener("keydown",tecla)}},[]);
 useEffect(()=>{if(!modalAberto)return;const old=document.body.style.overflow;document.body.style.overflow="hidden";const tecla=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!criando)setModalAberto(false)};window.addEventListener("keydown",tecla);return()=>{window.removeEventListener("keydown",tecla);document.body.style.overflow=old}},[modalAberto,criando]);
 useEffect(()=>{if(new URLSearchParams(window.location.search).get("novo")==="1")setModalAberto(true);try{if(localStorage.getItem("fotura-projetos-modo")==="grade")setModo("grade")}catch{}},[]);
 function mudarModo(v:ModoProjetos){setModo(v);try{localStorage.setItem("fotura-projetos-modo",v)}catch{}}

 async function token(){const{data}=await supabase.auth.getSession();return data.session?.access_token||""}
 async function carregar(){
  setCarregando(true);setAviso("");setAvisoErro(false);
  const{data:auth}=await supabase.auth.getUser();if(!auth.user){router.replace("/login");return}setUid(auth.user.id);
  const[p,g,c]=await Promise.all([
   supabase.from("galeria_projetos").select("id,nome,descricao,cliente_id,slug,capa_galeria_id,capa_arquivo,modelo,prova,criado_em,atualizado_em").eq("user_id",auth.user.id).order("atualizado_em",{ascending:false}),
   supabase.from("galerias").select("id,titulo,projeto_id,cliente_id,etapa,criado_em").eq("user_id",auth.user.id).order("criado_em",{ascending:false}),
   supabase.from("clientes").select("id,nome,avatar_path").eq("user_id",auth.user.id).order("nome"),
  ]);
  if(p.error||g.error||c.error){setAvisoErro(true);setAviso("Não foi possível carregar seus projetos agora.");setCarregando(false);return}
  const lista=(p.data??[]) as Projeto[];
  const capas=lista.filter(x=>x.capa_galeria_id&&x.capa_arquivo);
  const thumbs=capas.map(x=>`${auth.user!.id}/${x.capa_galeria_id}/thumbs/${x.capa_arquivo}`);
  const mapa=new Map<string,string>();
  const {data:session}=await supabase.auth.getSession();
  const access=session.session?.access_token;
  if(access){
   for(let i=0;i<thumbs.length;i+=200){
    const response=await fetch("/api/projetos/preview-urls",{
     method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+access},
     cache:"no-store",body:JSON.stringify({paths:thumbs.slice(i,i+200)}),
    });
    if(!response.ok){setAvisoErro(true);setAviso("Não foi possível carregar as capas dos projetos.");break}
    const signed=await response.json() as {urls?:Record<string,string>};
    for(const [path,url] of Object.entries(signed.urls??{}))mapa.set(path,url);
   }
  }
  setProjetos(lista.map(x=>({...x,capaUrl:x.capa_galeria_id&&x.capa_arquivo?mapa.get(`${auth.user!.id}/${x.capa_galeria_id}/thumbs/${x.capa_arquivo}`):undefined})));
  setPastas((g.data??[]) as Pasta[]);const listaClientes=(c.data??[]) as Cliente[];setClientes(listaClientes);const query=new URLSearchParams(window.location.search);const preselected=query.get("cliente");if(query.get("novo")==="1"&&preselected&&listaClientes.some(x=>x.id===preselected))setClienteId(preselected);setCarregando(false);
 }
 useEffect(()=>{void carregar()},[]);

 function abrirModal(){setEtapaCriacao("fluxo");setFluxoProjeto(null);setEstruturaProjeto(null);setNome("");setDescricao("");setClienteId("");setAviso("");setAvisoErro(false);setModalAberto(true)}
 function fecharModal(){if(criando)return;setModalAberto(false);setEtapaCriacao("fluxo");setFluxoProjeto(null);setEstruturaProjeto(null);setNome("");setDescricao("");setClienteId("");if(new URLSearchParams(window.location.search).get("novo")==="1")window.history.replaceState(window.history.state,"","/dashboard/projetos")}
 async function criar(e:FormEvent){
  e.preventDefault();if(!nome.trim()||criando||!fluxoProjeto||!estruturaProjeto||etapaCriacao!=="estrutura")return;
  const modelo:ModeloProjeto=estruturaProjeto==="galerias"?"casamento":fluxoProjeto==="selecao"?"ensaio":"entrega";
  setCriando(true);setAviso("");setAvisoErro(false);
  try{const access=await token();if(!access)throw new Error("Sua sessão expirou.");const r=await fetch("/api/projeto/workspace",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify({acao:"criar_projeto",nome:nome.trim(),descricao:descricao.trim()||null,clienteId:clienteId||null,modelo,prova:fluxoProjeto==="selecao"})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Não foi possível criar o projeto.");fecharModal();router.push(`/dashboard/projetos/${d.projeto.id}`)}catch(e){setAvisoErro(true);setAviso(e instanceof Error?e.message:"Não foi possível criar o projeto.")}finally{setCriando(false)}
 }
 function clienteNome(id:string|null){return clientes.find(c=>c.id===id)?.nome||"Sem cliente vinculado"}
 function status(etapa:string){return etapa==="entrega"?"Entregue":etapa==="preparando_entrega"?"Preparando entrega":etapa==="selecao_finalizada"?"Seleção finalizada":"Em andamento"}

 const projetoSelecionado=projetos.find(p=>p.id===projetoDetalhes)||null;
 const clienteSelecionado=clientes.find(c=>c.id===projetoSelecionado?.cliente_id)||null;
 const avatarPath=projetoSelecionado&&clienteSelecionado?.avatar_path?clienteSelecionado.avatar_path:null;
 useEffect(()=>{
  let ativo=true;
  setFotoCliente(null);
  if(!avatarPath)return()=>{ativo=false};
  void (async()=>{
   const {data:session}=await supabase.auth.getSession();
   const access=session.session?.access_token;if(!access||!ativo)return;
   const response=await fetch("/api/clientes/avatar-urls",{
    method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+access},
    cache:"no-store",body:JSON.stringify({paths:[avatarPath]}),
   });
   if(!response.ok||!ativo)return;
   const signed=await response.json() as {urls?:Record<string,string>};
   const url=signed.urls?.[avatarPath];
   if(url&&ativo)setFotoCliente({path:avatarPath,url});
  })().catch(()=>{if(ativo)setFotoCliente(null)});
  return()=>{ativo=false};
 },[supabase,avatarPath,projetoDetalhes]);
 const pastasDoProjeto=projetoSelecionado?pastas.filter(g=>g.projeto_id===projetoSelecionado.id):[];
 const estadoSelecionado=projetoSelecionado?statusProjeto(pastasDoProjeto,projetoSelecionado.prova,projetoSelecionado.modelo):null;
 const totalPastas=pastas.length,comPastas=projetos.filter(p=>pastas.some(g=>g.projeto_id===p.id)).length;
 const visiveis=useMemo(()=>{const termo=busca.trim().toLocaleLowerCase("pt-BR");return projetos.filter(p=>{const ps=pastas.filter(g=>g.projeto_id===p.id),okFiltro=filtro==="todos"||(filtro==="modelo_selecao"&&p.prova)||(filtro==="modelo_entrega"&&!p.prova)||(filtro==="modelo_pastas"&&p.modelo==="casamento")||filtro===statusProjeto(ps,p.prova,p.modelo).filtro,okBusca=!termo||p.nome.toLocaleLowerCase("pt-BR").includes(termo)||(p.descricao??"").toLocaleLowerCase("pt-BR").includes(termo)||clienteNome(p.cliente_id).toLocaleLowerCase("pt-BR").includes(termo)||ps.some(g=>g.titulo.toLocaleLowerCase("pt-BR").includes(termo));return okFiltro&&okBusca})},[busca,filtro,pastas,projetos,clientes]);

 return <div className="dash mf-shift projects-page"><MenuFotografo/><style>{css}</style><main className="dash-body">
  <header className="top"><div><div className="ey">PROJETOS</div><h1 className="h1">Seus trabalhos em um só lugar</h1><p className="sub">Cada projeto reúne suas galerias, seleção, entrega e um único link para o cliente.</p></div><button className="btn" onClick={abrirModal}>+ Novo projeto</button></header>
  <section className="stats"><div className="stat"><strong>{projetos.length}</strong><span>Projetos</span></div><div className="stat"><strong>{comPastas}</strong><span>Projetos com galerias</span></div><div className="stat"><strong>{totalPastas}</strong><span>Galerias criadas</span></div></section>
  <div className="toolbar"><label className="search-box"><SearchIcon/><input className="search" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar projeto, cliente ou galeria" aria-label="Buscar projetos"/></label><div className="filter-wrap"><button type="button" className={"filter-trigger"+(filtroAberto?" open":"")} onClick={()=>setFiltroAberto(v=>!v)}>Filtrar por <span><ChevronDownIcon size={14}/></span></button>{filtroAberto&&<div className="filter-menu">{([["todos","Todos"],["aguardando","Aguardando cliente"],["selecao","Seleção concluída"],["preparando","Preparando entrega"],["entregue","Entregues"],["modelo_selecao","Seleção de fotos"],["modelo_entrega","Entrega direta"],["modelo_pastas","Projeto com galerias"]] as [Filtro,string][]).map(([v,l])=><button key={v} className={"filter-option"+(filtro===v?" on":"")} onClick={()=>{setFiltro(v);setFiltroAberto(false)}}><span>{l}</span>{filtro===v&&<b><CheckIcon size={14}/></b>}</button>)}</div>}</div><div className="view-toggle" role="group" aria-label="Visualização dos projetos"><button type="button" className={modo==="lista"?"selected":""} aria-pressed={modo==="lista"} onClick={()=>mudarModo("lista")}>☰ Lista</button><button type="button" className={modo==="grade"?"selected":""} aria-pressed={modo==="grade"} onClick={()=>mudarModo("grade")}>▦ Grade</button></div></div>
  {aviso&&<div className={"notice"+(avisoErro?" err":"")}><span>{aviso}</span>{avisoErro&&<button type="button" onClick={()=>void carregar()} disabled={carregando}>{carregando?"Tentando…":"Tentar novamente"}</button>}</div>}
  <section className="panel list-panel">{carregando?<div className="empty">Carregando projetos…</div>:!visiveis.length?<div className="empty-first"><strong>{projetos.length?"Nenhum projeto encontrado":"Crie seu primeiro projeto"}</strong><span>{projetos.length?"Ajuste a busca ou o filtro.":"Escolha como o cliente recebe as fotos e, depois, como organizá-las."}</span>{!projetos.length&&<button className="btn" onClick={abrirModal}>Criar projeto</button>}</div>:<div className={"project-list "+(modo==="grade"?"project-grid":"")}>{visiveis.map(p=>{const ps=pastas.filter(g=>g.projeto_id===p.id),estado=statusProjeto(ps,p.prova,p.modelo);return <article className="project-card" key={p.id}>
   <div className="project-main"><div className="project-cover">{p.capaUrl?<img src={p.capaUrl} alt=""/>:<FolderIcon/>}</div><div className="project-copy"><div className="project-title-line"><h2>{p.nome}</h2><span className="count-badge">{p.modelo==="ensaio"||p.modelo==="entrega"?"Galeria única":`${ps.length} ${ps.length===1?"galeria":"galerias"}`}</span><span className={"project-stage "+estado.filtro}>{estado.rotulo}</span></div><div className="project-meta"><span>{clienteNome(p.cliente_id)}</span><span>Atualizado {dataCurta(p.atualizado_em)}</span></div></div><div className="project-actions"><button className="mini primary-mini" type="button" onClick={()=>router.push(`/dashboard/projetos/${p.id}`)}>{estado.proxima}</button><button className="mini" type="button" onClick={()=>setProjetoDetalhes(p.id)}>Detalhes</button></div></div>
  </article>})}</div>}</section>
 </main>
 {projetoSelecionado&&estadoSelecionado&&
  <FoturaDrawer title="Visão rápida do projeto" onClose={()=>setProjetoDetalhes(null)}
    footer={<button type="button" className="ft-drawer-button primary" onClick={()=>router.push("/dashboard/projetos/"+projetoSelecionado.id)}>Abrir projeto completo <ArrowRightIcon size={15}/></button>}>
    {projetoSelecionado.capaUrl?<img src={projetoSelecionado.capaUrl} alt="" className="ft-drawer-cover"/>:<div className="ft-drawer-cover-placeholder">Projeto fotográfico</div>}
    <h3 className="ft-drawer-name">{projetoSelecionado.nome}</h3>
    <div className="ft-drawer-badges">
      <span className="ft-drawer-badge">{estadoSelecionado.rotulo}</span>
      <span className="ft-drawer-badge">{projetoSelecionado.modelo==="ensaio"||projetoSelecionado.modelo==="entrega"?"Galeria única":`${pastasDoProjeto.length} ${pastasDoProjeto.length===1?"galeria":"galerias"}`}</span>
      <span className="ft-drawer-badge">{projetoSelecionado.prova?"Seleção de fotos":"Entrega direta"}</span>
    </div>
    {!!projetoSelecionado.descricao&&<p className="ft-drawer-description">{projetoSelecionado.descricao}</p>}
    <section className="ft-drawer-section">
      <h3>Informações</h3>
      <div className="ft-drawer-field"><strong>Cliente</strong>
        <div className="ft-drawer-client">
          {clienteSelecionado&&<span className="ft-drawer-avatar">
            {avatarPath&&fotoCliente?.path===avatarPath
              ?<img src={fotoCliente.url} alt={"Foto de "+clienteSelecionado.nome} referrerPolicy="no-referrer"/>
              :<span aria-hidden="true">{clienteSelecionado.nome.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]?.toLocaleUpperCase("pt-BR")).join("")||"C"}</span>}
          </span>}
          <span>{clienteNome(projetoSelecionado.cliente_id)}</span>
        </div>
      </div>
      <div className="ft-drawer-field"><strong>Última atualização</strong>{dataCurta(projetoSelecionado.atualizado_em)}</div>
      <div className="ft-drawer-field"><strong>Criado em</strong>{dataCurta(projetoSelecionado.criado_em)}</div>
    </section>
    <section className="ft-drawer-section">
      <h3>{projetoSelecionado.modelo==="ensaio"||projetoSelecionado.modelo==="entrega"?"Galeria do projeto":`Galerias do projeto (${pastasDoProjeto.length})`}</h3>
      {pastasDoProjeto.length?
        <div className="ft-drawer-list">
          {pastasDoProjeto.map(pasta=><button type="button" className="ft-drawer-item" key={pasta.id} onClick={()=>router.push("/dashboard/projetos/"+projetoSelecionado.id)}>
            <span><strong>{pasta.titulo}</strong><small>{status(pasta.etapa)} · Criada em {dataCurta(pasta.criado_em)}</small></span>
            <ArrowRightIcon size={16}/>
          </button>)}
        </div>:
        <p className="ft-drawer-note">Nenhuma galeria cadastrada. Abra o projeto para começar.</p>
      }
    </section>
  </FoturaDrawer>}

 {modalAberto&&<div className="modal" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)fecharModal()}}>
   <form className="panel create-panel" onSubmit={criar} aria-labelledby="create-project-title">
     <div className="modal-head">
       <div className="modal-heading">
         <span>NOVO PROJETO</span>
         <h2 id="create-project-title">Crie seu próximo projeto</h2>
         <p>Organize suas fotos e prepare a experiência do cliente.</p>
       </div>
       <button type="button" aria-label="Fechar" onClick={fecharModal} disabled={criando}><CloseIcon size={18}/></button>
     </div>
     <div className="create-body">
       <div className="create-fields-row">
         <label className="field">Nome do projeto<input autoFocus value={nome} onChange={e=>setNome(e.target.value)} placeholder="Ex.: Ensaio de família" required maxLength={120}/></label>
         <label className="field">Cliente <small>opcional</small><select value={clienteId} onChange={e=>setClienteId(e.target.value)}><option value="">Sem cliente vinculado</option>{clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
       </div>
       <fieldset className="project-model-field">
          <legend aria-live="polite">{etapaCriacao==="fluxo"?"Como será a experiência do cliente?":"Como deseja organizar as fotografias?"}</legend>
          <div className="project-model-progress" aria-label={etapaCriacao==="fluxo"?"Etapa 1 de 2":"Etapa 2 de 2"}>
            <span className={etapaCriacao==="fluxo"?"current":"done"}/><span className={etapaCriacao==="estrutura"?"current":""}/>
            <small>{etapaCriacao==="fluxo"?"1 de 2 · Tipo de entrega":"2 de 2 · Organização do projeto"}</small>
          </div>
          <div className="project-model-slot">
            {etapaCriacao==="fluxo"?<div className="project-model-step" key="fluxo">
              <div className="project-model-list">
                {(["selecao","direta"] as FluxoProjeto[]).map(valor=>
                  <label key={valor} className={"project-model-choice"+(fluxoProjeto===valor?" selected":"")}>
                    <input type="radio" name="fluxo-projeto" value={valor} checked={fluxoProjeto===valor}
                      onChange={()=>{setFluxoProjeto(valor);setEstruturaProjeto(null);setEtapaCriacao("estrutura")}} disabled={criando}/>
                    <span className="project-model-top"><span className="project-model-symbol" aria-hidden="true">{valor==="selecao"?<CheckIcon size={19}/>:<ImageIcon size={19}/>}</span><span className="project-model-check" aria-hidden="true">{fluxoProjeto===valor&&<CheckIcon size={13}/>}</span></span>
                    <span className="project-model-copy"><strong>{valor==="selecao"?"Seleção pelo cliente":"Entrega direta"}</strong><small>{valor==="selecao"?"O cliente escolhe as favoritas antes de você entregar as fotos finais.":"Compartilhe as fotografias prontas, sem solicitar uma seleção."}</small></span>
                  </label>)}
              </div>
              <p className="project-model-hint">Primeiro, escolha se o cliente vai selecionar fotos ou recebê-las prontas.</p>
            </div>:<div className="project-model-step" key="estrutura">
              <div className="project-model-list">
                {(["unico","galerias"] as EstruturaProjeto[]).map(valor=>
                  <label key={valor} className={"project-model-choice"+(estruturaProjeto===valor?" selected":"")}>
                    <input type="radio" name="estrutura-projeto" value={valor} checked={estruturaProjeto===valor} onChange={()=>setEstruturaProjeto(valor)} disabled={criando}/>
                    <span className="project-model-top"><span className="project-model-symbol" aria-hidden="true">{valor==="unico"?<ImageIcon size={19}/>:<FolderModelIcon size={19}/>}</span><span className="project-model-check" aria-hidden="true">{estruturaProjeto===valor&&<CheckIcon size={13}/>}</span></span>
                    <span className="project-model-copy"><strong>{valor==="unico"?"Galeria única":"Projeto com galerias"}</strong><small>{valor==="unico"?"Todas as fotos em uma galeria, com acesso direto ao cliente.":"Separe por momentos ou temas e compartilhe tudo em um único link."}</small></span>
                  </label>)}
              </div>
              <div className="project-model-step-footer">
                <button className="project-model-back" type="button" disabled={criando} onClick={()=>{setEtapaCriacao("fluxo");setEstruturaProjeto(null)}}>← Alterar tipo de entrega</button>
                <p className="project-model-hint">{estruturaProjeto==="galerias"?"Você poderá criar quantas galerias precisar.":estruturaProjeto==="unico"?"A galeria será preparada automaticamente.":"Escolha a organização para concluir o projeto."}</p>
              </div>
            </div>}
          </div>
        </fieldset>
       <label className="field create-description">Descrição <small>opcional</small><textarea rows={2} value={descricao} onChange={e=>setDescricao(e.target.value)} placeholder="Detalhes do trabalho (opcional)"/></label>
     </div>
     <div className="modal-actions">
       <span className="create-footer-note">Os detalhes podem ser ajustados depois.</span>
       <div className="create-footer-buttons">
         <button type="button" className="ghost" onClick={fecharModal} disabled={criando}>Cancelar</button>
         <button className="btn" type="submit" disabled={!nome.trim()||criando||!fluxoProjeto||!estruturaProjeto||etapaCriacao!=="estrutura"}>{criando?"Criando…":"Criar projeto"}<ArrowRightIcon size={15}/></button>
       </div>
     </div>
   </form>
 </div>}
  </div>
}

const css=`
.dash{min-height:100vh;background:linear-gradient(180deg,var(--ft-bg-start),var(--ft-bg-end));color:var(--ft-text)}.dash-body{max-width:1120px;margin:0 auto;padding:40px 40px 80px}.top{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:22px}.ey{font-size:12px;font-weight:600;letter-spacing:2px;color:#6f76a0}.h1{font-size:30px;margin:8px 0 0;letter-spacing:-.5px}.sub{font-size:13px;color:var(--ft-text-muted);margin:6px 0 0}.btn{min-height:38px;border:0;border-radius:10px;padding:0 14px;background:linear-gradient(90deg,var(--ft-brand-blue),var(--ft-brand-purple));color:#fff;font:700 12px inherit;cursor:pointer}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}.stat{padding:15px 17px;border:1px solid var(--ft-border-soft);border-radius:14px;background:linear-gradient(180deg,var(--ft-surface),var(--ft-surface-muted))}.stat strong{display:block;font-size:23px}.stat span{display:block;margin-top:5px;color:#777d98;font-size:var(--ft-font-sm)}.toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px}.search-box{position:relative;display:inline-flex;align-items:center;width:min(320px,100%);flex:0 1 320px}.search-icon{position:absolute;left:10px;width:14px;color:#747a96}.search{width:100%;height:34px;box-sizing:border-box;padding:7px 10px 7px 31px;border:1px solid var(--ft-border);border-radius:var(--ft-radius-control);background:var(--ft-surface-muted);color:var(--ft-text);font-size:12px;outline:none}.filter-wrap{position:relative}.filter-trigger{height:34px;border:1px solid var(--ft-border);border-radius:var(--ft-radius-control);background:var(--ft-surface);color:#555b73;padding:0 11px;font-size:var(--ft-font-sm);font-weight:700;font-family:inherit}.filter-menu{position:absolute;top:40px;left:0;z-index:30;min-width:150px;padding:5px;border:1px solid var(--ft-border);border-radius:10px;background:var(--ft-surface);box-shadow:0 12px 28px rgba(49,42,79,.13)}.filter-option{width:100%;display:flex;justify-content:space-between;border:0;border-radius:var(--ft-radius-control);background:transparent;padding:8px 9px;color:#555b73;font:600 12px inherit;text-align:left}.filter-option.on,.filter-option:hover{background:#ECE7F6;color:var(--ft-accent-ink)}.panel{border:1px solid var(--ft-border-soft);border-radius:16px;background:linear-gradient(180deg,var(--ft-surface),var(--ft-surface-muted))}.list-panel{padding:14px}.project-list{display:grid;gap:9px}.project-card{padding:11px 12px;border:1px solid #DDD7E8;border-radius:var(--ft-radius-card);background:#FCFAFE;box-shadow:0 7px 20px rgba(65,52,111,.04)}.project-main{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:12px;align-items:center}.project-cover{width:64px;height:48px;border:1px solid #D8D0EA;border-radius:10px;overflow:hidden;background:#F2EEF8;color:#655B94;display:grid;place-items:center}.project-cover img{width:100%;height:100%;object-fit:cover}.project-cover svg{width:21px;height:21px}.project-title-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.project-title-line h2{margin:0;font-size:14px}.count-badge{padding:4px 7px;border:1px solid #E0DAEB;border-radius:999px;background:#F6F2FA;color:#6A7087;font-size:var(--ft-font-xs);font-weight:700}.project-copy>p{margin:4px 0 0;color:#777D91;font-size:var(--ft-font-sm)}.project-meta{display:flex;gap:9px;margin-top:5px;color:#8A8D9E;font-size:var(--ft-font-xs)}.project-meta span+span:before{content:"·";margin-right:9px}.project-actions{display:flex;gap:6px}.mini{height:32px;border:1px solid var(--ft-border);border-radius:var(--ft-radius-control);background:var(--ft-surface);color:#5F667E;padding:0 9px;font-size:var(--ft-font-xs);font-weight:700;font-family:inherit;cursor:pointer}.primary-mini{border-color:#cbbfe2;color:var(--ft-accent-ink);background:#f0ebf8}.mini.danger{color:var(--ft-danger)}.folder-list{display:grid;gap:5px;margin-top:10px;padding-top:10px;border-top:1px solid #E7E2EE}.folder-row{display:flex;justify-content:space-between;align-items:center;width:100%;padding:8px 9px;border:1px solid #e3ddea;border-radius:var(--ft-radius-control);background:var(--ft-surface-soft);color:#30354a;text-align:left}.folder-row strong{display:block;font-size:var(--ft-font-sm)}.folder-row div span{display:block;margin-top:2px;color:#858899;font-size:var(--ft-font-xs)}.folder-row>span{display:inline-flex;align-items:center;gap:5px;color:#716A92;font-size:var(--ft-font-xs)}.notice{margin-bottom:14px;padding:10px 12px;border:1px solid rgba(143,227,176,.18);border-radius:10px;background:rgba(143,227,176,.06);color:var(--ft-success);font-size:var(--ft-font-sm);display:flex;align-items:center;justify-content:space-between;gap:12px}.notice.err{color:var(--ft-danger);border-color:#EACFD2;background:#F8EDEE}.notice button{flex:none;min-height:32px;border:1px solid currentColor;border-radius:var(--ft-radius-control);background:transparent;color:inherit;padding:0 10px;font:700 var(--ft-font-xs) inherit;cursor:pointer}.notice button:disabled{opacity:.55;cursor:default}.empty,.empty-first{padding:46px 16px;text-align:center;color:var(--ft-text-muted)}.empty-first{display:grid;justify-items:center;gap:8px}.empty-first strong{color:#31364B;font-size:16px}.empty-first span{font-size:var(--ft-font-sm)}
.modal{position:fixed;inset:0;z-index:120;display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;background:rgba(22,20,35,.52);backdrop-filter:blur(9px)}
.create-panel{display:flex;flex-direction:column;width:min(748px,100%);max-height:min(92dvh,760px);overflow:hidden;box-sizing:border-box;padding:0;border:1px solid #e6e1ec;border-radius:22px;background:#fff;box-shadow:0 32px 90px rgba(30,24,56,.17),0 3px 14px rgba(34,29,60,.06);color:#293046}
.create-panel .modal-head{display:flex;align-items:flex-start;justify-content:space-between;flex:none;gap:22px;padding:27px 30px 17px;margin:0;border-bottom:1px solid #efecf3}
.create-panel .modal-heading{min-width:0}
.create-panel .modal-head span{display:block;font-size:10px;font-weight:800;letter-spacing:1.7px;color:#8b7cb5}
.create-panel .modal-head h2{margin:6px 0 4px;font-size:24px;line-height:1.18;letter-spacing:-.65px;font-weight:800;color:#23283a}
.create-panel .modal-head p{margin:0;font-size:12px;line-height:1.5;color:#878aa0}
.create-panel .modal-head>button{width:33px;height:33px;flex:none;display:grid;place-items:center;border:1px solid #e8e3ef;border-radius:50%;background:#f8f6fb;color:#77718c;cursor:pointer;transition:background .2s,color .2s}
.create-panel .modal-head>button:hover{background:#eeeaf6;color:#4e446f}
.create-panel .create-body{min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#d7cfe8 transparent;padding:8px 30px 22px}
.create-panel .create-fields-row{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);align-items:end;gap:14px}
.create-panel .field{display:block;margin-top:14px;color:#656b82;font-size:11px;font-weight:750;line-height:1.35}
.create-panel .field small{display:inline;margin-left:3px;color:#a3a1ae;font-size:10px;font-weight:500}
.create-panel .field input,.create-panel .field select,.create-panel .field textarea{display:block;width:100%;box-sizing:border-box;margin-top:7px;border:1px solid #e4e2e9;border-radius:11px;background:#fdfcff;color:#30354b;font-family:inherit;font-size:13px;font-weight:500;outline:none;transition:border-color .2s,box-shadow .2s}
.create-panel .field input,.create-panel .field select{height:44px;padding:0 13px}
.create-panel .field textarea{min-height:68px;max-height:180px;padding:12px 13px;resize:vertical;line-height:1.45}
.create-panel .field input:focus,.create-panel .field select:focus,.create-panel .field textarea:focus{border-color:#a99ad0;box-shadow:0 0 0 3px rgba(156,138,201,.12)}
.create-panel .field input::placeholder,.create-panel .field textarea::placeholder{color:#a2a5b5}
.create-panel .project-model-field{min-width:0;border:0;padding:0;margin:22px 0 0}
.create-panel .project-model-field legend{padding:0;color:#424862;font-size:12px;font-weight:800}
.create-panel .project-model-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}
.create-panel .project-model-choice{position:relative;display:flex;flex-direction:column;gap:14px;min-width:0;min-height:153px;box-sizing:border-box;padding:16px 15px 15px;border:1px solid #e5e0ec;border-radius:15px;background:#fdfcfe;cursor:pointer;transition:background .2s,border-color .2s,box-shadow .2s,transform .2s}
.create-panel .project-model-choice:hover{border-color:#c7b9e4;background:#faf8fd;transform:translateY(-1px)}
.create-panel .project-model-choice.selected{border-color:#aa96d8;background:#f7f3fd;box-shadow:inset 0 0 0 1px rgba(158,137,213,.12)}
.create-panel .project-model-choice:has(input:focus-visible){outline:2px solid #826cc4;outline-offset:3px}
.create-panel .project-model-choice input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.create-panel .project-model-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.create-panel .project-model-symbol{display:grid;place-items:center;flex:none;width:38px;height:38px;border-radius:11px;background:#f0edf7;color:#8f7bb9}
.create-panel .project-model-choice.selected .project-model-symbol{background:#ebe3fb;color:#7257b4}
.create-panel .project-model-check{display:grid;place-items:center;flex:none;width:18px;height:18px;border:1px solid #dfd9eb;border-radius:50%;background:#fff;color:#fff}
.create-panel .project-model-choice.selected .project-model-check{border-color:#8064bc;background:#8064bc}
.create-panel .project-model-copy{display:grid;gap:6px}
.create-panel .project-model-copy strong{font-size:13px;line-height:1.25;color:#30354c;font-weight:800}
.create-panel .project-model-copy small{font-size:11px;line-height:1.45;color:#85889b;font-weight:500}
.create-panel .project-model-hint{display:flex;align-items:center;gap:7px;margin:10px 2px 0;font-size:11px;line-height:1.4;color:#7b7296}
.create-panel .project-model-hint svg{flex:none;color:#8b70c2}
.create-panel .create-description{margin-top:18px}
.create-panel .modal-actions{display:flex;align-items:center;justify-content:space-between;gap:18px;flex:none;margin:0;padding:17px 30px 19px;border-top:1px solid #efecf3;background:#fff}
.create-panel .create-footer-note{font-size:11px;line-height:1.4;color:#9899a7}
.create-panel .create-footer-buttons{display:flex;align-items:center;gap:9px;margin-left:auto}
.create-panel .create-footer-buttons button{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:41px;border-radius:10px;padding:0 16px;font-size:12px;font-weight:750;font-family:inherit;cursor:pointer;white-space:nowrap}
.create-panel .create-footer-buttons .ghost{background:#f5f3f9;border:1px solid #e9e4f0;color:#68657a}
.create-panel .create-footer-buttons .btn{border:1px solid transparent;background:linear-gradient(105deg,#237cf3 0%,#6840db 100%);color:#fff;box-shadow:0 6px 16px rgba(88,76,191,.23);font-weight:800;opacity:1;transition:background .18s,box-shadow .18s,transform .18s}
.create-panel .create-footer-buttons .btn:hover:not(:disabled){background:linear-gradient(105deg,#126ce5 0%,#572dc9 100%);box-shadow:0 8px 20px rgba(88,76,191,.31);transform:translateY(-1px)}
.create-panel .create-footer-buttons .btn:active:not(:disabled){transform:translateY(0);box-shadow:0 3px 9px rgba(88,76,191,.18)}
.create-panel .create-footer-buttons .btn:focus-visible{outline:3px solid #c3b3fa;outline-offset:3px}
.create-panel .create-footer-buttons button:disabled{cursor:not-allowed}
.create-panel .create-footer-buttons .ghost:disabled{opacity:.55}
.create-panel .create-footer-buttons .btn:disabled{opacity:1;background:#d5d8e2;color:#767a8c;border-color:#d5d8e2;box-shadow:none;transform:none}
@media(max-width:670px){
 .modal{padding:12px}
 .create-panel{max-height:calc(100dvh - 24px);border-radius:18px}
 .create-panel .modal-head{padding:22px 21px 16px}
 .create-panel .modal-head h2{font-size:21px}
 .create-panel .create-body{padding:5px 21px 20px}
 .create-panel .create-fields-row{grid-template-columns:1fr;gap:0}
 .create-panel .project-model-list{grid-template-columns:1fr;gap:8px}
 .create-panel .project-model-choice{flex-direction:row;align-items:center;gap:12px;min-height:76px;padding:11px 13px}
 .create-panel .project-model-top{display:contents}
 .create-panel .project-model-symbol{width:36px;height:36px;order:0}
 .create-panel .project-model-copy{flex:1;order:1;gap:3px}
 .create-panel .project-model-check{order:2}
 .create-panel .project-model-field{margin-top:19px}
 .create-panel .modal-actions{padding:13px 21px 16px}
 .create-panel .create-footer-note{display:none}
 .create-panel .create-footer-buttons{width:100%}
 .create-panel .create-footer-buttons button{flex:1}
}
@media(max-width:380px){
 .create-panel .modal-head{padding:19px 15px 13px}
 .create-panel .create-body{padding:4px 15px 16px}
 .create-panel .modal-actions{padding:12px 15px 15px}
 .create-panel .modal-head h2{font-size:19px}
}
.view-toggle{display:inline-flex;align-items:center;padding:3px;border:1px solid #DDD7E8;border-radius:10px;background:#F4F0FA;gap:2px;margin-left:auto}.view-toggle button{border:0;border-radius:7px;padding:7px 11px;background:transparent;color:#6A6D81;font:700 11px inherit;cursor:pointer}.view-toggle button.selected{background:#FFF;box-shadow:0 1px 5px #42346712;color:#5545A4}.project-stage{display:inline-flex;align-items:center;border-radius:999px;padding:4px 7px;background:#EEE9F6;color:#635890;font-size:10px;font-weight:700}.project-stage.entregue{background:#E8F4EF;color:#247451}.project-stage.preparando,.project-stage.selecao{background:#FFF0D9;color:#98671A}.project-stage.aguardando{background:#EAF1FC;color:#3567A0}.project-list.project-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.project-grid .project-card{padding:12px}.project-grid .project-main{grid-template-columns:96px minmax(0,1fr);align-items:start}.project-grid .project-cover{width:96px;height:89px}.project-grid .project-actions{grid-column:1/-1;justify-content:flex-start}.project-grid .project-meta{flex-wrap:wrap}.project-grid .project-title-line{align-items:flex-start}.project-grid .folder-list{max-height:200px;overflow:auto}@media(max-width:760px){.project-list.project-grid{grid-template-columns:1fr}.view-toggle{margin-left:0}.project-grid .project-main{grid-template-columns:64px minmax(0,1fr)}.project-grid .project-cover{width:64px;height:60px}}
@media(max-width:900px){.top{align-items:flex-start;flex-direction:column}.project-main{grid-template-columns:58px 1fr}.project-cover{width:58px;height:46px}.project-actions{grid-column:1/-1;justify-content:flex-end}}
@media(max-width:700px){.dash-body{padding:76px 14px 60px}.h1{font-size:24px}.stats{display:none}.toolbar,.search-box{width:100%}.project-card{padding:10px}.project-main{grid-template-columns:52px 1fr;gap:9px}.project-cover{width:52px;height:42px}.project-actions{justify-content:flex-start;flex-wrap:wrap}.project-meta{display:grid;gap:3px}.project-meta span+span:before{display:none}.folder-row{align-items:flex-start}.modal-actions{display:grid;grid-template-columns:1fr 1fr}.modal-actions>*{width:100%}}
.create-panel .project-model-list{grid-template-columns:repeat(2,minmax(0,1fr))}
.create-panel .project-model-field{min-height:245px}
.create-panel .project-model-progress{display:flex;align-items:center;gap:5px;margin:10px 0 0}
.create-panel .project-model-progress>span{height:4px;width:28px;border-radius:99px;background:#e9e4f2}
.create-panel .project-model-progress>span.current{background:#8064bc}
.create-panel .project-model-progress>span.done{background:#b7a4df}
.create-panel .project-model-progress small{margin-left:7px;color:#9996aa;font-size:10px;font-weight:650}
.create-panel .project-model-slot{min-height:183px}
.create-panel .project-model-step{animation:ft-create-fade .2s ease-out}
@keyframes ft-create-fade{from{opacity:.3;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.create-panel .project-model-choice{min-height:132px}
.create-panel .project-model-step-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:10px}
.create-panel .project-model-step-footer .project-model-hint{margin:0}
.create-panel .project-model-back{padding:5px 0;border:0;background:none;color:#6c55a7;font:700 11px inherit;cursor:pointer}
.create-panel .project-model-back:hover{text-decoration:underline}
.create-panel .project-model-back:focus-visible{outline:2px solid #8064bc;outline-offset:3px}
@media(max-width:670px){
 .create-panel .project-model-list{grid-template-columns:1fr}
 .create-panel .project-model-field{min-height:285px}
 .create-panel .project-model-slot{min-height:235px}
 .create-panel .project-model-choice{min-height:85px}
 .create-panel .project-model-step-footer{align-items:flex-start;gap:6px;flex-direction:column}
}
@media(prefers-reduced-motion:reduce){.create-panel .project-model-step{animation:none}}
`;
