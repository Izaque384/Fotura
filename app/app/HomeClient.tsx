"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase-client";
import { registrarEventoProduto, utmAtual } from "../lib/product-analytics";
import "./landing-editorial.css";
import LanguageSwitcher from "./components/LanguageSwitcher";
import LandingCinematicShowcase from "./components/LandingCinematicShowcase";
import { useI18n } from "./components/I18nProvider";
import { withLocalePath } from "../lib/i18n";
import { approvedMonthlyPrice, formatPricingAmount, type PricingCurrency } from "../lib/pricing-markets";
import { PLANOS_FOTURA, type PlanoCodigo } from "../lib/billing-plans";

const codigosPlanos=["gratis","essencial","profissional","studio"] as const satisfies readonly PlanoCodigo[];
const extrasPlano:Record<(typeof codigosPlanos)[number],string[]>={
  gratis:["Projetos, pastas, clientes e fotos sem limite por quantidade","Seleção, comentários, senha e entrega","Logo, cor e Open Graph com a marca do fotógrafo"],
  essencial:["Projetos, pastas, clientes e fotos sem limite por quantidade","Hero Minimal com logo, nome e cor","Seleção, comentários, senha e entrega"],
  profissional:["Tudo do Essencial","Heroes Minimal, Premium e Tech","Foto do projeto no fundo do hero"],
  studio:["Tudo do Profissional","Mesmos recursos visuais do Profissional","Para operações com alto volume"],
};
const planos=codigosPlanos.map(codigo=>{
  const plano=PLANOS_FOTURA[codigo];
  return{
    codigo,
    nome:plano.nome,
    destaque:codigo==="profissional",
    uploadMensalGb:plano.limites.uploadMensalGb,
    envioEmail:plano.recursos.envioEmail,
    itens:[`${plano.limites.armazenamentoGb} GB de armazenamento`,...extrasPlano[codigo]],
  };
});

const fotosHero = [
  {
    url: "https://images.unsplash.com/photo-1759308730169-9156cb9fe8fe?auto=format&fit=crop&w=1600&q=88",
    label: "Casamentos",
  },
  {
    url: "https://images.unsplash.com/photo-1741940365437-e55b919a89d3?auto=format&fit=crop&w=1400&q=88",
    label: "Famílias",
  },
  {
    url: "https://images.unsplash.com/photo-1774708053382-f1d453ea5dc9?auto=format&fit=crop&w=1400&q=88",
    label: "Retratos",
  },
  {
    url: "https://images.unsplash.com/photo-1790926075510-72557dfa0b0f?auto=format&fit=crop&w=1600&q=88",
    label: "Eventos",
  },
  {
    url: "https://images.unsplash.com/photo-1777728091201-cce6045e078f?auto=format&fit=crop&w=1400&q=88",
    label: "Histórias",
  },
  {
    url: "https://images.unsplash.com/photo-1694030505309-5fcfc3d58653?auto=format&fit=crop&w=1600&q=88",
    label: "Autorais",
  },
  {
    url: "https://images.unsplash.com/photo-1773188536669-17275a1c200c?auto=format&fit=crop&w=1400&q=88",
    label: "Retratos",
  },
  {
    url: "https://images.unsplash.com/photo-1769412954921-1474a34e8049?auto=format&fit=crop&w=1400&q=88",
    label: "Famílias",
  },
  {
    url: "https://images.unsplash.com/photo-1763631045896-04d2e60048ae?auto=format&fit=crop&w=1600&q=88",
    label: "Famílias",
  },
];

