"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { PLANOS_FOTURA, type PlanoCodigo } from "../../lib/billing-plans";
import { approvedMonthlyPrice, formatPricingAmount, type PricingCurrency } from "../../lib/pricing-markets";
import "./concept.css";

type Etapa = 0 | 1 | 2;

const imagens = [
  "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1759308730169-9156cb9fe8fe?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1780291116326-36096428e499?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1777312379304-e958accc0fa9?auto=format&fit=crop&w=1200&q=85",
] as const;

const etapas = [
  {
    titulo: "Organize os projetos",
    subtitulo: "Seu trabalho em um só lugar",
    descricao: "Reúna as galerias de cada trabalho, organize as fotografias e compartilhe um único endereço com o cliente.",
    detalhe: "Um projeto. Todas as galerias.",
  },
  {
    titulo: "Receba as escolhas",
    subtitulo: "O cliente participa com facilidade",
    descricao: "Seu cliente escolhe as favoritas e pode comentar nas imagens, sem precisar criar uma conta.",
    detalhe: "Seleção e comentários no próprio link.",
  },
  {
    titulo: "Entregue com sua marca",
    subtitulo: "A apresentação também importa",
    descricao: "Publique a entrega final em uma galeria preparada para visualizar e baixar as fotografias, sem controles de seleção.",
    detalhe: "A experiência termina tão bem quanto começou.",
  },
] as const;

const beneficios: Array<{numero:string;titulo:string;descricao:string;tipo:string}> = [
  {numero:"01",titulo:"Sua identidade, em cada galeria.",descricao:"Nome, marca e apresentação personalizados para que o cliente reconheça o seu estúdio.",tipo:"brand"},
  {numero:"02",titulo:"Escolhas sem mensagens perdidas.",descricao:"Seleção, comentários e organização dentro do projeto, com o histórico à disposição do fotógrafo.",tipo:"select"},
  {numero:"03",titulo:"Uma entrega feita para ser vista.",descricao:"As fotos finais em uma galeria bonita, responsiva e pronta para compartilhar ou baixar.",tipo:"delivery"},
];

const codigosPlanos = ["gratis","essencial","profissional","studio"] as const satisfies readonly PlanoCodigo[];
const detalhesPlanos: Record<(typeof codigosPlanos)[number], {rotulo:string;descricao:string;beneficios:string[]}> = {
  gratis:{
    rotulo:"Para começar",
    descricao:"Conheça o Fotura com trabalhos reais.",
    beneficios:["Crie projetos, galerias e cadastre clientes sem limite de quantidade","Seleção de fotos, comentários e proteção por senha","Seu logo e suas cores na galeria e na prévia do link no WhatsApp"],
  },
  essencial:{
    rotulo:"Mais personalidade",
    descricao:"Sua marca desde a abertura da galeria.",
    beneficios:["Tudo o que está no plano Grátis","Capa de abertura com nome, logo e cores do estúdio","Uma apresentação mais personalizada para seus clientes"],
  },
  profissional:{
    rotulo:"Mais indicado",
    descricao:"Para elevar a apresentação do seu trabalho.",
    beneficios:["Tudo do Essencial","Escolha entre três estilos de capa de abertura","Use uma foto do projeto como fundo da capa"],
  },
  studio:{
    rotulo:"Mais espaço",
    descricao:"Para operações com mais fotografias.",
    beneficios:["Tudo do Profissional","Mais espaço para guardar e entregar fotografias","Ideal para quem gerencia muitos trabalhos"],
  },
};

const perguntas = [
  {pergunta:"Meu cliente precisa criar uma conta?",resposta:"Não. Ele acessa pelo link enviado por você e, quando necessário, informa apenas a senha da galeria."},
  {pergunta:"O cliente pode selecionar as fotografias?",resposta:"Sim. Ele pode escolher favoritas, deixar comentários e concluir a seleção. Na entrega final, os controles de seleção deixam de aparecer."},
  {pergunta:"Posso usar a identidade visual do meu estúdio?",resposta:"Sim. A personalização de marca está disponível, e as opções de capa de abertura variam conforme o plano."},
  {pergunta:"Qual a diferença entre armazenamento e envio mensal?",resposta:"O armazenamento é o espaço total das fotos guardadas. O envio mensal é a quantidade de novas fotos que você pode adicionar a cada mês."},
  {pergunta:"Posso cancelar quando quiser?",resposta:"Sim. Você pode cancelar quando quiser, e seu plano permanece ativo até o fim do período já contratado."},
] as const;

