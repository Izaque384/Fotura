"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase-client";

const planos = [
  {
    nome: "Essencial",
    preco: "14,90",
    destaque: false,
    itens: ["10 galerias ativas", "20 GB de armazenamento", "1.000 fotos por galeria", "Prova, comentários e branding"],
  },
  {
    nome: "Profissional",
    preco: "29,90",
    destaque: true,
    itens: ["50 galerias ativas", "100 GB de armazenamento", "3.000 fotos por galeria", "Experiência premium do estúdio"],
  },
  {
    nome: "Studio",
    preco: "59,90",
    destaque: false,
    itens: ["Galerias ilimitadas", "500 GB de armazenamento", "5.000 fotos por galeria", "Clientes ilimitados"],
  },
];

function Logo() {
  return (
    <svg viewBox="0 0 115 101" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="logoGrad" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1196fc" />
          <stop offset="1" stopColor="#5d0dfa" />
        </linearGradient>
      </defs>
      <g fill="url(#logoGrad)">
        <path d="M65.5 6.1C60.6 6.6 56.3 8.3 52.5 11.4 51.2 12.4 49.5 14.1 40.1 23.2 36.2 27 31.6 31.5 29.7 33.3 27.8 35.1 24.4 38.4 22.2 40.7 19.9 42.9 16.6 46.1 14.9 47.8 9.3 53.2 8.5 54 7.7 55.1 6.4 57.1 6 58.5 6 60.7 6 62.4 6.1 63 6.8 64.3 7.8 66.3 9.5 67.7 12 68.4 12.9 68.7 12.9 68.7 17 68.7 21.5 68.8 22.3 68.7 24.1 68.2 26.8 67.3 29 66 31.4 63.8 34.4 61 42.6 53.2 43.9 52 44.7 51.2 46.2 49.7 47.4 48.7 50.1 46.1 56.8 39.7 59.1 37.4 60.1 36.4 61.3 35.3 61.7 34.9 64.5 32.6 67.9 31.2 71.5 30.9 72.2 30.8 76.2 30.8 80.4 30.8 85.4 30.9 88.6 30.8 89.3 30.8 92.1 30.5 94.4 29.7 96.7 28.2 97.9 27.3 98.2 27.1 101.4 24.1 106.2 19.7 107 18.8 107.9 16.9 108.7 15.5 108.9 14.4 108.8 12.9 108.7 11 108.3 9.8 107 8.5 106.1 7.5 104.8 6.7 103.2 6.2 102.5 6 102.5 6 84.4 6 74.5 6 65.9 6 65.5 6.1" />
        <path d="M71.3 45.7C68.6 46.1 66 47.4 63.7 49.4 63.1 49.8 59.3 53.4 55 57.5 53.7 58.7 52.2 60.2 51.6 60.8 51 61.3 49.8 62.5 49 63.3 48.2 64.1 47.2 65 46.9 65.3 45.8 66.3 38 73.7 33.1 78.4 30.7 80.8 29.7 81.9 29 83 26.4 87.3 28 92.3 32.5 94.2 34.1 94.8 34.1 94.8 39.3 94.8 43.9 94.8 43.9 94.8 45 94.5 47.6 93.9 49.8 92.7 51.7 91 52.5 90.3 57.4 85.8 61.2 82.1 62.3 81.1 63.9 79.6 64.9 78.6 65.9 77.7 67.3 76.4 68 75.7 68.6 75.1 69.6 74.2 70.1 73.7 74.5 69.6 82.3 62.1 84.5 60 87.5 56.9 88.4 55.4 88.5 52.8 88.6 50.7 88 49.1 86.6 47.7 85.4 46.6 84.2 45.9 82.5 45.6 81.2 45.4 72.8 45.4 71.3 45.7" />
      </g>
    </svg>
  );
}

