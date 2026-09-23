"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MenuFotografo from "../../MenuFotografo";
import { createClient } from "../../../lib/supabase-client";

type Venda = {
  id:string;
  galeria:string;
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

export default function VendasPage(){
  const router=useRouter();
  const supabase=useMemo(()=>createClient(),[]);
  const [vendas,setVendas]=useState<Venda[]>([]);
  const [titulos,setTitulos]=useState<Record<string,string>>({});
  const [carregando,setCarregando]=useState(true);
  const [erro,setErro]=useState("");
  const [filtro,setFiltro]=useState<Filtro>("todas");

  useEffect(()=>{let ativo=true;(async()=>{
    const {data:auth}=await supabase.auth.getUser();
    if(!auth.user){router.replace("/login");return}
    const {data,error}=await supabase.from("vendas_fotos")
      .select("id,galeria,qtd_incluidas,qtd_extras,valor_unitario_centavos,valor_total_centavos,moeda,status,metodo_pagamento,criado_em,pago_em")
      .eq("fotografo_id",auth.user.id)
      .order("criado_em",{ascending:false})
      .limit(200);
    if(!ativo)return;
    if(error){setErro("Não foi possível carregar suas vendas agora.");setCarregando(false);return}
    const lista=(data??[]) as Venda[];
    setVendas(lista);
    const ids=[...new Set(lista.map(v=>v.galeria))];
    if(ids.length){
      const {data:gs}=await supabase.from("galerias").select("id,titulo").eq("user_id",auth.user.id).in("id",ids);
      if(ativo){const mapa:Record<string,string>={};for(const g of gs??[])mapa[String(g.id)]=String(g.titulo||"Galeria");setTitulos(mapa)}
    }
    if(ativo)setCarregando(false);
  })();return()=>{ativo=false}},[router,supabase]);

  const pagas=vendas.filter(v=>v.status==="pago");
  const receita=pagas.reduce((s,v)=>s+v.valor_total_centavos,0);
  const fotos=pagas.reduce((s,v)=>s+v.qtd_extras,0);
  const pendentes=vendas.filter(v=>v.status==="pendente").length;
  const lista=filtro==="todas"?vendas:vendas.filter(v=>v.status===filtro);

  return <main className="sales-page mf-shift">
    <MenuFotografo/>
    <style>{`
      .sales-page{min-height:100vh;box-sizing:border-box;padding:54px 5vw 84px;background:linear-gradient(180deg,#F0EDF7 0%,#ECE8F4 100%);color:#21253A}
      .sales-wrap{max-width:1180px;margin:auto}
      .sales-ey{font-size:11px;font-weight:800;letter-spacing:2px;color:#6B5BAE}
      .sales-h1{margin:7px 0 4px;font-size:29px;line-height:1.15;font-weight:800;letter-spacing:-.5px}
      .sales-sub{margin:0;color:#73758D;font-size:12.5px;font-weight:600;line-height:1.55}
      .sales-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:22px 0 18px}
      .sales-stat,.sales-card{background:#FAF8FD;border:1px solid #DCD6EE;box-shadow:0 10px 28px rgba(65,52,111,.055)}
      .sales-stat{border-radius:14px;padding:16px 17px}.sales-stat strong{display:block;font-size:24px;font-weight:800;color:#272C43}.sales-stat span{display:block;margin-top:5px;font-size:10px;font-weight:650;color:#777A90}
      .sales-toolbar{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:12px}
      .sales-filters{display:flex;gap:7px;flex-wrap:wrap}.sales-filter{border:1px solid #D9D3E8;background:#FAF8FD;color:#686D84;border-radius:999px;padding:8px 11px;font:700 10px inherit;cursor:pointer}.sales-filter.on{color:#45406E;border-color:#BBB0DC;background:#EEE8FA}
      .sales-note{font-size:10px;color:#818399;font-weight:600}
      .sales-card{border-radius:16px;overflow:hidden}
      .sales-head,.sales-row{display:grid;grid-template-columns:minmax(220px,1.4fr) .65fr .75fr .7fr .85fr;gap:12px;align-items:center}
      .sales-head{padding:11px 15px;background:#F2EEF8;border-bottom:1px solid #DDD7E8;color:#74778D;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.8px}
      .sales-row{padding:14px 15px;border-bottom:1px solid #E5E0ED}.sales-row:last-child{border-bottom:0}
      .sales-title{font-size:12px;font-weight:800;color:#2A2F46}.sales-meta{font-size:9.5px;color:#7D8094;font-weight:600;margin-top:4px}
      .sales-value{font-size:12px;font-weight:800;color:#30354C}.sales-small{font-size:10.5px;color:#666C84;font-weight:650}
      .sales-pill{justify-self:start;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:800;border:1px solid}
      .sales-pill.pago{color:#3F7C5B;background:#E9F5EF;border-color:#C9E4D5}.sales-pill.pendente{color:#97702D;background:#FBF2DB;border-color:#E8D4A0}.sales-pill.cancelado,.sales-pill.falhou{color:#945D64;background:#F8EDEE;border-color:#EACFD2}
      .sales-empty{padding:46px 20px;text-align:center;color:#7A7D92;font-size:12px;font-weight:600}
      .sales-error{margin:16px 0;padding:10px 12px;border:1px solid #EACFD2;border-radius:10px;background:#F8EDEE;color:#945D64;font-size:11px;font-weight:700}
      @media(max-width:900px){.sales-stats{grid-template-columns:1fr 1fr}.sales-head{display:none}.sales-row{grid-template-columns:1fr 1fr}.sales-row>div:first-child{grid-column:1/-1}.sales-toolbar{align-items:flex-start;flex-direction:column}}
      @media(max-width:640px){.sales-page{padding:78px 14px 60px}.sales-h1{font-size:24px}.sales-stats{grid-template-columns:1fr 1fr}.sales-row{grid-template-columns:1fr}.sales-row>div:first-child{grid-column:auto}.sales-note{line-height:1.5}}
    `}</style>
    <div className="sales-wrap">
      <header><div className="sales-ey">VENDAS</div><h1 className="sales-h1">Fotos extras vendidas</h1><p className="sales-sub">Acompanhe compras adicionais feitas pelos clientes diretamente nas galerias.</p></header>
      <section className="sales-stats">
        <div className="sales-stat"><strong>{dinheiro(receita)}</strong><span>Volume bruto pago</span></div>
        <div className="sales-stat"><strong>{pagas.length}</strong><span>Vendas confirmadas</span></div>
        <div className="sales-stat"><strong>{fotos}</strong><span>Fotos extras vendidas</span></div>
        <div className="sales-stat"><strong>{pendentes}</strong><span>Pagamentos pendentes</span></div>
      </section>
      <div className="sales-toolbar">
        <div className="sales-filters">
          <button className={"sales-filter"+(filtro==="todas"?" on":"")} onClick={()=>setFiltro("todas")}>Todas</button>
          <button className={"sales-filter"+(filtro==="pago"?" on":"")} onClick={()=>setFiltro("pago")}>Pagas</button>
          <button className={"sales-filter"+(filtro==="pendente"?" on":"")} onClick={()=>setFiltro("pendente")}>Pendentes</button>
        </div>
        <div className="sales-note">Valores brutos; taxas e repasses finais são administrados pela Stripe.</div>
      </div>
      {erro&&<div className="sales-error">{erro}</div>}
      <section className="sales-card">
        <div className="sales-head"><span>Galeria</span><span>Extras</span><span>Valor</span><span>Status</span><span>Data</span></div>
        {carregando?<div className="sales-empty">Carregando vendas…</div>:lista.length===0?<div className="sales-empty">{vendas.length?"Nenhuma venda corresponde ao filtro.":"Nenhuma venda de fotos extras registrada ainda."}</div>:lista.map(v=><article className="sales-row" key={v.id}>
          <div><div className="sales-title">{titulos[v.galeria]||"Galeria"}</div><div className="sales-meta">{v.qtd_incluidas} incluídas · {dinheiro(v.valor_unitario_centavos)} por extra</div></div>
          <div className="sales-small">{v.qtd_extras} foto{v.qtd_extras===1?"":"s"}</div>
          <div className="sales-value">{dinheiro(v.valor_total_centavos)}</div>
          <div><span className={"sales-pill "+v.status}>{statusLabel(v.status)}</span></div>
          <div className="sales-small">{dataCurta(v.pago_em||v.criado_em)}</div>
        </article>)}
      </section>
    </div>
  </main>
}