function Seta({diagonal=false}:{diagonal?:boolean}) {
  return <span className="fnc-arrow" aria-hidden="true">{diagonal?"↗":"→"}</span>;
}

function Logo({invertido=false}:{invertido?:boolean}) {
  return <a className={"fnc-brand"+(invertido?" is-inverted":"")} href="#inicio" aria-label="Fotura, voltar ao início">
    <img src="/favicon.svg" width="27" height="27" alt="" />
    <span>fotura<span className="fnc-brand-dot">.</span></span>
  </a>;
}

function JanelaDemonstracao({etapa}:{etapa:Etapa}) {
  return <div className="fnc-window" aria-live="off">
    <div className="fnc-window-top">
      <div className="fnc-window-dots" aria-hidden="true"><i/><i/><i/></div>
      <div className="fnc-window-path"><span>fotura</span><span aria-hidden="true">/</span><span>marina-e-pedro</span></div>
      <span className="fnc-window-mode">DEMONSTRAÇÃO</span>
    </div>
    <div className="fnc-window-body">
      <aside className="fnc-window-sidebar" aria-label="Navegação ilustrativa">
        <div className="fnc-window-logo">f<span>.</span></div>
        <div className="fnc-window-nav">
          <span className="fnc-window-nav-line">⌗</span>
          <span className="fnc-window-nav-line is-current">▦</span>
          <span className="fnc-window-nav-line">♙</span>
          <span className="fnc-window-nav-line">≡</span>
        </div>
        <span className="fnc-window-avatar">F</span>
      </aside>
      <div className="fnc-window-workspace">
        <div className="fnc-window-breadcrumb">Projetos <span>/</span> Casamento Marina &amp; Pedro</div>
        <div className="fnc-window-heading">
          <div>
            <span className="fnc-window-eyebrow">ESPAÇO DE TRABALHO</span>
            <strong>Marina &amp; Pedro</strong>
          </div>
          <span className="fnc-window-action">Compartilhar <Seta diagonal/></span>
        </div>
        <div className="fnc-window-mini-tabs" aria-hidden="true">
          <span className={etapa===0?"on":""}>Galerias</span>
          <span className={etapa===1?"on":""}>Seleção</span>
          <span className={etapa===2?"on":""}>Entrega</span>
        </div>
        <div className="fnc-window-scene" key={etapa}>
          {etapa===0 && <div className="fnc-mock-projects">
            <div className="fnc-mock-summary">
              <div><small>03</small><span>Galerias</span></div>
              <div><small>492</small><span>Fotografias</span></div>
              <div><small>24</small><span>Selecionadas</span></div>
            </div>
            <div className="fnc-mock-list-title"><strong>Galerias do projeto</strong><span>03 publicadas</span></div>
            {[
              {nome:"Making of",qtd:"86 fotografias",imagem:3,estado:"Seleção aberta"},
              {nome:"Cerimônia",qtd:"242 fotografias",imagem:0,estado:"Seleção concluída"},
              {nome:"Recepção",qtd:"164 fotografias",imagem:2,estado:"Entrega publicada"},
            ].map(item=><div className="fnc-mock-row" key={item.nome}>
              <img src={imagens[item.imagem]} alt="" loading="lazy" />
              <div className="fnc-mock-row-info"><strong>{item.nome}</strong><span>{item.qtd}</span></div>
              <span className="fnc-mock-row-state">{item.estado}</span><span className="fnc-mock-chevron" aria-hidden="true">↗</span>
            </div>)}
            <div className="fnc-mock-bottom">Tudo organizado em um único projeto <span>↗</span></div>
          </div>}
          {etapa===1 && <div className="fnc-mock-selection">
            <div className="fnc-mock-selection-top">
              <div><span>GALERIA · CERIMÔNIA</span><strong>Escolha suas favoritas.</strong></div>
              <span className="fnc-mock-selection-pill">03 de 24 selecionadas</span>
            </div>
            <div className="fnc-mock-photo-grid">
              {[0,1,2,3,4,0].map((image,index)=><div className="fnc-mock-photo" key={index}>
                <img src={imagens[image]} loading="lazy" alt="" />
                <span className={"fnc-mock-photo-check"+([0,2,4].includes(index)?" checked":"")}>{[0,2,4].includes(index)?"✓":""}</span>
              </div>)}
            </div>
            <div className="fnc-mock-selection-footer"><span>O cliente seleciona e comenta no próprio link.</span><strong>Finalizar seleção <Seta/></strong></div>
          </div>}
          {etapa===2 && <div className="fnc-mock-delivery">
            <div className="fnc-mock-delivery-head"><span className="fnc-live-dot"/> ENTREGA FINAL PUBLICADA</div>
            <div className="fnc-mock-delivery-card">
              <img src={imagens[0]} alt="Demonstração de fotografia de casamento entregue" loading="lazy" />
              <div className="fnc-mock-delivery-copy">
                <small>GALERIA · CERIMÔNIA</small>
                <strong>Os melhores momentos, para guardar.</strong>
                <span>Fotografias finais disponíveis para visualização e download.</span>
                <span className="fnc-mock-delivery-link">Ver galeria <Seta diagonal/></span>
              </div>
            </div>
            <div className="fnc-mock-delivery-footer"><span>✓ Entrega publicada</span><span>Um único link para compartilhar</span></div>
          </div>}
        </div>
      </div>
    </div>
  </div>;
}

