"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MenuFotografo from "../../MenuFotografo";
import { createClient } from "../../../lib/supabase-client";
import { registrarEventoProduto } from "../../../lib/product-analytics";

type Venda = {
  id:string;
  galeria:string;
  fotos:string[];
  qtd_incluidas:number;
  qtd_extras:number;
  valor_unitario_centavos:number;
  valor_total_centavos:number;
  moeda:string;
  status:"pendente"|"pago"|"cancelado"|"falhou";
  metodo_pagamento:string|null;
  criado_em:string;
  pago_em:string|null;
};

type Filtro = "todas"|"pago"|"pendente";

function dinheiro(centavos:number){
  return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format((centavos||0)/100);
}
function dataCurta(valor:string|null){
  if(!valor)return "—";
  return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(valor));
}
function statusLabel(status:Venda["status"]){
  return status==="pago"?"Pago":status==="pendente"?"Pendente":status==="cancelado"?"Cancelado":"Falhou";
}
function descricaoStatus(v:Venda){
  if(v.status==="pago") return `Pagamento confirmado · ${v.qtd_extras} foto${v.qtd_extras===1?"":"s"} extra${v.qtd_extras===1?"":"s"} liberada${v.qtd_extras===1?"":"s"}`;
  if(v.status==="pendente") return "Aguardando confirmação do pagamento pela Stripe.";
  if(v.status==="cancelado") return "Checkout encerrado sem pagamento. A seleção do cliente permanece salva.";
  return "O pagamento não foi concluído. A seleção não foi liberada como compra.";
}
function SearchIcon(){return <svg className="sales-search-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>}

export default function VendasPage(){
  const router=useRouter();
  const supabase=useMemo(()=>createClient(),[]);
  const [vendas,setVendas]=useState<Venda[]>([]);
  const [titulos,setTitulos]=useState<Record<string,string>>({});
  const [carregando,setCarregando]=useState(true);
  const [erro,setErro]=useState("");
  const [filtro,setFiltro]=useState<Filtro>("todas");
  const [filtroAberto,setFiltroAberto]=useState(false);
  const [busca,setBusca]=useState("");
  const [infoAberta,setInfoAberta]=useState(false);

  useEffect(()=>{
    const inicial=new URLSearchParams(window.location.search).get("filtro");
    if(inicial==="pago"||inicial==="pendente") setFiltro(inicial);
  },[]);

  useEffect(()=>{let ativo=true;(async()=>{
    const {data:auth}=await supabase.auth.getSession();
    const session=auth.session;
    if(!session){router.replace("/login");return}

    registrarEventoProduto("sales_page_view",{
      token:session.access_token,
      rota:"/dashboard/vendas",
    });

    const {data,error}=await supabase.from("vendas_fotos")
      .select("id,galeria,fotos,qtd_incluidas,qtd_extras,valor_unitario_centavos,valor_total_centavos,moeda,status,metodo_pagamento,criado_em,pago_em")
      .eq("fotografo_id",session.user.id)
      .order("criado_em",{ascending:false})
      .limit(200);
    if(!ativo)return;
    if(error){setErro("Não foi possível carregar suas vendas agora.");setCarregando(false);return}
    const lista=(data??[]) as Venda[];
    setVendas(lista);
    const ids=[...new Set(lista.map(v=>v.galeria))];
    if(ids.length){
      const {data:gs}=await supabase.from("galerias").select("id,titulo").eq("user_id",session.user.id).in("id",ids);
      if(ativo){
        const mapa:Record<string,string>={};
        for(const g of gs??[])mapa[String(g.id)]=String(g.titulo||"Galeria");
        setTitulos(mapa);
      }
    }
    if(ativo)setCarregando(false);
  })();return()=>{ativo=false}},[router,supabase]);

  const pagas=vendas.filter(v=>v.status==="pago");
  const receita=pagas.reduce((s,v)=>s+v.valor_total_centavos,0);
  const fotos=pagas.reduce((s,v)=>s+v.qtd_extras,0);
  const pendentes=vendas.filter(v=>v.status==="pendente").length;
  const termo=busca.trim().toLocaleLowerCase("pt-BR");
  const lista=vendas.filter(v=>(filtro==="todas"||v.status===filtro)&&(!termo||(titulos[v.galeria]||"Galeria").toLocaleLowerCase("pt-BR").includes(termo)));

  return <main className="sales-page mf-shift">
    <MenuFotografo/>
    <style>{`
      .sales-page{min-height:100vh;box-sizing:border-box;padding:54px 5vw 84px calc(236px + 5vw);background:linear-gradient(180deg,#F0EDF7 0%,#ECE8F4 100%);color:#21253A}
      .sales-wrap{max-width:1180px;margin:auto}.sales-header{position:relative}.sales-ey{font-size:11px;font-weight:800;letter-spacing:2px;color:#6B5BAE}.sales-title-row{display:flex;align-items:center;gap:9px}.sales-h1{margin:7px 0 4px;font-size:29px;line-height:1.15;font-weight:800;letter-spacing:-.5px}.sales-sub{margin:0;color:#73758D;font-size:12.5px;font-weight:600;line-height:1.55}.sales-info-wrap{position:relative;display:inline-flex;align-items:center}.sales-info-btn{width:27px;height:27px;display:grid;place-items:center;border:1px solid #CFC6E3;border-radius:50%;background:#FAF8FD;color:#5C557B;font-family:inherit;font-size:13px;font-weight:800;line-height:1;cursor:pointer;box-shadow:0 4px 12px rgba(65,52,111,.05)}.sales-info-btn:hover,.sales-info-btn.open{border-color:#B8AADB;background:#F0EBF8;color:#514780}.sales-info-pop{position:absolute;left:0;top:calc(100% + 8px);z-index:50;width:min(360px,80vw);padding:12px 13px;border:1px solid #D8D0EA;border-radius:12px;background:#FAF8FD;box-shadow:0 16px 34px rgba(49,42,79,.16)}.sales-info-pop strong{display:block;font-size:11px;color:#2A2F46}.sales-info-pop p{margin:5px 0 0;color:#777A90;font-size:10px;line-height:1.5}
      .sales-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.sales-stat,.sales-card{background:#FAF8FD;border:1px solid #DCD6EE;box-shadow:0 10px 28px rgba(65,52,111,.055)}.sales-stat{border-radius:14px;padding:16px 17px}.sales-stat strong{display:block;font-size:24px;font-weight:800;color:#272C43}.sales-stat span{display:block;margin-top:5px;font-size:10px;font-weight:650;color:#777A90}
      .sales-toolbar{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:12px}.sales-toolbar-left{display:inline-flex;align-items:center;gap:8px;flex-wrap:nowrap}.sales-search-box{position:relative;display:inline-flex;align-items:center;width:320px;max-width:100%;flex:0 0 320px}.sales-search-icon{position:absolute;left:10px;width:14px;height:14px;color:#747a96;pointer-events:none}.sales-search{width:100%;min-width:0;height:34px;padding:7px 10px 7px 31px;border:1px solid #D7D0E7;border-radius:9px;background:#F3EFF9;color:#21253A;font-family:inherit;font-size:12px;font-weight:500;outline:none;box-sizing:border-box}.sales-search:focus{border-color:#BFB4D7;background:#F7F4FB}.filter-wrap{position:relative;display:inline-flex}.filter-trigger{height:34px;display:inline-flex;align-items:center;gap:7px;padding:0 11px;border:1px solid #D7D0E7;border-radius:9px;background:#FAF8FD;color:#555b73;font-family:inherit;font-size:11px;font-weight:700;line-height:1;cursor:pointer;white-space:nowrap}.filter-trigger:hover,.filter-trigger.open{border-color:#BFB4D7;background:#F3EFF9}.filter-chevron{font-size:12px;color:#7a7f9a;transform:translateY(-1px)}.filter-menu{position:absolute;left:0;top:calc(100% + 6px);z-index:40;min-width:148px;padding:5px;border:1px solid #D7D0E7;border-radius:10px;background:#FAF8FD;box-shadow:0 12px 28px rgba(49,42,79,.13)}.filter-option{width:100%;display:flex;align-items:center;justify-content:space-between;gap:14px;border:0;border-radius:7px;background:transparent;color:#555b73;padding:8px 9px;font-family:inherit;font-size:12px;font-weight:650;cursor:pointer;text-align:left}.filter-option:hover{background:#F0EBF7}.filter-option.on{color:#514780;background:#ECE7F6}.filter-check{font-size:10px}.sales-note{font-size:10px;color:#818399;font-weight:600}
      .sales-card{border-radius:16px;overflow:hidden}.sales-head,.sales-row{display:grid;grid-template-columns:minmax(220px,1.35fr) .5fr .62fr .62fr .82fr .75fr;gap:12px;align-items:center}.sales-head{padding:11px 15px;background:#F2EEF8;border-bottom:1px solid #DDD7E8;color:#74778D;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.8px}.sales-row{padding:14px 15px;border-bottom:1px solid #E5E0ED}.sales-row:last-child{border-bottom:0}
      .sales-title{font-size:12px;font-weight:800;color:#2A2F46}.sales-meta{font-size:9.5px;color:#7D8094;font-weight:600;margin-top:4px;line-height:1.45}.sales-state{margin-top:5px;color:#777A90;font-size:8.8px;line-height:1.45}.sales-value{font-size:12px;font-weight:800;color:#30354C}.sales-small{font-size:10.5px;color:#666C84;font-weight:650}.sales-pill{justify-self:start;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:800;border:1px solid}.sales-pill.pago{color:#3F7C5B;background:#E9F5EF;border-color:#C9E4D5}.sales-pill.pendente{color:#97702D;background:#FBF2DB;border-color:#E8D4A0}.sales-pill.cancelado,.sales-pill.falhou{color:#945D64;background:#F8EDEE;border-color:#EACFD2}
      .sales-actions{display:flex;gap:5px;justify-content:flex-end}.sales-action{border:1px solid #D6D0E5;border-radius:8px;background:#F7F4FB;color:#555B73;padding:7px 8px;font:750 9px inherit;cursor:pointer;white-space:nowrap}.sales-action:hover{background:#EEE9F7;border-color:#C8BEE0}.sales-action.primary{border-color:#BFB4DD;color:#514780;background:#EEE8FA}
      .sales-empty{padding:46px 20px;text-align:center;color:#7A7D92;font-size:12px;font-weight:600}.sales-error{margin:16px 0;padding:10px 12px;border:1px solid #EACFD2;border-radius:10px;background:#F8EDEE;color:#945D64;font-size:11px;font-weight:700}
      @media(min-width:641px) and (max-width:980px){.sales-page{padding-left:calc(72px + 5vw)}}@media(max-width:980px){.sales-stats{grid-template-columns:1fr 1fr}.sales-head{display:none}.sales-row{grid-template-columns:1fr 1fr 1fr}.sales-row>div:first-child{grid-column:1/-1}.sales-actions{grid-column:1/-1;justify-content:flex-start}.sales-toolbar{align-items:flex-start;flex-direction:column}}
      @media(max-width:640px){.sales-page{padding:78px 12px 64px}.sales-h1{font-size:24px}.sales-stats{grid-template-columns:1fr 1fr;gap:8px}.sales-stat{padding:13px}.sales-stat strong{font-size:21px}.sales-row{grid-template-columns:1fr 1fr;padding:13px}.sales-row>div:first-child{grid-column:1/-1}.sales-row>div:nth-child(5){grid-column:1/-1}.sales-actions{display:grid;grid-template-columns:1fr 1fr;width:100%}.sales-action{min-height:42px}.sales-note{line-height:1.5}.sales-toolbar-left{width:100%;display:flex;flex-wrap:wrap}.sales-search-box{width:100%;max-width:none;flex:1 1 220px}.sales-info-pop{left:auto;right:0}.filter-wrap{width:auto;flex:none}}
      @media(max-width:390px){.sales-stats{grid-template-columns:1fr}.sales-actions{grid-template-columns:1fr}}
    `}</style>
    <div className="sales-wrap">
      <header className="sales-header"><div className="sales-ey">VENDAS</div><div className="sales-title-row"><h1 className="sales-h1">Fotos extras vendidas</h1><div className="sales-info-wrap"><button type="button" className={"sales-info-btn"+(infoAberta?" open":"")} aria-label="Informações sobre vendas" aria-expanded={infoAberta} onClick={()=>setInfoAberta(v=>!v)}>!</button>{infoAberta&&<div className="sales-info-pop" role="note"><strong>Depois do pagamento, o Fotura fecha o ciclo automaticamente.</strong><p>A compra confirmada finaliza a seleção do cliente, registra as fotos adicionais e deixa a galeria pronta para você seguir para a entrega.</p></div>}</div></div><p className="sales-sub">Acompanhe compras adicionais feitas pelos clientes diretamente nas galerias.</p></header>
      <section className="sales-stats">
        <div className="sales-stat"><strong>{dinheiro(receita)}</strong><span>Volume bruto pago</span></div>
        <div className="sales-stat"><strong>{pagas.length}</strong><span>Vendas confirmadas</span></div>
        <div className="sales-stat"><strong>{fotos}</strong><span>Fotos extras vendidas</span></div>
        <div className="sales-stat"><strong>{pendentes}</strong><span>Pagamentos pendentes</span></div>
      </section>
      <div className="sales-toolbar">
        <div className="sales-toolbar-left">
          <label className="sales-search-box"><SearchIcon/><input className="sales-search" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por galeria" aria-label="Buscar vendas por galeria"/></label>
          <div className="filter-wrap"><button type="button" className={"filter-trigger"+(filtroAberto?" open":"")} aria-haspopup="menu" aria-expanded={filtroAberto} onClick={()=>setFiltroAberto(v=>!v)}>Filtrar por <span className="filter-chevron">⌄</span></button>{filtroAberto&&<div className="filter-menu" role="menu">{([["todas","Todas"],["pago","Pagas"],["pendente","Pendentes"]] as [Filtro,string][]).map(([valor,rotulo])=><button type="button" role="menuitem" key={valor} className={"filter-option"+(filtro===valor?" on":"")} onClick={()=>{setFiltro(valor);setFiltroAberto(false)}}><span>{rotulo}</span>{filtro===valor&&<span className="filter-check">✓</span>}</button>)}</div>}</div>
        </div>
        <div className="sales-note">Valores brutos; taxas e repasses finais são administrados pela Stripe.</div>
      </div>
      {erro&&<div className="sales-error">{erro}</div>}
      <section className="sales-card">
        <div className="sales-head"><span>Galeria</span><span>Extras</span><span>Valor</span><span>Status</span><span>Data</span><span>Ações</span></div>
        {carregando?<div className="sales-empty">Carregando vendas…</div>:lista.length===0?<div className="sales-empty">{vendas.length?"Nenhuma venda corresponde à busca ou ao filtro.":"Nenhuma venda de fotos extras registrada ainda."}</div>:lista.map(v=><article className="sales-row" key={v.id}>
          <div><div className="sales-title">{titulos[v.galeria]||"Galeria"}</div><div className="sales-meta">{v.qtd_incluidas} incluídas · {dinheiro(v.valor_unitario_centavos)} por extra</div><div className="sales-state">{descricaoStatus(v)}</div></div>
          <div className="sales-small">{v.qtd_extras} foto{v.qtd_extras===1?"":"s"}</div>
          <div className="sales-value">{dinheiro(v.valor_total_centavos)}</div>
          <div><span className={"sales-pill "+v.status}>{statusLabel(v.status)}</span></div>
          <div className="sales-small">{dataCurta(v.pago_em||v.criado_em)}</div>
          <div className="sales-actions">
            <button className={"sales-action"+(v.status==="pago"?" primary":"")} onClick={()=>router.push(`/dashboard/selecoes?galeria=${v.galeria}`)}>Ver seleção</button>
            <button className="sales-action" onClick={()=>window.open(`/g/${v.galeria}`,"_blank","noopener,noreferrer")}>Galeria</button>
          </div>
        </article>)}
      </section>
    </div>
  </main>
}
