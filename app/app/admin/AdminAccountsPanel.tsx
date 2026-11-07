"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-client";
import FoturaDrawer from "../components/FoturaDrawer";

type Conta = {
  id:string; email:string; nomeEstudio:string; criadoEm:string|null; ultimoLoginEm:string|null;
  plano:string; status:string; temAssinatura:boolean; cancelarNoFim:boolean;
  suspensa:boolean; takedownPublico:boolean; encerramentoStatus:string|null;
  galerias:number; clientes:number;
};
type Detalhe = {
  id:string; email:string; telefone:string|null; criadoEm:string|null;
  confirmadoEm:string|null; ultimoLoginEm:string|null;
  perfil:{nome_estudio?:string|null}|null;
  planoEfetivo:{nome:string}; planoPersistido:{nome:string};
  assinatura:{status?:string; provedor?:string|null; provedor_assinatura_id?:string|null; periodo_fim?:string|null; cancelar_no_fim?:boolean}|null;
  suspensao:{ativa?:boolean}|null;
  takedownPublico:{ativo?:boolean}|null;
  encerramento:{status?:string; motivo?:string|null}|null;
  uso:{galeriasAtivas:number; clientes:number; armazenamentoGb:number};
  galerias:Array<{id:string;titulo:string;etapa:string;criado_em:string}>;
  clientes:Array<{id:string;nome:string;email:string|null}>;
};
type Filtro="todas"|"assinantes"|"atencao"|"encerramento";
type Acao="plano_manual"|"sincronizar_stripe"|"suspender"|"reativar"|"takedown_publico"|"restaurar_publico";
const PLANOS:Record<string,string>={sem_plano:"Sem plano",gratis:"Grátis",legacy:"Acesso legado",essencial:"Essencial",profissional:"Profissional",studio:"Studio"};
const STATUS:Record<string,string>={active:"Ativa",trialing:"Em teste",past_due:"Pagamento pendente",canceled:"Cancelada",incomplete:"Incompleta",unpaid:"Não paga",unknown:"Sem assinatura"};
const filtroOpcoes:Array<{value:Filtro;label:string}>=[
  {value:"todas",label:"Todas"},{value:"assinantes",label:"Assinantes"},
  {value:"atencao",label:"Precisam de atenção"},{value:"encerramento",label:"Encerramento"}
];
function data(valor:string|null|undefined){if(!valor)return "—";const d=new Date(valor);return Number.isNaN(d.getTime())?"—":d.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});}
function plano(s:string){return PLANOS[s]||s.replaceAll("_"," ");}
function status(s:string|null|undefined){return STATUS[s||"unknown"]||(s||"unknown").replaceAll("_"," ");}
function nome(c:Conta){return c.nomeEstudio?.trim()||c.email||"Conta sem nome";}
function atencao(c:Conta){return c.suspensa||c.takedownPublico||c.status==="past_due"||["pendente","confirmado"].includes(c.encerramentoStatus||"");}