export default function ConceptClient({currency}:{currency:PricingCurrency}) {
  const [etapa,setEtapa]=useState<Etapa>(0);
  const [videoAberto,setVideoAberto]=useState(false);
  useEffect(()=>{
    if(!videoAberto)return;
    const fechar=(event:globalThis.KeyboardEvent)=>{if(event.key==="Escape")setVideoAberto(false)};
    document.addEventListener("keydown",fechar);
    return()=>document.removeEventListener("keydown",fechar);
  },[videoAberto]);

  function navegarEtapas(event:KeyboardEvent<HTMLButtonElement>,indice:Etapa){
    let proximo:number|undefined;
    if(event.key==="ArrowRight"||event.key==="ArrowDown")proximo=(indice+1)%3;
    else if(event.key==="ArrowLeft"||event.key==="ArrowUp")proximo=(indice+2)%3;
    else if(event.key==="Home")proximo=0;
    else if(event.key==="End")proximo=2;
    if(proximo===undefined)return;
    event.preventDefault();
    setEtapa(proximo as Etapa);
    document.getElementById("fnc-tab-"+proximo)?.focus();
  }

  return <div className="fconcept" id="inicio">
    <div className="fnc-preview-banner"><span><span className="fnc-preview-pulse"/> CONCEITO VISUAL 01 <span className="fnc-banner-hide">· PRÉVIA PARA APROVAÇÃO</span></span><a href="https://foturax.com.br/pt" target="_blank" rel="noopener noreferrer">Comparar com a LP atual <Seta diagonal/></a></div>
    <header className="fnc-header">
      <div className="fnc-shell fnc-header-inner">
        <Logo />
        <nav className="fnc-nav" aria-label="Navegação da demonstração">
          <a href="#experimente">Experimente</a>
          <a href="#experiencia">A experiência</a>
          <a href="#planos">Planos</a>
          <a href="#duvidas">Dúvidas</a>
        </nav>
        <a className="fnc-header-cta" href="#experimente">Conhecer o Fotura <Seta/></a>
      </div>
    </header>

    <main>
      <section className="fnc-hero" aria-labelledby="fnc-title">
        <div className="fnc-hero-halo" aria-hidden="true"/>
        <div className="fnc-shell fnc-hero-inner">
          <div className="fnc-hero-copy">
            <span className="fnc-eyebrow"><span className="fnc-eyebrow-mark"/> FEITO PARA QUEM VIVE DE FOTOGRAFIA</span>
            <h1 id="fnc-title">Sua fotografia merece uma <em>entrega à altura.</em></h1>
            <p>A experiência do seu cliente não termina no ensaio. Apresente seu trabalho, receba escolhas e entregue cada imagem com o cuidado que ela merece.</p>
            <div className="fnc-hero-actions">
              <a className="fnc-btn fnc-btn-primary" href="#experimente">Conhecer a experiência <Seta/></a>
              <a className="fnc-btn fnc-btn-quiet" href="#planos">Explorar os planos <Seta diagonal/></a>
            </div>
            <div className="fnc-hero-note"><span className="fnc-note-line"/> Um único link, do primeiro contato à entrega final.</div>
          </div>
          <div className="fnc-hero-presentation">
            <div className="fnc-hero-presentation-top"><span>O OLHAR DE QUEM FOTOGRAFA.</span><span>01 / 03</span></div>
            <div className="fnc-hero-photo"><img src="/hero/casamento-por-do-sol.webp" alt="Casal fotografado durante o pôr do sol" fetchPriority="high" />
              <div className="fnc-hero-photo-overlay">
                <span>STUDIO AURORA — MARINA &amp; PEDRO</span>
                <strong>Momentos que ficam.</strong>
                <span>Galeria de entrega · prévia ilustrativa</span>
              </div>
            </div>
            <div className="fnc-hero-float"><span className="fnc-float-symbol">✓</span><div><strong>Entrega publicada</strong><span>Pronta para compartilhar</span></div><span className="fnc-float-arrow">↗</span></div>
            <div className="fnc-hero-presentation-caption"><span>01 — CRIAR</span><span>02 — SELECIONAR</span><span>03 — ENTREGAR</span></div>
          </div>
        </div>
      </section>

      <div className="fnc-separator" aria-hidden="true"><span>UMA EXPERIÊNCIA PENSADA EM CADA DETALHE</span><span className="fnc-separator-line"/></div>

      <section className="fnc-interactive-section" id="experimente" aria-labelledby="fnc-demo-title">
        <div className="fnc-shell">
          <div className="fnc-section-head">
            <div><span className="fnc-overline">O PRODUTO EM AÇÃO</span><h2 id="fnc-demo-title">Veja como tudo <em>se conecta.</em></h2></div>
            <p>Do projeto à última fotografia entregue, cada etapa tem seu lugar. Explore uma demonstração visual do fluxo do Fotura.</p>
          </div>
          <div className="fnc-demo-layout">
            <div className="fnc-demo-controls" role="tablist" aria-label="Etapas da demonstração">
              {etapas.map((item,index)=><button
                type="button"
                role="tab"
                id={"fnc-tab-"+index}
                aria-selected={etapa===index}
                aria-controls="fnc-demo-panel"
                key={item.titulo}
                tabIndex={etapa===index?0:-1}
                onClick={()=>setEtapa(index as Etapa)}
                onKeyDown={event=>navegarEtapas(event,index as Etapa)}
                className={"fnc-demo-step"+(etapa===index?" is-active":"")}
              >
                <span className="fnc-demo-step-index">0{index+1}</span>
                <span className="fnc-demo-step-main"><strong>{item.titulo}</strong><small>{item.subtitulo}</small></span>
                <span className="fnc-demo-step-arrow" aria-hidden="true">↗</span>
              </button>)}
              <div className="fnc-demo-aside"><span className="fnc-live-dot"/><span>{etapas[etapa].detalhe}</span></div>
            </div>
            <div className="fnc-demo-window-wrap" id="fnc-demo-panel" role="tabpanel" aria-labelledby={"fnc-tab-"+etapa} tabIndex={0}>
              <JanelaDemonstracao etapa={etapa}/>
            </div>
          </div>
          <p className="fnc-demo-disclaimer">Demonstração visual ilustrativa. A aparência e os dados dos projetos exibidos são fictícios.</p>
        </div>
      </section>

      <section className="fnc-story-section" id="experiencia" aria-labelledby="fnc-story-title">
        <div className="fnc-shell fnc-story-grid">
          <div className="fnc-story-copy">
            <span className="fnc-overline fnc-overline-light">MAIS DO QUE UM LINK</span>
            <h2 id="fnc-story-title">Antes das fotos, <em>uma história.</em></h2>
            <p>A abertura da galeria pode apresentar um vídeo, uma sequência de fotografias e a identidade do seu estúdio. Um primeiro encontro com o trabalho que você criou.</p>
            <div className="fnc-story-points"><span>01 / ABERTURA PERSONALIZADA</span><span>02 / MARCA DO ESTÚDIO</span><span>03 / EXPERIÊNCIA DO CLIENTE</span></div>
            <button type="button" className="fnc-btn fnc-btn-light" onClick={()=>setVideoAberto(true)}>Assistir à prévia em vídeo <span aria-hidden="true">▶</span></button>
          </div>
          <button className="fnc-story-visual" type="button" onClick={()=>setVideoAberto(true)} aria-label="Assistir à demonstração em vídeo">
            <img src="/media/fotura-abertura-poster.jpg" alt="Prévia visual da abertura cinematográfica" loading="lazy"/>
            <span className="fnc-story-play" aria-hidden="true">▶</span>
            <span className="fnc-story-visual-label">PRÉVIA CINEMATOGRÁFICA <span>↗</span></span>
          </button>
        </div>
      </section>

      <section className="fnc-benefits" aria-labelledby="fnc-benefits-title">
        <div className="fnc-shell">
          <div className="fnc-benefits-head"><span className="fnc-overline">SIMPLES PARA VOCÊ. ESPECIAL PARA O CLIENTE.</span><h2 id="fnc-benefits-title">O cuidado está <em>nos detalhes.</em></h2></div>
          <div className="fnc-benefit-grid">
            {beneficios.map(item=><article className={"fnc-benefit fnc-benefit-"+item.tipo} key={item.numero}>
              <span className="fnc-benefit-num">{item.numero} / 03</span>
              {item.tipo==="brand"&&<div className="fnc-benefit-art fnc-benefit-art-brand"><img src={imagens[1]} alt="" loading="lazy"/><div className="fnc-benefit-art-label">ESTÚDIO AURORA <span>↗</span></div></div>}
              {item.tipo==="select"&&<div className="fnc-benefit-art fnc-benefit-art-select"><img src={imagens[2]} alt="" loading="lazy"/><span className="fnc-art-tick">✓</span><span className="fnc-art-caption">Favorita selecionada</span></div>}
              {item.tipo==="delivery"&&<div className="fnc-benefit-art fnc-benefit-art-delivery"><img src={imagens[3]} alt="" loading="lazy"/><div><span>✓</span><strong>Entrega disponível</strong></div></div>}
              <h3>{item.titulo}</h3><p>{item.descricao}</p>
            </article>)}
          </div>
        </div>
      </section>

      <section className="fnc-pricing" id="planos" aria-labelledby="fnc-pricing-title">
        <div className="fnc-shell">
          <div className="fnc-section-head fnc-pricing-head">
            <div><span className="fnc-overline">PLANOS PARA CADA MOMENTO</span><h2 id="fnc-pricing-title">Comece grátis. <em>Cresça no seu ritmo.</em></h2></div>
            <p>O mesmo Fotura, com espaço e opções de personalização para acompanhar sua rotina. Preços e recursos preservados da landing atual.</p>
          </div>
          <div className="fnc-plans">
            {codigosPlanos.map(codigo=>{
              const plano=PLANOS_FOTURA[codigo],detalhe=detalhesPlanos[codigo],recomendado=codigo==="profissional";
              const valor=codigo==="gratis"?0:(approvedMonthlyPrice(codigo,currency)??0);
              return <article className={"fnc-plan"+(recomendado?" is-featured":"")} key={codigo}>
                <div className="fnc-plan-topline"><span>{detalhe.rotulo}</span>{recomendado&&<span className="fnc-plan-featured">ESCOLHA POPULAR</span>}</div>
                <h3>{plano.nome}</h3><p className="fnc-plan-desc">{detalhe.descricao}</p>
                <div className="fnc-plan-amount"><strong>{formatPricingAmount(valor,currency,"pt")}</strong><span>/ mês</span></div>
                <a className={"fnc-plan-button"+(recomendado?" is-featured":"")} href="/pt/login?modo=cadastro">Escolher {plano.nome} <Seta/></a>
                <div className="fnc-plan-separator"/>
                <ul>
                  <li>{plano.limites.armazenamentoGb} GB para guardar fotos</li>
                  {detalhe.beneficios.map(texto=><li key={texto}>{texto}</li>)}
                  <li>Envie até {plano.limites.uploadMensalGb?.toLocaleString("pt-BR")} GB de fotos por mês</li>
                  <li>{plano.recursos.envioEmail?"Convites e avisos de entrega por e-mail":"Compartilhe por link; e-mails exigem plano pago"}</li>
                </ul>
              </article>;
            })}
          </div>
          <p className="fnc-pricing-note">Valores apresentados conforme o país detectado, utilizando a mesma tabela de preços do Fotura em produção.</p>
        </div>
      </section>

      <section className="fnc-faq" id="duvidas" aria-labelledby="fnc-faq-title">
        <div className="fnc-shell fnc-faq-layout">
          <div><span className="fnc-overline">O ESSENCIAL</span><h2 id="fnc-faq-title">Perguntas, <em>respondidas.</em></h2><p>Uma experiência simples para fotógrafos e clientes começa com informações claras.</p></div>
          <div className="fnc-faq-list">
            {perguntas.map(item=><details key={item.pergunta}><summary>{item.pergunta}<span aria-hidden="true">+</span></summary><p>{item.resposta}</p></details>)}
          </div>
        </div>
      </section>

      <section className="fnc-last-cta" aria-labelledby="fnc-last-title"><div className="fnc-shell fnc-last-inner">
        <div><span className="fnc-overline fnc-overline-light">FOTURA · FOTOGRAFIA BEM APRESENTADA</span><h2 id="fnc-last-title">A imagem é sua. <em>A experiência também.</em></h2></div>
        <a className="fnc-btn fnc-btn-light" href="/pt/login?modo=cadastro">Criar galeria grátis <Seta/></a>
      </div></section>
    </main>

    <footer className="fnc-footer"><div className="fnc-shell fnc-footer-content"><Logo/><p>Uma maneira especial de apresentar, selecionar e entregar fotografias.</p><div className="fnc-footer-links"><a href="https://foturax.com.br/pt" target="_blank" rel="noopener noreferrer">LP atual <Seta diagonal/></a><a href="/pt/termos">Termos</a><a href="/pt/privacidade">Privacidade</a></div></div><div className="fnc-shell fnc-footer-bottom"><span>© {new Date().getFullYear()} Fotura. Prévia de conceito — não publicada em produção.</span><span>Fotografias demonstrativas.</span></div></footer>

    {videoAberto&&<div className="fnc-video-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setVideoAberto(false)}}><div className="fnc-video-dialog" role="dialog" aria-modal="true" aria-label="Prévia de abertura em vídeo"><div className="fnc-video-dialog-header"><span>PRÉVIA DO FOTURA</span><button type="button" autoFocus onClick={()=>setVideoAberto(false)} aria-label="Fechar vídeo">✕</button></div><video controls autoPlay playsInline poster="/media/fotura-abertura-poster.jpg" src="/media/fotura-abertura-web-720p.mp4"/><p>Prévia ilustrativa utilizando o vídeo de apresentação do Fotura.</p></div></div>}
  </div>;
}
