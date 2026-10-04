"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase-client";
import { registrarEventoProduto, utmAtual } from "../lib/product-analytics";
import "./landing-editorial.css";

const planos = [
  {
    nome: "Grátis",
    preco: "0",
    destaque: false,
    itens: ["1 GB de armazenamento", "Galerias, clientes e fotos ilimitados", "Seleção, comentários, senha e entrega", "Identidade básica do estúdio"],
  },
  {
    nome: "Essencial",
    preco: "14,90",
    destaque: false,
    itens: ["10 GB de armazenamento", "Galerias, clientes e fotos ilimitados", "Hero Minimal com logo, nome e cor", "Prova, comentários, senha e entrega"],
  },
  {
    nome: "Profissional",
    preco: "29,90",
    destaque: true,
    itens: ["50 GB de armazenamento", "Tudo do Essencial", "Heroes Minimal, Premium e Tech", "Foto da galeria no fundo do hero"],
  },
  {
    nome: "Studio",
    preco: "59,90",
    destaque: false,
    itens: ["100 GB de armazenamento", "Tudo do Profissional", "Mesmos recursos visuais do Profissional", "Para operações com alto volume"],
  },
];

const fotos = [
  {
    url: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1600&q=88",
    label: "Casamentos",
  },
  {
    url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=88",
    label: "Retratos",
  },
  {
    url: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=88",
    label: "Histórias",
  },
  {
    url: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1400&q=88",
    label: "Famílias",
  },
  {
    url: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1400&q=88",
    label: "Eventos",
  },
  {
    url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1400&q=88",
    label: "Comercial",
  },
  {
    url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=88",
    label: "Autorais",
  },
];

