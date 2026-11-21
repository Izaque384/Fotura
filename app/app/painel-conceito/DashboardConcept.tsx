"use client";

import { useEffect, useState, type ReactNode } from "react";
import "./dashboard-concept.css";

type IconName = "overview" | "folder" | "users" | "sales" | "credit" | "settings" | "help" | "shield" | "logout" | "chevron" | "bell" | "plus" | "arrow" | "check" | "more" | "menu" | "close" | "activity" | "image" | "clock" | "sparkles" | "layers" | "external" | "search";

function Icon({ name, size = 19 }: { name: IconName; size?: number }) {
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  let shape: ReactNode;
  switch (name) {
    case "overview": shape = <><rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/></>; break;
    case "folder": shape = <><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 10h18"/></>; break;
    case "users": shape = <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2c0-3 2.5-5 6-5s6 2 6 5v2M16 5a3 3 0 0 1 0 6M18 14c2 .7 3 2 3 4v2"/></>; break;
    case "sales": shape = <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9h16M9 14h6m-3-3v6"/></>; break;
    case "credit": shape = <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h5"/></>; break;
    case "settings": shape = <><path d="M4 7h16M4 17h16"/><circle cx="10" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></>; break;
    case "help": shape = <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 4"/><path d="M12 17h.01"/></>; break;
    case "shield": shape = <><path d="M12 3 20 6v5c0 5-3.5 8.4-8 10-4.5-1.6-8-5-8-10V6Z"/><path d="M12 9v6m-3-3h6"/></>; break;
    case "logout": shape = <><path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5M12 12H3m4-4-4 4 4 4"/></>; break;
    case "chevron": shape = <path d="m9 18 6-6-6-6"/>; break;
    case "bell": shape = <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>; break;
    case "plus": shape = <path d="M12 5v14M5 12h14"/>; break;
    case "arrow": shape = <><path d="M4 12h16m-7-7 7 7-7 7"/></>; break;
    case "external": shape = <><path d="M13 4h7v7M20 4l-9 9"/><path d="M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"/></>; break;
    case "check": shape = <path d="m5 12 4 4L19 6"/>; break;
    case "more": shape = <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>; break;
    case "menu": shape = <path d="M4 7h16M4 12h16M4 17h16"/>; break;
    case "close": shape = <path d="M5 5l14 14M19 5 5 19"/>; break;
    case "activity": shape = <path d="M3 12h4l3-7 4 14 3-7h4"/>; break;
    case "image": shape = <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m5 18 5-5 3 3 3-5 3 7"/></>; break;
    case "clock": shape = <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></>; break;
    case "sparkles": shape = <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3ZM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8L19 17Z"/></>; break;
    case "layers": shape = <><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/></>; break;
    case "search": shape = <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></>; break;
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>{shape}</svg>;
}

type Tab = "projetos" | "galerias";

const meses = ["jun", "jul", "ago", "set", "out", "nov"];
const estatisticas = {
  projetos: {
    titulo: "Total de projetos",
    complemento: "5 projetos no total",
    descricao: "5 criados nos últimos 6 meses",
    meses: [0,0,0,2,1,2],
    total: 5,
    singular: "projeto",
    plural: "projetos",
    etapas: [1,0,0,4,0,0],
  },
  galerias: {
    titulo: "Total de galerias",
    complemento: "12 galerias no total",
    descricao: "12 criadas nos últimos 6 meses",
    meses: [0,0,0,4,3,5],
    total: 12,
    singular: "galeria",
    plural: "galerias",
    etapas: [2,1,1,8,0,0],
  },
} as const;
const etapas = [
  {nome: "Aguardando cliente",cor:"#f49a56"},
  {nome: "Seleção finalizada",cor:"#9984e5"},
  {nome: "Preparando entrega",cor:"#6884ea"},
  {nome: "Entregue",cor:"#51b994"},
  {nome: "Em andamento",cor:"#6bacc6"},
  {nome: "Sem pastas",cor:"#a1a3b2"},
];
const recentes = [
  {nome:"Ensaio de Marina",meta:"Ensaio externo · 1 galeria",estado:"Entregue",classe:"delivered",data:"14 nov"},
  {nome:"Cerimônia & recepção",meta:"Casamento · 3 galerias",estado:"Entregue",classe:"delivered",data:"09 nov"},
  {nome:"Retratos de família",meta:"Ensaio de família · 2 galerias",estado:"Em seleção",classe:"waiting",data:"28 out"},
];

function Sidebar({fechar,avisar}:{fechar:()=>void;avisar:(texto:string)=>void}){
  const primeiro = [{label:"Painel",icone:"overview" as IconName,ativo:true},{label:"Projetos",icone:"folder" as IconName},{label:"Clientes",icone:"users" as IconName},{label:"Vendas",icone:"sales" as IconName}];
  const segundo = [{label:"Planos",icone:"credit" as IconName},{label:"Configurações",icone:"settings" as IconName},{label:"Ajuda e feedback",icone:"help" as IconName}];
  function item(i:{label:string;icone:IconName;ativo?:boolean}){
    return <button type="button" key={i.label} className={"fcp-nav-item"+(i.ativo?" is-current":"")} aria-current={i.ativo?"page":undefined} onClick={()=>{fechar();if(!i.ativo)avisar("Esta prévia mostra apenas a Visão Geral. As outras telas continuam intactas.");}}>
      <Icon name={i.icone} size={19}/><span>{i.label}</span>{i.ativo&&<span className="fcp-nav-glow" aria-hidden="true"/>}
    </button>;
  }
  return <>
    <div className="fcp-side-top">
      <a href="#inicio" className="fcp-wordmark" onClick={fechar} aria-label="Fotura, ir ao início da demonstração"><img src="/favicon.svg" width="31" height="31" alt=""/><span>FOTURA</span></a>
      <div className="fcp-side-overline">ESPAÇO DE TRABALHO</div>
      <nav className="fcp-side-nav" aria-label="Menu ilustrativo do fotógrafo">{primeiro.map(item)}<div className="fcp-nav-separator"/>{segundo.map(item)}</nav>
    </div>
    <div className="fcp-side-bottom">
      <span className="fcp-side-bottom-label">CONTA E ACESSO</span>
      <button type="button" className="fcp-side-admin" onClick={()=>{fechar();avisar("Área de administração não está incluída nesta prévia.");}}><Icon name="shield" size={18}/> Administração <Icon name="chevron" size={15}/></button>
      <a className="fcp-side-exit" href="https://foturax.com.br/pt/dashboard" target="_blank" rel="noopener noreferrer"><Icon name="external" size={17}/> Abrir painel atual</a>
      <div className="fcp-sidebar-footnote">CONCEITO VISUAL / 01</div>
    </div>
  </>;
}

function CartaoCabecalho({numero,titulo,complemento}:{numero:string;titulo:string;complemento?:string}) {
  return <div className="fcp-card-titleline"><div className="fcp-card-titlegroup"><span className="fcp-card-eyebrow">{numero}</span><h3>{titulo}</h3></div>{complemento&&<span className="fcp-card-aside">{complemento}</span>}</div>;
}

export default function DashboardConcept(){
  const [aba,setAba] = useState<Tab>("projetos");
  const [sinoAberto,setSinoAberto] = useState(false);
  const [menuAberto,setMenuAberto] = useState(false);
  const [modal,setModal] = useState(false);
  const [aviso,setAviso] = useState("");
  const dados = estatisticas[aba];
  const maximo = Math.max(1,...dados.meses);
  const totalEtapas = dados.etapas.reduce<number>((a,b)=>a+b,0);
  const cores = dados.etapas.map((n,i)=>n?{peso:100*n/totalEtapas,cor:etapas[i].cor}:null).filter((v):v is {peso:number;cor:string}=>v!==null);
  let acumulado=0;
  const paradas=cores.map(c=>{const inicio=acumulado;acumulado+=c.peso;return c.cor+" "+inicio+"% "+acumulado+"%";}).join(", ");
  const donut = { background: "conic-gradient(" + paradas + ")" };

  useEffect(()=>{if(!aviso)return;const id=window.setTimeout(()=>setAviso(""),4500);return()=>window.clearTimeout(id)},[aviso]);
  useEffect(()=>{
    if(!modal&&!menuAberto)return;
    const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"){setModal(false);setMenuAberto(false)}};
    document.addEventListener("keydown",onKey);
    return()=>document.removeEventListener("keydown",onKey);
  },[modal,menuAberto]);

  return <div className="fcp-preview" id="inicio">
    <div className="fcp-preview-ribbon">
      <span><span className="fcp-ribbon-dot"/> PRÉVIA DE DESIGN <span className="fcp-ribbon-separator">/</span> VISÃO GERAL</span>
      <span className="fcp-ribbon-right">Dados ilustrativos — nenhuma alteração no seu painel</span>
      <a href="https://foturax.com.br/pt/dashboard" target="_blank" rel="noopener noreferrer">Comparar com o painel atual <Icon name="external" size={13}/></a>
    </div>
    {menuAberto&&<button type="button" className="fcp-mobile-backdrop" aria-label="Fechar menu" onClick={()=>setMenuAberto(false)}/>}
    <aside className={"fcp-sidebar"+(menuAberto?" is-open":"")} aria-label="Barra lateral de navegação">
      <Sidebar fechar={()=>setMenuAberto(false)} avisar={setAviso}/>
    </aside>
    <div className="fcp-main">
      <div className="fcp-main-shell">
        <header className="fcp-header">
          <div className="fcp-header-top">
            <button type="button" className="fcp-menu-toggle" aria-label={menuAberto?"Fechar menu":"Abrir menu"} aria-expanded={menuAberto} onClick={()=>setMenuAberto(v=>!v)}><Icon name={menuAberto?"close":"menu"} size={21}/></button>
            <div className="fcp-breadcrumb">PAINEL <span>/</span> VISÃO GERAL</div>
            <div className="fcp-profile-pill"><div className="fcp-avatar"><img src="/favicon.svg" alt=""/></div><div><strong>Estúdio Aurora</strong><span>Conta de demonstração</span></div><Icon name="chevron" size={13}/></div>
          </div>
          <div className="fcp-header-main">
            <div className="fcp-heading">
              <span className="fcp-overline">SEU ESPAÇO DE TRABALHO</span>
              <h1>Sua visão <em>geral.</em></h1>
              <p>Uma visão clara de tudo que acontece no seu estúdio.</p>
            </div>
            <div className="fcp-actions">
              <div className="fcp-storage"><span>ARMAZENAMENTO</span><div><strong>1,46 GB</strong><span>Plano legado</span></div></div>
              <div className="fcp-notif-wrap">
                <button type="button" className="fcp-icon-button" aria-label="Atividade recente" aria-expanded={sinoAberto} onClick={()=>setSinoAberto(v=>!v)}><Icon name="bell" size={19}/><i className="fcp-notif-ping"/></button>
                {sinoAberto&&<div className="fcp-notif-panel" role="status"><div className="fcp-notif-head"><strong>Atividade recente</strong><button type="button" onClick={()=>setSinoAberto(false)} aria-label="Fechar notificações"><Icon name="close" size={16}/></button></div><div className="fcp-notif-entry"><span className="fcp-notif-entry-icon"><Icon name="check" size={16}/></span><div><strong>Uma seleção aguarda o cliente</strong><p>Projeto Retratos de família</p><small>Exemplo demonstrativo</small></div></div></div>}
              </div>
              <button type="button" className="fcp-new-btn" onClick={()=>setModal(true)}><Icon name="plus" size={18}/> Novo projeto <Icon name="arrow" size={17}/></button>
            </div>
          </div>
        </header>

        <section className="fcp-activity-strip" aria-label="Próximas ações">
          <div className="fcp-activity-icon"><Icon name="check" size={20}/></div>
          <div className="fcp-activity-copy"><span>PRÓXIMAS AÇÕES</span><h2>Tudo em dia por aqui.</h2><p>Nenhuma pendência importante no momento. Seus projetos estão organizados.</p></div>
          <div className="fcp-activity-status"><span className="fcp-status-dot"/> Nenhuma ação urgente</div>
        </section>

        <section className="fcp-overview" aria-labelledby="fcp-panorama">
          <div className="fcp-section-header">
            <div><span className="fcp-overline">PANORAMA DO ESTÚDIO</span><h2 id="fcp-panorama">Seu trabalho, em números.</h2></div>
            <div className="fcp-tabs" role="group" aria-label="Visualizar estatísticas de projetos ou galerias">
              <button type="button" aria-pressed={aba==="projetos"} className={aba==="projetos"?"is-active":""} onClick={()=>setAba("projetos")}><Icon name="folder" size={15}/> Projetos</button>
              <button type="button" aria-pressed={aba==="galerias"} className={aba==="galerias"?"is-active":""} onClick={()=>setAba("galerias")}><Icon name="image" size={15}/> Galerias</button>
            </div>
          </div>

          <div className="fcp-charts" key={aba}>
            <article className="fcp-panel fcp-chart-bars" aria-label={dados.titulo}>
              <CartaoCabecalho numero="01 / EVOLUÇÃO" titulo={dados.titulo} complemento={dados.complemento}/>
              <div className="fcp-panel-subhead"><span>{dados.descricao}</span><span>ÚLTIMOS 6 MESES</span></div>
              <div className="fcp-chart-area">
                <div className="fcp-chart-grid" aria-hidden="true"><i/><i/><i/><i/></div>
                <div className="fcp-bars">
                  {dados.meses.map((n,i)=><div className="fcp-bar-column" key={meses[i]} role="img" aria-label={meses[i]+": "+n+" "+(n===1?dados.singular:dados.plural)}>
                    <div className="fcp-bar-space"><div className={"fcp-bar-fill"+(n===0?" is-empty":"")} style={{height:n===0?"3px":(100*n/maximo)+"%"}}><span>{n}</span></div></div>
                    <span className="fcp-bar-month">{meses[i]}</span>
                  </div>)}
                </div>
              </div>
              <div className="fcp-chart-footer"><span><Icon name="activity" size={15}/> Evolução consistente no período</span><span>Jun — Nov</span></div>
            </article>
            <article className="fcp-panel fcp-chart-stages" aria-label={"Etapas "+(aba==="projetos"?"dos projetos":"das galerias")}>
              <CartaoCabecalho numero="02 / DISTRIBUIÇÃO" titulo={"Etapas "+(aba==="projetos"?"dos projetos":"das galerias")}/>
              <div className="fcp-panel-subhead"><span>{aba==="projetos"?"Etapa consolidada de cada projeto":"Etapa de cada galeria"}</span></div>
              <div className="fcp-stages-layout">
                <div className="fcp-donut" style={donut} role="img" aria-label={"Total de "+totalEtapas+" "+dados.plural+". "+etapas.map((e,i)=>e.nome+": "+dados.etapas[i]).join("; ")}>
                  <div className="fcp-donut-hole"><strong>{totalEtapas}</strong><span>{dados.plural}</span></div>
                </div>
                <div className="fcp-legend">
                  {etapas.map((etapa,i)=><div className="fcp-legend-row" key={etapa.nome}><span><i style={{background:etapa.cor}}/>{etapa.nome}</span><strong>{dados.etapas[i]}</strong></div>)}
                </div>
              </div>
              <div className="fcp-chart-footer"><span><Icon name="layers" size={15}/> Visão por etapa</span><span>Atualizado agora</span></div>
            </article>
          </div>
        </section>

        <section className="fcp-lower" aria-labelledby="fcp-activity">
          <div className="fcp-section-header fcp-section-header-lower"><div><span className="fcp-overline">NO DIA A DIA</span><h2 id="fcp-activity">Acompanhe de perto.</h2></div><span className="fcp-section-aside">Acompanhe suas seleções e trabalhos recentes</span></div>
          <div className="fcp-lists">
            <article className="fcp-panel fcp-list-card">
              <div className="fcp-list-head"><div><span className="fcp-card-eyebrow">03 / SELEÇÕES</span><h3>Seleções aguardando cliente</h3><p>1 aguardando conclusão</p></div><button type="button" onClick={()=>setAviso("Nesta prévia, a navegação para Projetos fica desativada.")} className="fcp-text-link">Ver projetos <Icon name="arrow" size={15}/></button></div>
              <div className="fcp-selection-row">
                <div className="fcp-thumb"><img src="/hero/casamento-por-do-sol.webp" alt="Fotografia ilustrativa do projeto"/></div>
                <div className="fcp-project-copy"><strong>Retratos de família</strong><span>Ensaio · Seleção aberta</span></div>
                <span className="fcp-tag waiting">Aguardando</span>
              </div>
              <div className="fcp-list-hint"><Icon name="clock" size={15}/> Aguardando a escolha do cliente</div>
            </article>
            <article className="fcp-panel fcp-list-card">
              <div className="fcp-list-head"><div><span className="fcp-card-eyebrow">04 / RECENTES</span><h3>Projetos recentes</h3><p>Seus últimos trabalhos organizados</p></div><button type="button" className="fcp-text-link" onClick={()=>setAviso("Nesta prévia, a navegação para Projetos fica desativada.")}>Ver projetos <Icon name="arrow" size={15}/></button></div>
              <div className="fcp-recent-list">
                {recentes.map((item,i)=><button type="button" key={item.nome} className="fcp-recent-row" onClick={()=>setAviso("Projeto de exemplo: "+item.nome+". Nenhum dado real foi acessado.")}>
                  <span className="fcp-recent-number">0{i+1}</span><span className="fcp-recent-info"><strong>{item.nome}</strong><small>{item.meta}</small></span><span className={"fcp-tag "+item.classe}>{item.estado}</span><span className="fcp-recent-date">{item.data}</span><Icon name="chevron" size={15}/>
                </button>)}
              </div>
            </article>
          </div>
        </section>
        <footer className="fcp-footer"><span>FOTURA / CONCEITO DE VISÃO GERAL</span><span>Dados fictícios para avaliação visual</span></footer>
      </div>
    </div>

    {modal&&<div className="fcp-modal-layer" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false)}}><div className="fcp-modal" role="dialog" aria-modal="true" aria-labelledby="fcp-modal-title"><button type="button" className="fcp-modal-close" onClick={()=>setModal(false)} aria-label="Fechar janela"><Icon name="close" size={20}/></button><span className="fcp-modal-icon"><Icon name="sparkles" size={26}/></span><span className="fcp-overline">APENAS UMA PRÉVIA</span><h2 id="fcp-modal-title">Um novo visual para o seu espaço.</h2><p>Este protótipo demonstra apenas o design da Visão Geral. Não cria projetos nem altera informações da sua conta.</p><a href="https://foturax.com.br/pt/dashboard/projetos?novo=1" target="_blank" rel="noopener noreferrer" className="fcp-modal-link">Criar projeto no Fotura atual <Icon name="external" size={17}/></a><button type="button" className="fcp-modal-secondary" onClick={()=>setModal(false)}>Continuar avaliando</button></div></div>}
    {aviso&&<div className="fcp-toast" role="status"><Icon name="check" size={17}/>{aviso}<button type="button" aria-label="Dispensar aviso" onClick={()=>setAviso("")}><Icon name="close" size={15}/></button></div>}
  </div>;
}