export default function Home() {
  const supabase = createClient();
  const [logado, setLogado] = useState(false);

  useEffect(() => {
    let ativo = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (ativo) setLogado(Boolean(data.user));
    });
    return () => { ativo = false; };
  }, [supabase]);

  const destinoPrincipal = logado ? "/dashboard" : "/login?modo=cadastro";

  return (
    <div className="lp">
      <style>{`
        *{box-sizing:border-box}.lp{--bg:#0b0b1a;--panel:#121226;--panel2:#0f0f20;--line:#23233c;--muted:#7a7f9a;--text:#f0f0f5;min-height:100vh;color:var(--text);font-family:Sora,sans-serif;background:radial-gradient(760px 420px at 68% 5%,rgba(58,50,224,.20),transparent 68%),radial-gradient(520px 300px at 20% 8%,rgba(17,150,252,.09),transparent 70%),linear-gradient(180deg,#090916 0%,#0d0d1d 46%,#090916 100%);overflow:hidden}.lp:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.22;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:44px 44px;mask-image:linear-gradient(to bottom,#000,transparent 72%)}.lp a{text-decoration:none}.shell{width:min(1080px,calc(100% - 40px));margin:auto}.top{height:68px;display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid rgba(255,255,255,.045)}.brand{display:flex;align-items:center;gap:9px;color:#fff}.brand svg{width:28px;height:25px}.brand strong{font-size:16px;letter-spacing:3px}.nav{display:flex;gap:21px}.nav a{font-size:11px;color:#777e99;transition:.18s}.nav a:hover{color:#fff}.actions{display:flex;gap:8px}.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:39px;padding:0 15px;border-radius:9px;border:1px solid #292a43;color:#d9dcee;background:rgba(255,255,255,.025);font-size:11px;font-weight:700;transition:.18s}.btn:hover{transform:translateY(-1px);border-color:#5055aa;color:#fff}.btn.primary{border:0;color:#fff;background:linear-gradient(90deg,#1196fc,#5d0dfa);box-shadow:0 10px 30px rgba(63,43,223,.22)}.hero{display:grid;grid-template-columns:1fr .94fr;gap:52px;align-items:center;padding:74px 0 68px;position:relative}.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:#939cff}.pulse{width:6px;height:6px;border-radius:50%;background:#8fe3b0;box-shadow:0 0 0 5px rgba(143,227,176,.08),0 0 16px rgba(143,227,176,.6)}.hero h1{font-size:clamp(42px,5.7vw,66px);line-height:1.01;letter-spacing:-3px;margin:17px 0 19px;max-width:620px}.grad{background:linear-gradient(90deg,#27a4ff 12%,#7560ff 62%,#8c43ff);-webkit-background-clip:text;background-clip:text;color:transparent}.hero-copy{max-width:560px;color:#8a91aa;font-size:14px;line-height:1.7;margin:0}.hero-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:27px}.hero-actions .btn{min-height:46px;padding:0 20px;font-size:12px}.micro{display:flex;align-items:center;gap:10px;margin-top:16px;color:#5f6681;font-size:9px}.micro span{color:#8fe3b0}.preview-wrap{position:relative}.preview-wrap:before{content:"";position:absolute;width:270px;height:270px;border-radius:50%;background:rgba(67,50,239,.22);filter:blur(70px);right:-10px;top:50px}.preview{position:relative;padding:1px;border-radius:18px;background:linear-gradient(145deg,rgba(17,150,252,.5),rgba(93,13,250,.30),rgba(255,255,255,.07));box-shadow:0 32px 90px rgba(0,0,0,.42);transform:perspective(1000px) rotateY(-3deg) rotateX(1deg)}.preview-in{border-radius:17px;background:#0b0b19;padding:12px;overflow:hidden}.window{display:flex;align-items:center;gap:5px;height:24px;border-bottom:1px solid #202039}.window i{width:5px;height:5px;border-radius:50%;background:#30314c}.app{display:grid;grid-template-columns:126px 1fr;min-height:365px}.app-side{border-right:1px solid #1e1f36;padding:17px 10px;background:#0b0b19}.app-logo{font-size:8px;letter-spacing:2px;font-weight:800;margin:2px 7px 18px}.app-item{font-size:7px;color:#666d8a;padding:7px 8px;border-radius:6px;margin-bottom:3px}.app-item.on{color:#fff;background:linear-gradient(90deg,rgba(17,150,252,.14),rgba(93,13,250,.1));border:1px solid rgba(77,84,190,.18)}.app-main{padding:18px 17px;background:linear-gradient(180deg,#090917,#0e0e20)}.app-head{display:flex;justify-content:space-between;align-items:flex-end;gap:8px}.app-eyebrow{font-size:5px;letter-spacing:1px;text-transform:uppercase;color:#6f76a0;font-weight:700;margin-bottom:4px}.app-title{font-size:13px;font-weight:700}.app-sub{font-size:5px;color:#5f6681;margin-top:4px}.app-actions{display:flex;gap:5px;align-items:center}.app-bell{width:22px;height:22px;border-radius:6px;border:1px solid #2a2d40;background:#131327;color:#8b91aa;display:grid;place-items:center;font-size:8px}.new{font-size:5px;padding:7px 8px;border-radius:6px;background:linear-gradient(90deg,#1196fc,#5d0dfa);font-weight:700}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:14px}.stat,.mini,.chart-card{border:1px solid #23233c;background:linear-gradient(180deg,#14142b,#101023);border-radius:8px}.stat{padding:9px 8px}.stat b{font-size:14px}.stat span{display:block;font-size:4.6px;color:#8a90a8;margin-top:4px;line-height:1.3}.dash-charts{display:grid;grid-template-columns:1.35fr .85fr;gap:6px;margin-top:6px}.chart-card{padding:9px}.mini-title{font-size:6px;font-weight:700}.mini-sub{font-size:4.5px;color:#666d88;margin-top:3px}.bars{display:flex;align-items:flex-end;gap:5px;height:66px;margin-top:8px;padding:0 3px}.bar{flex:1;display:flex;align-items:flex-end;justify-content:center;height:100%;position:relative}.bar:before{content:"";width:52%;height:2px;border-radius:3px;background:linear-gradient(180deg,#1196fc,#5d0dfa)}.bar span{position:absolute;bottom:-10px;font-size:3.8px;color:#6d748f}.empty-stage{height:74px;display:grid;place-items:center;text-align:center;color:#6f76a0;font-size:5px;line-height:1.5}.dash-lists{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}.mini{padding:9px}.mini-head{display:flex;align-items:center;justify-content:space-between;gap:6px}.mini-link{font-size:4px;color:#8ea7ff}.empty-list{height:46px;display:grid;place-items:center;text-align:center;color:#6f76a0;font-size:4.8px;border:1px dashed #202238;border-radius:6px;margin-top:7px}.strip{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;border:1px solid #202139;border-radius:14px;overflow:hidden;background:#202139;margin-bottom:8px}.strip-item{background:rgba(13,13,29,.94);padding:22px 20px}.strip-kicker{font-size:8px;color:#6973a8;text-transform:uppercase;letter-spacing:1.2px;font-weight:800}.strip-item b{display:block;font-size:13px;margin:8px 0 5px}.strip-item p{margin:0;font-size:9px;line-height:1.55;color:#717893}.section{padding:66px 0}.section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:30px;margin-bottom:28px}.section-label{font-size:9px;color:#707ac0;text-transform:uppercase;letter-spacing:1.5px;font-weight:800}.section h2{font-size:clamp(28px,4vw,40px);line-height:1.08;letter-spacing:-1.7px;margin:8px 0 0}.section-head p{max-width:440px;margin:0;color:#767d98;font-size:11px;line-height:1.65}.flow{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.flow-card{position:relative;padding:21px;border-radius:14px;border:1px solid #22233b;background:linear-gradient(180deg,rgba(20,20,43,.9),rgba(15,15,32,.9))}.flow-n{font-size:8px;color:#6873ba;margin-bottom:18px}.flow-card b{font-size:13px}.flow-card p{font-size:9px;color:#737a95;line-height:1.55;margin:7px 0 0}.pricing{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}.plan{position:relative;padding:21px;border:1px solid #22243d;border-radius:15px;background:linear-gradient(180deg,#14142b,#101023)}.plan.hot{border-color:#535cdb;box-shadow:0 18px 50px rgba(55,51,200,.12)}.popular{position:absolute;top:12px;right:12px;font-size:7px;padding:5px 7px;border-radius:99px;color:#aeb7ff;background:rgba(83,92,219,.12);text-transform:uppercase;letter-spacing:.7px;font-weight:800}.plan h3{font-size:15px;margin:0 0 13px}.price{font-size:28px;font-weight:800;letter-spacing:-1px}.price small{font-size:9px;color:#7a819c;font-weight:500}.per{font-size:8px;color:#626984;margin-top:2px}.plan ul{list-style:none;padding:0;margin:19px 0;display:grid;gap:8px}.plan li{font-size:8px;color:#969db7}.plan li:before{content:"✓";color:#8fe3b0;margin-right:7px}.plan .btn{width:100%;min-height:38px}.faq-wrap{display:grid;grid-template-columns:.72fr 1.28fr;gap:26px;align-items:start}.faq-intro h2{font-size:31px;margin:8px 0 10px}.faq-intro p{font-size:10px;color:#747b96;line-height:1.6;margin:0}.faq{display:grid;gap:7px}.faq details{border:1px solid #202139;background:#101022;border-radius:10px;padding:13px 15px}.faq summary{cursor:pointer;font-size:10px;font-weight:700}.faq p{font-size:9px;line-height:1.65;color:#747c98;margin:9px 0 0}.final{padding:20px 0 64px}.final-card{display:flex;align-items:center;justify-content:space-between;gap:25px;padding:30px 32px;border:1px solid #2b2c4a;border-radius:17px;background:radial-gradient(440px 180px at 15% 0,rgba(17,150,252,.11),transparent 70%),radial-gradient(380px 180px at 88% 100%,rgba(93,13,250,.13),transparent 70%),#111124}.final-card h2{font-size:25px;letter-spacing:-1px;margin:0 0 7px}.final-card p{font-size:9px;color:#737b97;margin:0}.footer{border-top:1px solid #1d1f34}.footer-in{height:72px;display:flex;align-items:center;justify-content:space-between;gap:18px}.footer-links{display:flex;gap:15px}.footer-links a,.copy{font-size:8px;color:#59617c}.footer-links a:hover{color:#fff}@media(max-width:840px){.nav{display:none}.hero{grid-template-columns:1fr;padding-top:56px}.hero-copy{max-width:650px}.preview{max-width:650px;margin:auto}.section-head{align-items:flex-start;flex-direction:column;gap:10px}.pricing{grid-template-columns:1fr 1fr}.pricing .plan:last-child{grid-column:1/-1}.faq-wrap{grid-template-columns:1fr}.section{padding:52px 0}}@media(max-width:600px){.shell{width:min(100% - 28px,1080px)}.actions .btn:first-child{display:none}.top{height:62px}.hero{gap:40px;padding:48px 0 48px}.hero h1{font-size:42px;letter-spacing:-2px}.app{grid-template-columns:1fr}.app-side{display:none}.preview{transform:none}.strip{grid-template-columns:1fr}.strip-item{padding:17px 18px}.flow,.pricing{grid-template-columns:1fr}.pricing .plan:last-child{grid-column:auto}.section{padding:46px 0}.final-card{align-items:flex-start;flex-direction:column;padding:25px}.footer-in{height:auto;padding:24px 0;align-items:flex-start;flex-direction:column}.footer-links{flex-wrap:wrap}}
      `}</style>

      <header className="shell top">
        <a className="brand" href="/" aria-label="Fotura"><Logo/><strong>FOTURA</strong></a>
        <nav className="nav"><a href="#produto">Produto</a><a href="#fluxo">Como funciona</a><a href="#planos">Planos</a><a href="#faq">Dúvidas</a></nav>
        <div className="actions"><a className="btn" href={logado ? "/dashboard" : "/login"}>{logado ? "Painel" : "Entrar"}</a><a className="btn primary" href={destinoPrincipal}>{logado ? "Abrir Fotura" : "Criar conta"}</a></div>
      </header>

      <main>
        <section className="shell hero" id="produto">
          <div>
            <div className="eyebrow"><span className="pulse"/>Galerias profissionais para fotógrafos</div>
            <h1>Seu trabalho merece uma <span className="grad">entrega premium.</span></h1>
            <p className="hero-copy">Crie galerias, envie fotos, receba seleções e entregue ao cliente com uma experiência elegante, rápida e com a sua marca.</p>
            <div className="hero-actions"><a className="btn primary" href={destinoPrincipal}>{logado ? "Ir para o painel" : "Começar agora"}<span>→</span></a><a className="btn" href="#fluxo">Ver como funciona</a></div>
            <div className="micro"><span>●</span> A partir de R$ 14,90/mês · cancele quando quiser</div>
          </div>

          <div className="preview-wrap" aria-label="Prévia de uma conta recém-criada no Fotura">
            <div className="preview">
              <div className="preview-in">
                <div className="window"><i/><i/><i/></div>
                <div className="app">
                  <aside className="app-side">
                    <div className="app-logo">FOTURA</div>
                    <div className="app-item on">Painel</div>
                    <div className="app-item">Galerias</div>
                    <div className="app-item">Seleções</div>
                    <div className="app-item">Clientes</div>
                    <div className="app-item">Configurações</div>
                  </aside>
                  <div className="app-main">
                    <div className="app-head">
                      <div>
                        <div className="app-eyebrow">Painel</div>
                        <div className="app-title">Sua visão geral</div>
                        <div className="app-sub">Comece criando sua primeira galeria.</div>
                      </div>
                      <div className="app-actions"><span className="app-bell">⌁</span><span className="new">+ Nova galeria</span></div>
                    </div>

                    <div className="stats">
                      <div className="stat"><b>0</b><span>Total de galerias</span></div>
                      <div className="stat"><b>0</b><span>Seleções aguardando conclusão</span></div>
                      <div className="stat"><b>0</b><span>Seleções finalizadas</span></div>
                      <div className="stat"><b>0</b><span>Galerias expirando em 7 dias</span></div>
                    </div>

                    <div className="dash-charts">
                      <div className="chart-card">
                        <div className="mini-title">Galerias por mês</div>
                        <div className="mini-sub">0 criadas nos últimos 6 meses</div>
                        <div className="bars">
                          <div className="bar"><span>abr</span></div><div className="bar"><span>mai</span></div><div className="bar"><span>jun</span></div><div className="bar"><span>jul</span></div><div className="bar"><span>ago</span></div><div className="bar"><span>set</span></div>
                        </div>
                      </div>
                      <div className="chart-card">
                        <div className="mini-title">Etapas das galerias</div>
                        <div className="mini-sub">Da prova à entrega final</div>
                        <div className="empty-stage">Nenhuma galeria<br/>criada ainda.</div>
                      </div>
                    </div>

                    <div className="dash-lists">
                      <div className="mini">
                        <div className="mini-head"><div className="mini-title">Seleções aguardando cliente</div><span className="mini-link">Ver todas</span></div>
                        <div className="empty-list">Nenhuma seleção em andamento.</div>
                      </div>
                      <div className="mini">
                        <div className="mini-head"><div className="mini-title">Últimas galerias</div><span className="mini-link">Ver todas</span></div>
                        <div className="empty-list">Nenhuma galeria criada ainda.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="shell strip" aria-label="Principais benefícios">
          <div className="strip-item"><span className="strip-kicker">01 · Prova</span><b>Seleção sem confusão</b><p>Favoritas e comentários direto na galeria.</p></div>
          <div className="strip-item"><span className="strip-kicker">02 · Marca</span><b>Sua identidade na entrega</b><p>Uma experiência profissional, não uma pasta genérica.</p></div>
          <div className="strip-item"><span className="strip-kicker">03 · Gestão</span><b>Tudo no mesmo painel</b><p>Galerias, clientes e seleções organizados.</p></div>
        </section>

        <section className="section" id="fluxo"><div className="shell"><div className="section-head"><div><div className="section-label">Fluxo Fotura</div><h2>Do upload à entrega.<br/>Sem ruído.</h2></div><p>Menos mensagens soltas, links improvisados e confirmações manuais. O cliente sabe o que fazer e você acompanha tudo.</p></div><div className="flow"><article className="flow-card"><div className="flow-n">01 / CRIAR</div><b>Monte a galeria</b><p>Defina cliente, prova, limite, prazo e proteção.</p></article><article className="flow-card"><div className="flow-n">02 / COMPARTILHAR</div><b>Envie um único link</b><p>O cliente visualiza, seleciona e comenta sem cadastro.</p></article><article className="flow-card"><div className="flow-n">03 / ENTREGAR</div><b>Finalize com clareza</b><p>Receba a seleção e disponibilize o trabalho final.</p></article></div></div></section>

        <section className="section" id="planos"><div className="shell"><div className="section-head"><div><div className="section-label">Planos</div><h2>Comece leve.<br/>Escale quando precisar.</h2></div><p>Os três planos mantêm o fluxo central do Fotura. O que muda é o volume disponível para sua operação.</p></div><div className="pricing">{planos.map((p)=><article className={`plan${p.destaque?" hot":""}`} key={p.nome}>{p.destaque&&<span className="popular">Mais indicado</span>}<h3>{p.nome}</h3><div className="price"><small>R$ </small>{p.preco}</div><div className="per">por mês</div><ul>{p.itens.map(item=><li key={item}>{item}</li>)}</ul><a className={`btn${p.destaque?" primary":""}`} href={destinoPrincipal}>Escolher {p.nome}</a></article>)}</div></div></section>

        <section className="section" id="faq"><div className="shell faq-wrap"><div className="faq-intro"><div className="section-label">Dúvidas</div><h2>O essencial, antes de começar.</h2><p>Sem letras miúdas no fluxo principal.</p></div><div className="faq"><details><summary>Meu cliente precisa criar uma conta?</summary><p>Não. Ele acessa a galeria pelo link enviado por você e, quando necessário, informa apenas a senha da galeria.</p></details><details><summary>Posso usar o Fotura para prova de fotos?</summary><p>Sim. Você pode habilitar seleção, definir limite de favoritas e receber comentários por foto.</p></details><details><summary>Minha marca aparece na experiência?</summary><p>Sim. O Fotura permite personalizar a apresentação do estúdio e manter sua identidade no centro da entrega.</p></details><details><summary>Posso cancelar quando quiser?</summary><p>Sim. A assinatura é gerenciada pelo portal de cobrança e pode ser cancelada para o fim do período vigente.</p></details></div></div></section>

        <section className="shell final"><div className="final-card"><div><h2>Sua fotografia é profissional.<br/>Sua entrega também pode ser.</h2><p>Organize o fluxo e eleve a experiência de quem recebe seu trabalho.</p></div><a className="btn primary" href={destinoPrincipal}>{logado ? "Abrir meu painel" : "Criar minha conta"}<span>→</span></a></div></section>
      </main>

      <footer className="footer"><div className="shell footer-in"><a className="brand" href="/"><Logo/><strong>FOTURA</strong></a><div className="footer-links"><a href="/termos">Termos</a><a href="/privacidade">Privacidade</a><a href="/login">Entrar</a></div><div className="copy">© {new Date().getFullYear()} Fotura</div></div></footer>
    </div>
  );
}