const passos = [
  {
    titulo: "Suba o ensaio",
    descricao: "Organize a entrega em uma galeria limpa, sem mandar dezenas de arquivos soltos.",
  },
  {
    titulo: "Apresente seu trabalho",
    descricao: "A galeria ganha ritmo, hierarquia e espaço para a fotografia respirar.",
  },
  {
    titulo: "Seu cliente seleciona",
    descricao: "Favoritas e comentários ficam associados a cada imagem, sem cadastro para o cliente.",
  },
  {
    titulo: "Você recebe tudo organizado",
    descricao: "A seleção chega pronta para continuar o fluxo, sem conferência manual em mensagens.",
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
      <div className="lp2-demo-screen">
        <div className="lp2-demo-title">
          <div><small>Nova galeria</small><strong>Marina & Pedro</strong></div>
          <span className="lp2-demo-pill">24 fotos</span>
        </div>
        <div className="lp2-uploadbox">
          <strong>Upload do ensaio</strong>
          <p>As fotos entram na galeria e ficam prontas para organizar.</p>
          {[0, 2, 1].map((foto, index) => (
            <div className="lp2-uploadrow" key={foto}>
              <div className="lp2-thumb" style={{ backgroundImage: 'url("' + fotos[foto].url + '")' }} />
              <div className="lp2-uploadmeta">
                <b>{"ensaio_0" + (index + 1) + ".jpg"}</b>
                <span>{index === 2 ? "Enviando…" : "Pronta"}</span>
                <div className="lp2-progress"><span style={{ width: index === 2 ? "72%" : "100%" }} /></div>
              </div>
              <span className="lp2-check">{index === 2 ? "72%" : "✓"}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (etapa === 1) {
    return (
      <div className="lp2-demo-screen">
        <div className="lp2-demo-title">
          <div><small>Galeria publicada</small><strong>Marina & Pedro</strong></div>
          <span className="lp2-demo-pill">fotura.app/g/...</span>
        </div>
        <div className="lp2-demo-mosaic">
          {[0, 2, 1, 3, 6].map((foto) => (
            <div key={foto} style={{ backgroundImage: 'url("' + fotos[foto].url + '")' }} />
          ))}
        </div>
      </div>
    );
  }

  if (etapa === 2) {
    return (
      <div className="lp2-demo-screen">
        <div className="lp2-demo-title">
          <div><small>Visão do cliente</small><strong>Escolha suas favoritas</strong></div>
          <span className="lp2-demo-pill">18 / 25</span>
        </div>
        <div className="lp2-demo-mosaic">
          {[2, 0, 3, 1, 6].map((foto, index) => (
            <div key={foto} style={{ backgroundImage: 'url("' + fotos[foto].url + '")' }}>
              <span className={"lp2-demo-heart" + (index === 0 || index === 3 ? " on" : "")}>
                {index === 0 || index === 3 ? "♥" : "♡"}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="lp2-demo-screen">
      <div className="lp2-demo-title">
        <div><small>Seleção recebida</small><strong>Marina concluiu a prova</strong></div>
        <span className="lp2-demo-pill">agora</span>
      </div>
      <div className="lp2-notice">
        <div className="lp2-notice-row">
          <div className="lp2-avatar">MP</div>
          <div>
            <strong>Seleção pronta para continuar</strong>
            <p>Favoritas e comentários chegaram organizados na galeria.</p>
          </div>
        </div>
        <div className="lp2-summary">
          <div><b>18</b><span>selecionadas</span></div>
          <div><b>4</b><span>comentários</span></div>
          <div><b>1</b><span>cliente</span></div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [logado, setLogado] = useState(false);
  const [etapaAtiva, setEtapaAtiva] = useState(0);
  const [selecionadas, setSelecionadas] = useState<number[]>([0, 3]);

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

  function alternarSelecao(index: number) {
    setSelecionadas((atuais) =>
      atuais.includes(index) ? atuais.filter((item) => item !== index) : [...atuais, index]
    );
  }

  const destinoPrincipal = logado ? "/dashboard" : "/login?modo=cadastro";
  const reel = [...fotos, ...fotos];

  return (
    <div className="lp2">
      <header className="lp2-nav">
        <a className="lp2-brand" href="/" aria-label="Fotura"><Logo /><strong>FOTURA</strong></a>
        <nav className="lp2-navlinks">
          <a href="#experiencia">Galeria</a>
          <a href="#fluxo">Como funciona</a>
          <a href="#planos">Planos</a>
          <a href="#faq">Dúvidas</a>
        </nav>
        <div className="lp2-actions">
          <a className="lp2-btn" href={logado ? "/dashboard" : "/login"}>{logado ? "Painel" : "Entrar"}</a>
          <a className="lp2-btn lp2-btn-primary" href={destinoPrincipal} onClick={() => rastrearCriacao("header")}>
            {logado ? "Abrir Fotura" : "Criar conta"}
          </a>
        </div>
      </header>

      <main>
        <section className="lp2-hero" id="experiencia">
          <div className="lp2-hero-copy">
            <div className="lp2-kicker">Galerias de entrega e prova online</div>
            <h1>Entregue suas fotos sem tirar o <span className="lp2-serif">foco</span> delas.</h1>
            <p>
              Um único link para apresentar o ensaio, receber favoritas e comentários e concluir a seleção — com a sua identidade no centro da experiência.
            </p>
            <div className="lp2-hero-actions">
              <a className="lp2-btn lp2-btn-primary" href={destinoPrincipal} onClick={() => rastrearCriacao("hero")}>
                {logado ? "Ir para o painel" : "Criar galeria grátis"} <span>→</span>
              </a>
              <a className="lp2-btn" href="#fluxo">Ver como funciona</a>
            </div>
            <div className="lp2-micro"><b>●</b> Plano grátis disponível · seu cliente não precisa criar conta</div>
          </div>

          <div className="lp2-hero-art" aria-label="Seleção editorial de fotografias">
            <div className="lp2-photo lp2-hero-main" style={{ backgroundImage: 'url("' + fotos[0].url + '")' }} />
            <div className="lp2-photo lp2-hero-tall" style={{ backgroundImage: 'url("' + fotos[1].url + '")' }} />
            <div className="lp2-photo lp2-hero-small" style={{ backgroundImage: 'url("' + fotos[2].url + '")' }} />
            <div className="lp2-hero-tag">Galeria · Marina & Pedro</div>
            <div className="lp2-hero-caption">A galeria se adapta. A fotografia permanece no centro.</div>
          </div>
        </section>

        <section className="lp2-proof" aria-label="Principais recursos do Fotura">
          <div className="lp2-shell lp2-proof-grid">
            <div><span>01</span><strong>Um único link</strong><small>Galeria, prova e entrega no mesmo endereço.</small></div>
            <div><span>02</span><strong>Seleção por foto</strong><small>Favoritas ficam ligadas à imagem certa.</small></div>
            <div><span>03</span><strong>Comentários no contexto</strong><small>Menos dúvida sobre qual arquivo está sendo citado.</small></div>
            <div><span>04</span><strong>Sua identidade</strong><small>A apresentação continua parecendo parte do seu estúdio.</small></div>
          </div>
        </section>

        <section className="lp2-reel" aria-label="Diferentes estilos de fotografia">
          <div className="lp2-reel-track">
            {reel.map((foto, index) => (
              <div
                className="lp2-reel-item"
                key={foto.label + index}
                style={{ backgroundImage: 'url("' + foto.url + '")' }}
              >
                <span className="lp2-reel-label">{foto.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="lp2-demo" id="fluxo">
          <div className="lp2-shell">
            <div className="lp2-section-head">
              <div>
                <div className="lp2-kicker">Do clique à entrega</div>
                <h2>Do upload à escolha final.<br />No mesmo fluxo.</h2>
              </div>
              <p>
                Monte a galeria, compartilhe um único link e receba a seleção sem reconstruir o processo em mensagens, planilhas ou listas de nomes de arquivo.
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
                      <strong>{passo.titulo}</strong>
                      <small>{passo.descricao}</small>
                    </span>
                    {etapaAtiva === index && <i className="lp2-step-progress" aria-hidden="true" />}
                  </button>
                ))}
              </div>

              <div className="lp2-demo-frame" aria-live="polite">
                <div className="lp2-demo-browser">
                  <div className="lp2-browserbar"><i /><i /><i /></div>
                  <div className="lp2-demo-body">
                    <aside className="lp2-demo-side">
                      <div className="lp2-demo-logo">FOTURA</div>
                      <div className="lp2-demo-navitem on">Galerias</div>
                      <div className="lp2-demo-navitem">Seleções</div>
                      <div className="lp2-demo-navitem">Clientes</div>
                      <div className="lp2-demo-navitem">Entrega</div>
                    </aside>
                    <div className="lp2-demo-main">
                      <DemoScreen etapa={etapaAtiva} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp2-section">
          <div className="lp2-shell lp2-gallery">
            <div className="lp2-gallery-copy">
              <div className="lp2-kicker">A experiência do seu cliente</div>
              <h2>Seu cliente vê o ensaio. Não o sistema.</h2>
              <p>
                A experiência foi desenhada para deixar as imagens respirarem. Favoritas e comentários aparecem quando são necessários e saem do caminho quando não são.
              </p>
              <div className="lp2-gallery-stat">
                <b>{selecionadas.length}</b>
                <span>fotos selecionadas nesta demonstração.<br />Clique nas imagens para testar.</span>
              </div>
            </div>

            <div className="lp2-client">
              <div className="lp2-client-head">
                <div><small>Galeria de prova</small><strong>Marina & Pedro</strong></div>
                <span className="lp2-client-count">{selecionadas.length} selecionadas</span>
              </div>
              <div className="lp2-client-grid">
                {[0, 2, 1, 3, 6, 4].map((fotoIndex, index) => (
                  <button
                    type="button"
                    key={fotoIndex}
                    aria-label={(selecionadas.includes(index) ? "Remover" : "Selecionar") + " foto " + (index + 1)}
                    aria-pressed={selecionadas.includes(index)}
                    onClick={() => alternarSelecao(index)}
                    className={
                      "lp2-client-photo" +
                      (index === 0 ? " tall" : "") +
                      (index === 3 ? " wide" : "") +
                      (selecionadas.includes(index) ? " selected" : "")
                    }
                    style={{ backgroundImage: 'url("' + fotos[fotoIndex].url + '")' }}
                  >
                    <span className="lp2-client-heart">{selecionadas.includes(index) ? "♥" : "♡"}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="lp2-genres">
          <div className="lp2-shell">
            <div className="lp2-section-head">
              <div>
                <div className="lp2-kicker">Para diferentes formas de fotografar</div>
                <h2>Cada trabalho tem uma linguagem.<br />A galeria não precisa impor outra.</h2>
              </div>
              <p>
                Casamentos, retratos, famílias, eventos e trabalhos comerciais podem dividir a mesma ferramenta sem parecer a mesma entrega.
              </p>
            </div>
            <div className="lp2-genre-grid">
              {[
                [0, "Casamentos"],
                [1, "Retratos"],
                [3, "Famílias"],
                [4, "Eventos"],
                [5, "Comercial"],
              ].map(([fotoIndex, label]) => (
                <div
                  className="lp2-genre"
                  key={String(label)}
                  style={{ backgroundImage: 'url("' + fotos[Number(fotoIndex)].url + '")' }}
                >
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp2-pricing" id="planos">
          <div className="lp2-shell">
            <div className="lp2-pricing-head">
              <div>
                <div className="lp2-kicker">Planos</div>
                <h2>Comece leve.<br />Escale quando precisar.</h2>
              </div>
              <p>
                Galerias, clientes e fotos por galeria são ilimitados. Você escolhe o plano pelo armazenamento e pelo nível de apresentação.
              </p>
            </div>

            <div className="lp2-prices">
              {planos.map((plano) => (
                <article className={"lp2-plan" + (plano.destaque ? " hot" : "")} key={plano.nome}>
                  <div className="lp2-plan-top">
                    <h3>{plano.nome}</h3>
                    {plano.destaque && <span className="lp2-popular">Mais indicado</span>}
                  </div>
                  <div className="lp2-price"><small>R$ </small>{plano.preco}</div>
                  <div className="lp2-per">por mês</div>
                  <ul>{plano.itens.map((item) => <li key={item}>{item}</li>)}</ul>
                  <a
                    className="lp2-btn"
                    href={destinoPrincipal}
                    onClick={() => rastrearCriacao("planos", plano.nome.toLowerCase())}
                  >
                    {plano.nome === "Grátis" ? "Começar grátis" : "Escolher " + plano.nome}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp2-faq" id="faq">
          <div className="lp2-shell lp2-faq-grid">
            <div className="lp2-faq-intro">
              <div className="lp2-kicker">Dúvidas</div>
              <h2>O essencial, antes de começar.</h2>
              <p>Sem letras miúdas no fluxo principal.</p>
            </div>
            <div className="lp2-faq-list">
              <details><summary>Meu cliente precisa criar uma conta?</summary><p>Não. Ele acessa a galeria pelo link enviado por você e, quando necessário, informa apenas a senha da galeria.</p></details>
              <details><summary>Posso usar o Fotura para prova de fotos?</summary><p>Sim. Você pode habilitar seleção, definir limite de favoritas e receber comentários por foto.</p></details>
              <details><summary>Minha marca aparece na experiência?</summary><p>Sim. O Fotura permite personalizar a apresentação do estúdio e manter sua identidade no centro da entrega.</p></details>
              <details><summary>Posso cancelar quando quiser?</summary><p>Sim. A assinatura é gerenciada pelo portal de cobrança e pode ser cancelada para o fim do período vigente.</p></details>
            </div>
          </div>
        </section>

        <section
          className="lp2-final"
          style={{ backgroundImage: 'url("' + fotos[6].url + '")' }}
        >
          <div className="lp2-final-inner">
            <h2>A entrega também faz parte da fotografia.</h2>
            <p>Apresente o trabalho, receba a escolha do cliente e continue o processo sem perder o contexto de cada foto.</p>
            <a className="lp2-btn lp2-btn-primary" href={destinoPrincipal} onClick={() => rastrearCriacao("cta_final")}>
              {logado ? "Abrir meu painel" : "Criar galeria grátis"} <span>→</span>
            </a>
          </div>
        </section>
      </main>

      <footer className="lp2-shell lp2-footer">
        <a className="lp2-brand" href="/"><Logo /><strong>FOTURA</strong></a>
        <div className="lp2-footer-links">
          <a href="/termos">Termos</a>
          <a href="/privacidade">Privacidade</a>
          <a href="/login">Entrar</a>
        </div>
        <div className="lp2-credit">© {new Date().getFullYear()} Fotura · Fotos demonstrativas via Unsplash</div>
      </footer>
    </div>
  );
}