const fotosGaleria = [
  { url: "https://images.unsplash.com/photo-1780291116326-36096428e499?auto=format&fit=crop&w=1400&q=88" },
  { url: "https://images.unsplash.com/photo-1777312379304-e958accc0fa9?auto=format&fit=crop&w=1400&q=88" },
  { url: "https://images.unsplash.com/photo-1764593823886-6cd9af7f8a5c?auto=format&fit=crop&w=1400&q=88" },
  { url: "https://images.unsplash.com/photo-1647900748342-7631ef9c9429?auto=format&fit=crop&w=1400&q=88" },
  { url: "https://images.unsplash.com/photo-1760080903525-d3608e3bbe2d?auto=format&fit=crop&w=1400&q=88" },
  { url: "https://images.unsplash.com/photo-1769898548207-ec7bb38a7cb8?auto=format&fit=crop&w=1400&q=88" },
  { url: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1400&q=88" },
  { url: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=88" },
];

const fotoFinal =
  "https://images.unsplash.com/photo-1773243086564-a444f7d8a61b?auto=format&fit=crop&w=1800&q=88";

const passos = [
  {
    titulo: "Crie o projeto e organize as pastas",
    descricao: "Cada trabalho reúne pastas de fotos em um projeto, com um único link para o cliente.",
  },
  {
    titulo: "Envie, organize e compartilhe",
    descricao: "Adicione fotos por pasta, escolha capas e compartilhe o projeto inteiro por um único link.",
  },
  {
    titulo: "O cliente faz a seleção",
    descricao: "No link público do projeto, o cliente escolhe fotos por pasta, comenta e conclui a seleção sem criar conta.",
  },
  {
    titulo: "Siga até a entrega final",
    descricao: "As escolhas de cada pasta acompanham a preparação e a publicação das fotos finais.",
  },
];

function Logo() {
  return (
    <svg viewBox="0 0 115 101" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="logoGradEditorial" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1196fc" />
          <stop offset="1" stopColor="#5d0dfa" />
        </linearGradient>
      </defs>
      <g fill="url(#logoGradEditorial)">
        <path d="M65.5 6.1C60.6 6.6 56.3 8.3 52.5 11.4 51.2 12.4 49.5 14.1 40.1 23.2 36.2 27 31.6 31.5 29.7 33.3 27.8 35.1 24.4 38.4 22.2 40.7 19.9 42.9 16.6 46.1 14.9 47.8 9.3 53.2 8.5 54 7.7 55.1 6.4 57.1 6 58.5 6 60.7 6 62.4 6.1 63 6.8 64.3 7.8 66.3 9.5 67.7 12 68.4 12.9 68.7 12.9 68.7 17 68.7 21.5 68.8 22.3 68.7 24.1 68.2 26.8 67.3 29 66 31.4 63.8 34.4 61 42.6 53.2 43.9 52 44.7 51.2 46.2 49.7 47.4 48.7 50.1 46.1 56.8 39.7 59.1 37.4 60.1 36.4 61.3 35.3 61.7 34.9 64.5 32.6 67.9 31.2 71.5 30.9 72.2 30.8 76.2 30.8 80.4 30.8 85.4 30.9 88.6 30.8 89.3 30.8 92.1 30.5 94.4 29.7 96.7 28.2 97.9 27.3 98.2 27.1 101.4 24.1 106.2 19.7 107 18.8 107.9 16.9 108.7 15.5 108.9 14.4 108.8 12.9 108.7 11 108.3 9.8 107 8.5 106.1 7.5 104.8 6.7 103.2 6.2 102.5 6 102.5 6 84.4 6 74.5 6 65.9 6 65.5 6.1" />
        <path d="M71.3 45.7C68.6 46.1 66 47.4 63.7 49.4 63.1 49.8 59.3 53.4 55 57.5 53.7 58.7 52.2 60.2 51.6 60.8 51 61.3 49.8 62.5 49 63.3 48.2 64.1 47.2 65 46.9 65.3 45.8 66.3 38 73.7 33.1 78.4 30.7 80.8 29.7 81.9 29 83 26.4 87.3 28 92.3 32.5 94.2 34.1 94.8 34.1 94.8 39.3 94.8 43.9 94.8 43.9 94.8 45 94.5 47.6 93.9 49.8 92.7 51.7 91 52.5 90.3 57.4 85.8 61.2 82.1 62.3 81.1 63.9 79.6 64.9 78.6 65.9 77.7 67.3 76.4 68 75.7 68.6 75.1 69.6 74.2 70.1 73.7 74.5 69.6 82.3 62.1 84.5 60 87.5 56.9 88.4 55.4 88.5 52.8 88.6 50.7 88 49.1 86.6 47.7 85.4 46.6 84.2 45.9 82.5 45.6 81.2 45.4 72.8 45.4 71.3 45.7" />
      </g>
    </svg>
  );
}

function DemoScreen({ etapa }: { etapa: number }) {
  if (etapa === 0) {
    return (
      <div className="lp2-demo-screen lp2-real-projects">
        <div className="lp2-real-page-head">
          <div>
            <small>PROJETOS</small>
            <strong>Seus trabalhos em um só lugar</strong>
            <p>Cada projeto reúne suas pastas, seleção, entrega e um único link para o cliente.</p>
          </div>
          <span className="lp2-real-primary compact">+ Novo projeto</span>
        </div>

        <div className="lp2-real-project-stats">
          <div><b>3</b><span>Projetos</span></div>
          <div><b>3</b><span>Projetos com fotos</span></div>
          <div><b>7</b><span>Pastas de fotos</span></div>
        </div>

        <div className="lp2-real-project-toolbar">
          <div className="lp2-real-search">⌕ <span>Buscar projeto, cliente ou pasta</span></div>
          <div className="lp2-real-project-filter">Todos os projetos <span>⌄</span></div>
        </div>

        <div className="lp2-real-project-list">
          {[
            {nome:"Casamento Marina & Pedro",cliente:"Marina Alves",pastas:3,foto:0,atualizado:"hoje"},
            {nome:"Ensaio Família Alves",cliente:"Família Alves",pastas:2,foto:1,atualizado:"há 2 dias"},
            {nome:"Ensaio Gestante Juliana",cliente:"Juliana Souza",pastas:2,foto:3,atualizado:"há 5 dias"},
          ].map((projeto) => (
            <div className="lp2-real-project-row" key={projeto.nome}>
              <div className="lp2-real-project-cover" style={{backgroundImage:'url("' + fotosGaleria[projeto.foto].url + '")'}} />
              <div className="lp2-real-project-info">
                <strong>{projeto.nome}</strong>
                <small>{projeto.cliente} · Atualizado {projeto.atualizado}</small>
                <span>{projeto.pastas} pastas</span>
              </div>
              <span className="lp2-real-project-action">Abrir projeto →</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (etapa === 1) {
    return (
      <div className="lp2-demo-screen lp2-real-project-folders">
        <div className="lp2-real-project-back">‹ Projetos</div>
        <div className="lp2-real-page-head">
          <div>
            <small>PROJETO · MARINA ALVES</small>
            <strong>Casamento Marina & Pedro</strong>
            <p>Organize as pastas do trabalho e compartilhe um único link.</p>
          </div>
          <span className="lp2-real-secondary">↗ Compartilhar projeto</span>
        </div>
        <div className="lp2-real-project-tabs">
          <span>Resumo</span><span className="on">Pastas</span><span>Seleção</span><span>Entrega</span><span>Atividade</span>
        </div>
        <div className="lp2-real-folders-head">
          <div><strong>Pastas de fotos</strong><small>Organize o trabalho por momentos</small></div>
          <span className="lp2-real-primary compact">+ Nova pasta</span>
        </div>
        <div className="lp2-real-folder-list">
          {[
            {nome:"Making of",fotos:86,status:"Em prova",foto:2},
            {nome:"Cerimônia",fotos:242,status:"Aguardando seleção",foto:0},
            {nome:"Recepção",fotos:164,status:"Entrega publicada",foto:4},
          ].map((pasta) => (
            <div className="lp2-real-folder-row" key={pasta.nome}>
              <div className="lp2-real-folder-cover" style={{backgroundImage:'url("' + fotosGaleria[pasta.foto].url + '")'}} />
              <div className="lp2-real-folder-info">
                <strong>{pasta.nome}</strong>
                <small>{pasta.fotos} fotos · {pasta.status}</small>
              </div>
              <span>Ver pasta →</span>
            </div>
          ))}
        </div>
        <div className="lp2-real-project-share"><b>Um único link para o projeto</b><span>O cliente navega pelas pastas, seleciona fotos e acompanha a entrega.</span></div>
      </div>
    );
  }

  if (etapa === 2) {
    return (
      <div className="lp2-demo-screen lp2-real-public">
        <div className="lp2-real-public-hero" style={{ backgroundImage: 'url("' + fotosGaleria[0].url + '")' }}>
          <div className="lp2-real-public-brand">STUDIO AURORA</div>
          <div>
            <small>PROJETO DE FOTOS</small>
            <strong>Marina & Pedro</strong>
          </div>
        </div>
        <div className="lp2-real-public-head">
          <strong>Cerimônia <span>24 fotos · Marina &amp; Pedro</span></strong>
        </div>
        <div className="lp2-real-public-hint">Pasta Cerimônia · Selecione as fotos desejadas (até 25) e finalize quando terminar.</div>
        <div className="lp2-real-public-grid">
          {[2, 0, 3, 1, 6, 4, 5, 7].map((foto, index) => (
            <div key={index} style={{ backgroundImage: 'url("' + fotosGaleria[foto].url + '")' }}>
              <span className={"lp2-real-check" + ([0, 3, 5].includes(index) ? " on" : "")}>{[0, 3, 5].includes(index) ? "✓" : ""}</span>
              {index === 3 && <i className="lp2-real-comment">●</i>}
            </div>
          ))}
        </div>
        <div className="lp2-real-selection-bar"><span>3 / 25 selecionadas</span><b>Finalizar seleção</b></div>
      </div>
    );
  }

  return (
    <div className="lp2-demo-screen lp2-real-selections">
      <div className="lp2-real-project-back">‹ Projetos / Marina & Pedro</div>
      <div className="lp2-real-page-head">
        <div>
          <small>PROJETO · SELEÇÃO</small>
          <strong>Escolhas do cliente</strong>
          <p>Acompanhe as escolhas e comentários de cada pasta do projeto.</p>
        </div>
        <span className="lp2-real-secondary">↻ Atualizar</span>
      </div>
      <div className="lp2-real-project-tabs">
        <span>Resumo</span><span>Pastas</span><span className="on">Seleção</span><span>Entrega</span><span>Atividade</span>
      </div>
      <div className="lp2-real-summary">
        <div><b>3</b><span>Pastas</span></div>
        <div><b>1</b><span>Em andamento</span></div>
        <div><b>2</b><span>Finalizadas</span></div>
        <div><b>24</b><span>Fotos escolhidas</span></div>
      </div>
      <div className="lp2-real-folder-list">
        {[
          {nome:"Making of",selecionadas:"6 / 10 fotos",status:"Finalizada",foto:2},
          {nome:"Cerimônia",selecionadas:"12 / 25 fotos",status:"Em andamento",foto:0},
          {nome:"Recepção",selecionadas:"6 / 15 fotos",status:"Finalizada",foto:4},
        ].map((pasta) => (
          <div className="lp2-real-folder-row" key={pasta.nome}>
            <div className="lp2-real-folder-cover" style={{backgroundImage:'url("' + fotosGaleria[pasta.foto].url + '")'}} />
            <div className="lp2-real-folder-info">
              <strong>{pasta.nome}</strong>
              <small>{pasta.selecionadas} · {pasta.status}</small>
            </div>
            <span>Ver seleção →</span>
          </div>
        ))}
      </div>
      <div className="lp2-real-project-share"><b>Próximo passo: entrega final</b><span>Prepare as fotos escolhidas e publique a entrega nas respectivas pastas.</span></div>
    </div>
  );
}

export default function Home({ initialCurrency }: { initialCurrency: PricingCurrency }) {
  const { locale, t } = useI18n();
  const supabase = useMemo(() => createClient(), []);
  const [logado, setLogado] = useState(false);
  const [etapaAtiva, setEtapaAtiva] = useState(0);
  const [heroCarousel, setHeroCarousel] = useState({ atual: 0, anterior: 0 });

  useEffect(() => {
    let ativo = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (ativo) setLogado(Boolean(data.user));
    });
    return () => { ativo = false; };
  }, [supabase]);

  useEffect(() => {
    registrarEventoProduto("landing_view", {
      rota: "/",
      detalhes: utmAtual(),
    });
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setEtapaAtiva((atual) => (atual + 1) % passos.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setHeroCarousel(({ atual }) => ({
        anterior: atual,
        atual: (atual + 1) % fotosHero.length,
      }));
    }, 2600);
    return () => window.clearInterval(timer);
  }, []);

  function rastrearCriacao(origem: string, plano?: string) {
    if (logado) return;
    registrarEventoProduto("landing_signup_clicked", {
      rota: "/",
      detalhes: {
        ...utmAtual(),
        origem,
        ...(plano ? { plano } : {}),
      },
    });
  }

  const destinoPrincipal = withLocalePath(logado ? "/dashboard" : "/login?modo=cadastro", locale);
  const destinoLogin = withLocalePath(logado ? "/dashboard" : "/login", locale);
  const heroAtual = [
    heroCarousel.atual,
    (heroCarousel.atual + 2) % fotosHero.length,
    (heroCarousel.atual + 4) % fotosHero.length,
  ];
  const heroAnterior = [
    heroCarousel.anterior,
    (heroCarousel.anterior + 2) % fotosHero.length,
    (heroCarousel.anterior + 4) % fotosHero.length,
  ];

  return (
    <div className="lp2">
      <header className="lp2-nav">
        <a className="lp2-brand" href={withLocalePath("/", locale)} aria-label="Fotura"><Logo /><strong>FOTURA</strong></a>
        <nav className="lp2-navlinks">
          <a href="#experiencia">{t("Galeria")}</a>
          <a href="#fluxo">{t("Como funciona")}</a>
          <a href="#planos">{t("Planos")}</a>
          <a href="#faq">{t("Dúvidas")}</a>
        </nav>
        <div className="lp2-actions">
          <LanguageSwitcher compact />
          <a className="lp2-btn" href={destinoLogin}>{logado ? t("Painel") : t("Entrar")}</a>
          <a className="lp2-btn lp2-btn-primary" href={destinoPrincipal} onClick={() => rastrearCriacao("header")}>
            {logado ? t("Abrir Fotura") : t("Criar conta")}
          </a>
        </div>
      </header>

      <main>
        <section className="lp2-hero" id="experiencia">
          <div className="lp2-hero-copy">
            <div className="lp2-kicker">{t("Galerias de entrega e prova online")}</div>
            <h1>{t("Sua fotografia merece uma")} <span className="lp2-serif lp2-gradient-word">{t("entrega")}</span> {t("à altura.")}</h1>
            <p>
              {t("Um único link para apresentar o ensaio, receber favoritas e comentários e concluir a seleção — com a sua identidade no centro da experiência.")}
            </p>
            <div className="lp2-hero-actions">
              <a className="lp2-btn lp2-btn-primary" href={destinoPrincipal} onClick={() => rastrearCriacao("hero")}>
                {logado ? t("Ir para o painel") : t("Criar galeria grátis")} <span>→</span>
              </a>
              <a className="lp2-btn" href="#fluxo">{t("Ver como funciona")}</a>
            </div>
            <div className="lp2-micro"><b>●</b> {t("Plano grátis disponível · seu cliente não precisa criar conta")}</div>
          </div>

          <div
            className="lp2-hero-art"
            aria-label={`${t("Seleção editorial de fotografias")}: ${heroAtual.map((index) => t(fotosHero[index].label)).join(", ")}`}
          >
            <div className="lp2-photo lp2-hero-main" style={{ backgroundImage: 'url("' + fotosHero[heroAnterior[0]].url + '")' }}>
              <div
                key={`hero-main-${heroCarousel.atual}`}
                className="lp2-hero-photo-layer"
                style={{ backgroundImage: 'url("' + fotosHero[heroAtual[0]].url + '")' }}
              />
            </div>
            <div className="lp2-photo lp2-hero-tall" style={{ backgroundImage: 'url("' + fotosHero[heroAnterior[1]].url + '")' }}>
              <div
                key={`hero-tall-${heroCarousel.atual}`}
                className="lp2-hero-photo-layer"
                style={{ backgroundImage: 'url("' + fotosHero[heroAtual[1]].url + '")' }}
              />
            </div>
            <div className="lp2-photo lp2-hero-small" style={{ backgroundImage: 'url("' + fotosHero[heroAnterior[2]].url + '")' }}>
              <div
                key={`hero-small-${heroCarousel.atual}`}
                className="lp2-hero-photo-layer"
                style={{ backgroundImage: 'url("' + fotosHero[heroAtual[2]].url + '")' }}
              />
            </div>
          </div>
        </section>

        <section className="lp2-demo" id="fluxo">
          <div className="lp2-shell">
            <div className="lp2-section-head">
              <div>
                <div className="lp2-kicker">{t("Do clique à entrega")}</div>
                <h2>{t("Do upload à escolha final.")}<br />{t("No mesmo fluxo.")}</h2>
              </div>
              <p>
                {t("Crie o projeto, organize as pastas e receba as escolhas do cliente por um único link, sem mensagens soltas ou listas de arquivos.")}
              </p>
            </div>

            <div className="lp2-demo-grid">
              <div className="lp2-steps">
                {passos.map((passo, index) => (
                  <button
                    className={"lp2-step" + (etapaAtiva === index ? " active" : "")}
                    key={passo.titulo}
                    type="button"
                    onClick={() => setEtapaAtiva(index)}
                  >
                    <span className="lp2-step-n">0{index + 1}</span>
                    <span>
                      <strong>{t(passo.titulo)}</strong>
                      <small>{t(passo.descricao)}</small>
                    </span>
                    {etapaAtiva === index && <i className="lp2-step-progress" aria-hidden="true" />}
                  </button>
                ))}
              </div>

              <div className="lp2-demo-frame" aria-live="polite">
                <div className="lp2-demo-browser">
                  <div className="lp2-browserbar"><i /><i /><i /></div>
                  <div className={"lp2-demo-body" + (etapaAtiva === 2 ? " public-view" : "")}>
                    {etapaAtiva !== 2 && (
                      <aside className="lp2-demo-side">
                        <div className="lp2-demo-logo">FOTURA</div>
                        {["Painel","Projetos","Clientes","Vendas","Planos","Configurações","Ajuda e feedback"].map((item) => (
                          <div
                            className={
                              "lp2-demo-navitem" +
                              (item === "Projetos" ? " on" : "")
                            }
                            key={item}
                          >
                            <span className="lp2-demo-navglyph" aria-hidden="true">{item === "Projetos" ? "▱" : item === "Painel" ? "▦" : item === "Clientes" ? "♙" : item === "Vendas" ? "↗" : item === "Planos" ? "▤" : item === "Configurações" ? "⚙" : "?"}</span>
                            {t(item)}
                          </div>
                        ))}
                      </aside>
                    )}
                    <div className="lp2-demo-main">
                      <DemoScreen etapa={etapaAtiva} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <LandingCinematicShowcase locale={locale} />

        <section className="lp2-pricing" id="planos">
          <div className="lp2-shell">
            <div className="lp2-pricing-head">
              <div>
                <div className="lp2-kicker">{t("Planos")}</div>
                <h2>{t("Comece leve.")}<br />{t("Escale quando precisar.")}</h2>
              </div>
              <p>
                {t("Projetos, pastas, clientes e fotos não têm limite por quantidade. Você escolhe o plano pelo armazenamento e pelo nível de apresentação.")}
              </p>
            </div>

            <div className="lp2-prices">
              {planos.map((plano) => (
                <article className={"lp2-plan" + (plano.destaque ? " hot" : "")} key={plano.nome}>
                  <div className="lp2-plan-top">
                    <h3>{t(plano.nome)}</h3>
                    {plano.destaque && <span className="lp2-popular">{t("Mais indicado")}</span>}
                  </div>
                  <div className="lp2-price">
                    {formatPricingAmount(
                      plano.codigo === "gratis" ? 0 : approvedMonthlyPrice(plano.codigo, initialCurrency) ?? 0,
                      initialCurrency,
                      locale,
                    )}
                  </div>
                  <div className="lp2-per">{t("por mês")}</div>
                  <ul>{plano.itens.map((item) => <li key={item}>{t(item)}</li>)}
                      <li>{locale === "en" ? `Monthly upload allowance (fair use): ${plano.uploadMensalGb} GB` : locale === "es" ? `Franquicia mensual de subidas (uso razonable): ${plano.uploadMensalGb} GB` : `Franquia mensal de envios (uso justo): ${plano.uploadMensalGb?.toLocaleString("pt-BR")} GB`}</li>
                      <li>{plano.envioEmail ? (locale === "en" ? "Gallery invitations and delivery notices by email" : locale === "es" ? "Invitaciones y avisos de entrega por correo" : "Convites e avisos de entrega por e-mail") : (locale === "en" ? "Share by link; emails require a paid plan" : locale === "es" ? "Compartir por enlace; correos requieren un plan de pago" : "Compartilhe por link; e-mails exigem plano pago")}</li></ul>
                  <a
                    className="lp2-btn"
                    href={destinoPrincipal}
                    onClick={() => rastrearCriacao("planos", plano.nome.toLowerCase())}
                  >
                    {plano.nome === "Grátis" ? t("Começar grátis") : t("Escolher") + " " + t(plano.nome)}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp2-faq" id="faq">
          <div className="lp2-shell lp2-faq-grid">
            <div className="lp2-faq-intro">
              <div className="lp2-kicker">{t("Dúvidas")}</div>
              <h2>{t("O essencial, antes de começar.")}</h2>
              <p>{t("Sem letras miúdas no fluxo principal.")}</p>
            </div>
            <div className="lp2-faq-list">
              <details><summary>{t("Meu cliente precisa criar uma conta?")}</summary><p>{t("Não. Ele acessa a galeria pelo link enviado por você e, quando necessário, informa apenas a senha da galeria.")}</p></details>
              <details><summary>{t("Posso usar o Fotura para prova de fotos?")}</summary><p>{t("Sim. Você pode habilitar seleção, definir limite de favoritas e receber comentários por foto.")}</p></details>
              <details><summary>{t("Minha marca aparece na experiência?")}</summary><p>{t("Sim. O Fotura permite personalizar a apresentação do estúdio e manter sua identidade no centro da entrega.")}</p></details>
              <details><summary>{t("Posso cancelar quando quiser?")}</summary><p>{t("Sim. A assinatura é gerenciada pelo portal de cobrança e pode ser cancelada para o fim do período vigente.")}</p></details>
            </div>
          </div>
        </section>

        <section
          className="lp2-final"
          style={{ backgroundImage: 'url("' + fotoFinal + '")' }}
        >
          <div className="lp2-final-inner">
            <h2>{t("A entrega também faz parte da fotografia.")}</h2>
            <p>{t("Apresente o trabalho, receba a escolha do cliente e continue o processo sem perder o contexto de cada foto.")}</p>
            <a className="lp2-btn lp2-btn-primary" href={destinoPrincipal} onClick={() => rastrearCriacao("cta_final")}>
              {logado ? t("Abrir meu painel") : t("Criar galeria grátis")} <span>→</span>
            </a>
          </div>
        </section>
      </main>

      <footer className="lp2-shell lp2-footer">
        <a className="lp2-brand" href={withLocalePath("/", locale)}><Logo /><strong>FOTURA</strong></a>
        <div className="lp2-footer-links">
          <a href={withLocalePath("/termos", locale)}>{t("Termos")}</a>
          <a href={withLocalePath("/privacidade", locale)}>{t("Privacidade")}</a>
          <a href={withLocalePath("/login", locale)}>{t("Entrar")}</a>
        </div>
        <div className="lp2-credit">© {new Date().getFullYear()} Fotura · {t("Fotos demonstrativas via Unsplash")}</div>
      </footer>
    </div>
  );
}