export default function AdminAccountsPanel(){
  const supabase=useMemo(()=>createClient(),[]);
  const [contas,setContas]=useState<Conta[]>([]);
  const [papel,setPapel]=useState("");
  const [erro,setErro]=useState("");
  const [carregando,setCarregando]=useState(true);
  const [busca,setBusca]=useState("");
  const [filtro,setFiltro]=useState<Filtro>("todas");
  const [quantidade,setQuantidade]=useState(20);
  const [id,setId]=useState<string|null>(null);
  const [detalhe,setDetalhe]=useState<Detalhe|null>(null);
  const [erroDetalhe,setErroDetalhe]=useState("");
  const [carregandoDetalhe,setCarregandoDetalhe]=useState(false);
  const [motivo,setMotivo]=useState("");
  const [planoManual,setPlanoManual]=useState("legacy");
  const [ocupado,setOcupado]=useState(false);
  const [mensagem,setMensagem]=useState("");
  const [erroAcao,setErroAcao]=useState("");

  const buscar=useCallback(async(url:string,method:"GET"|"POST"="GET",body?:object,signal?:AbortSignal)=>{
    const {data:{session}}=await supabase.auth.getSession();
    if(!session)throw new Error("Sessão expirada. Entre novamente no Fotura.");
    const res=await fetch(url,{method,cache:"no-store",signal,headers:{
      Authorization:"Bearer "+session.access_token,...(method==="POST"?{"Content-Type":"application/json"}:{})
    },...(body?{body:JSON.stringify(body)}:{})});
    const json=await res.json().catch(()=>({})) as Record<string,unknown>;
    if(!res.ok)throw new Error(typeof json.error==="string"?json.error:"Não foi possível carregar os dados.");
    return json;
  },[supabase]);
  const carregar=useCallback(async(signal?:AbortSignal)=>{
    const j=await buscar("/api/admin/contas","GET",undefined,signal);
    if(signal?.aborted)return;
    setContas((j.contas||[]) as Conta[]);
    setPapel(typeof j.papel==="string"?j.papel:"");
  },[buscar]);
  const carregarDetalhe=useCallback(async(contaId:string,signal?:AbortSignal)=>{
    const j=await buscar("/api/admin/contas/"+encodeURIComponent(contaId),"GET",undefined,signal);
    if(!signal?.aborted)setDetalhe(j.conta as Detalhe);
  },[buscar]);

  useEffect(()=>{
    const ctrl=new AbortController();
    void carregar(ctrl.signal).catch(e=>{if(!ctrl.signal.aborted)setErro(String(e instanceof Error?e.message:e));})
      .finally(()=>{if(!ctrl.signal.aborted)setCarregando(false);});
    return()=>ctrl.abort();
  },[carregar]);

  useEffect(()=>{
    if(!id)return;
    const ctrl=new AbortController();
    setCarregandoDetalhe(true);setErroDetalhe("");setDetalhe(null);
    void carregarDetalhe(id,ctrl.signal).catch(e=>{if(!ctrl.signal.aborted)setErroDetalhe(e instanceof Error?e.message:"Erro ao carregar conta.");})
      .finally(()=>{if(!ctrl.signal.aborted)setCarregandoDetalhe(false);});
    return()=>ctrl.abort();
  },[id,carregarDetalhe]);

  async function executar(acao:Acao){
    if(!id||ocupado||papel!=="owner")return;
    if(motivo.trim().length<8){setErroAcao("Informe um motivo com pelo menos 8 caracteres.");return;}
    const nomes:Record<Acao,string>={plano_manual:"alterar o plano manual",sincronizar_stripe:"sincronizar a assinatura Stripe",suspender:"suspender esta conta",reativar:"reativar esta conta",takedown_publico:"bloquear as galerias públicas",restaurar_publico:"restaurar as galerias públicas"};
    if(!window.confirm("Confirmar: "+nomes[acao]+"?"))return;
    setOcupado(true);setMensagem("");setErroAcao("");
    try{
      const j=await buscar("/api/admin/contas/"+encodeURIComponent(id)+"/acoes","POST",{acao,plano:planoManual,motivo:motivo.trim()});
      setMensagem(typeof j.mensagem==="string"?j.mensagem:"Ação concluída.");
      setMotivo("");
      await Promise.all([carregar(),carregarDetalhe(id)]);
    }catch(e){setErroAcao(e instanceof Error?e.message:"Não foi possível executar a ação.");}
    finally{setOcupado(false);}
  }
  const term=busca.trim().toLocaleLowerCase("pt-BR");
  const filtradas=contas.filter(c=>(!term||[nome(c),c.email,c.plano,c.status].join(" ").toLocaleLowerCase("pt-BR").includes(term))&&
    (filtro==="todas"||(filtro==="assinantes"&&c.temAssinatura)||(filtro==="atencao"&&atencao(c))||
    (filtro==="encerramento"&&["pendente","confirmado"].includes(c.encerramentoStatus||""))));
  const selecionada=contas.find(c=>c.id===id);
  const stripe=Boolean(detalhe?.assinatura?.provedor==="stripe"&&detalhe.assinatura.provedor_assinatura_id);

  return <section className="admin-account-section" id="contas" aria-label="Contas do Fotura">
    <div className="admin-section-head">
      <div><div className="admin-section-kicker">GERENCIAMENTO</div><h2>Contas do Fotura</h2>
        <p>Pesquise, filtre e consulte cada conta sem sair da Visão geral.</p></div>
      {!carregando&&!erro&&<span className="admin-account-count">{filtradas.length} de {contas.length} contas</span>}
    </div>
    <div className="admin-account-controls">
      <div className="admin-account-filters" role="group" aria-label="Filtrar contas">
        {filtroOpcoes.map(f=><button key={f.value} type="button" className="admin-filter-btn" aria-pressed={filtro===f.value}
          onClick={()=>{setFiltro(f.value);setQuantidade(20);}}>{f.label}</button>)}
      </div>
      <input className="admin-account-search" type="search" value={busca} aria-label="Buscar contas"
        onChange={e=>{setBusca(e.target.value);setQuantidade(20);}}
        placeholder="Buscar por estúdio, e-mail, plano ou status"/>
    </div>
    {carregando?<div className="admin-loading" role="status">Carregando contas…</div>:
     erro?<div className="admin-error" role="alert">{erro} <button className="admin-link-button" type="button"
       onClick={()=>{setErro("");setCarregando(true);void carregar().catch(e=>setErro(String(e))).finally(()=>setCarregando(false));}}>Tentar novamente</button></div>:
     filtradas.length===0?<div className="admin-empty">Nenhuma conta encontrada para este filtro.</div>:
     <>
       <div className="admin-account-list">
         {filtradas.slice(0,quantidade).map(c=><article className="admin-account-row" key={c.id}>
           <div className="admin-account-identity">
             <span className="admin-account-avatar" aria-hidden="true">{nome(c).slice(0,1).toLocaleUpperCase("pt-BR")}</span>
             <div className="admin-account-identity-info">
               <div className="admin-account-name">{nome(c)}</div>
               <div className="admin-account-email">{c.email||"Sem e-mail"}</div>
               <div className="admin-account-flags">
                 <span className={"admin-status-pill "+(c.suspensa?"danger":c.status==="past_due"?"warn":c.status==="active"?"good":"")}>
                   {c.suspensa?"Suspensa":status(c.status)}</span>
                 {c.takedownPublico&&<span className="admin-status-pill warn">Galerias bloqueadas</span>}
                 {["pendente","confirmado"].includes(c.encerramentoStatus||"")&&<span className="admin-status-pill danger">Encerramento {c.encerramentoStatus}</span>}
                 {c.cancelarNoFim&&<span className="admin-status-pill">Cancelamento previsto</span>}
               </div>
             </div>
           </div>
           <div className="admin-account-plan-col"><span className="admin-account-label">PLANO</span>
             <span className="admin-account-value">{plano(c.plano)}</span></div>
           <div className="admin-account-usage-col"><span className="admin-account-label">CONTEÚDO</span>
             <span className="admin-account-value">{c.galerias} galerias · {c.clientes} clientes</span></div>
           <div className="admin-account-date-col"><span className="admin-account-label">ÚLTIMO LOGIN</span>
             <span className="admin-account-value">{data(c.ultimoLoginEm)}</span>
             <span className="admin-account-dates">Cadastro: {data(c.criadoEm)}</span></div>
           <button className="admin-link-button" type="button" onClick={()=>{setId(c.id);setMotivo("");setMensagem("");setErroAcao("");}}
             aria-label={"Ver detalhes da conta "+nome(c)}>Detalhes <span aria-hidden="true">→</span></button>
         </article>)}
       </div>
       {filtradas.length>quantidade&&<div className="admin-account-more"><button className="admin-link-button" type="button"
         onClick={()=>setQuantidade(n=>n+20)}>Mostrar mais ({filtradas.length-quantidade} restantes)</button></div>}
     </>}

    {id&&<FoturaDrawer title="Ficha da conta" description={selecionada?nome(selecionada):"Fotura"} onClose={()=>{if(!ocupado)setId(null);}}>
      {carregandoDetalhe?<p className="admin-account-detail-muted" role="status">Carregando detalhes…</p>:
       erroDetalhe?<div className="admin-error" role="alert">{erroDetalhe}</div>:
       detalhe&&<>
         <h3 className="admin-account-detail-name">{detalhe.perfil?.nome_estudio||detalhe.email}</h3>
         <p className="admin-account-detail-muted">{detalhe.email}</p>
         <div className="admin-account-detail-badges">
           <span className="admin-status-pill">{detalhe.planoEfetivo.nome}</span>
           <span className={"admin-status-pill "+(detalhe.suspensao?.ativa?"danger":"good")}>{detalhe.suspensao?.ativa?"Suspensa":"Acesso normal"}</span>
           {detalhe.takedownPublico?.ativo&&<span className="admin-status-pill warn">Galerias bloqueadas</span>}
         </div>
         <div className="admin-account-detail-stats">
           <div><strong>{detalhe.uso.galeriasAtivas}</strong><span>Galerias ativas</span></div>
           <div><strong>{detalhe.uso.clientes}</strong><span>Clientes</span></div>
           <div><strong>{detalhe.uso.armazenamentoGb.toFixed(2)} GB</strong><span>Armazenamento</span></div>
         </div>
         <section className="admin-account-detail-section"><h3>Cadastro e acesso</h3><dl>
           <div><dt>Telefone</dt><dd>{detalhe.telefone||"—"}</dd></div>
           <div><dt>Cadastro</dt><dd>{data(detalhe.criadoEm)}</dd></div>
           <div><dt>E-mail confirmado</dt><dd>{data(detalhe.confirmadoEm)}</dd></div>
           <div><dt>Último login</dt><dd>{data(detalhe.ultimoLoginEm)}</dd></div>
           <div><dt>ID</dt><dd className="admin-account-detail-id">{detalhe.id}</dd></div>
         </dl></section>
         <section className="admin-account-detail-section"><h3>Assinatura</h3><dl>
           <div><dt>Plano atual</dt><dd>{detalhe.planoEfetivo.nome}</dd></div>
           <div><dt>Plano registrado</dt><dd>{detalhe.planoPersistido.nome}</dd></div>
           <div><dt>Status</dt><dd>{status(detalhe.assinatura?.status)}</dd></div>
           <div><dt>Origem</dt><dd>{detalhe.assinatura?.provedor||"—"}</dd></div>
           <div><dt>Fim do período</dt><dd>{data(detalhe.assinatura?.periodo_fim)}</dd></div>
         </dl></section>
         {detalhe.encerramento?.status&&<section className="admin-account-detail-section"><h3>Encerramento</h3>
           <p className="admin-account-detail-muted">{detalhe.encerramento.status} · {detalhe.encerramento.motivo||"Sem motivo informado"}</p></section>}
         <section className="admin-account-detail-section"><h3>Galerias recentes</h3>
           {detalhe.galerias.length?<div className="admin-account-detail-rows">{detalhe.galerias.map(g=><div key={g.id}>
             <strong>{g.titulo||"Sem título"}</strong><span>{g.etapa} · {data(g.criado_em)}</span></div>)}</div>:
             <p className="admin-account-detail-muted">Nenhuma galeria.</p>}</section>
         <section className="admin-account-detail-section"><h3>Clientes recentes</h3>
           {detalhe.clientes.length?<div className="admin-account-detail-rows">{detalhe.clientes.map(c=><div key={c.id}>
             <strong>{c.nome}</strong><span>{c.email||"Sem e-mail"}</span></div>)}</div>:
             <p className="admin-account-detail-muted">Nenhum cliente.</p>}</section>
         {papel==="owner"&&<details className="admin-account-advanced"><summary>Ações administrativas controladas</summary>
           <p>Motivo obrigatório, confirmação e registro de auditoria. Apenas o proprietário pode executar.</p>
           <label htmlFor="admin-account-motivo">Motivo da ação (mínimo de 8 caracteres)</label>
           <textarea id="admin-account-motivo" rows={3} maxLength={500} value={motivo} disabled={ocupado}
             onChange={e=>setMotivo(e.target.value)} placeholder="Justificativa da ação…"/>
           <label htmlFor="admin-account-plano">Plano manual</label>
           <select id="admin-account-plano" value={planoManual} disabled={ocupado||stripe}
             onChange={e=>setPlanoManual(e.target.value)}>
             <option value="sem_plano">Sem plano</option><option value="legacy">Acesso legado</option>
             <option value="essencial">Essencial</option><option value="profissional">Profissional</option><option value="studio">Studio</option>
           </select>
           <div className="admin-account-advanced-buttons">
             <button type="button" disabled={ocupado||stripe} onClick={()=>void executar("plano_manual")}>Aplicar plano manual</button>
             <button type="button" disabled={ocupado||!stripe} onClick={()=>void executar("sincronizar_stripe")}>Sincronizar Stripe</button>
             <button type="button" className={detalhe.takedownPublico?.ativo?"":"warn"} disabled={ocupado}
               onClick={()=>void executar(detalhe.takedownPublico?.ativo?"restaurar_publico":"takedown_publico")}>
               {detalhe.takedownPublico?.ativo?"Restaurar galerias":"Bloquear galerias"}</button>
             <button type="button" className={detalhe.suspensao?.ativa?"":"danger"} disabled={ocupado}
               onClick={()=>void executar(detalhe.suspensao?.ativa?"reativar":"suspender")}>
               {detalhe.suspensao?.ativa?"Reativar conta":"Suspender conta"}</button>
           </div>
           {ocupado&&<p role="status">Processando…</p>}
           {mensagem&&<p className="admin-account-action-success" role="status">{mensagem}</p>}
           {erroAcao&&<p className="admin-account-action-error" role="alert">{erroAcao}</p>}
         </details>}
       </>}
    </FoturaDrawer>}
  </section>;
}
