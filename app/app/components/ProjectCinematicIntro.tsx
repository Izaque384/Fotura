"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AberturaPublica } from "../../lib/cinematic-intro";

type Props = {
  projetoNome: string;
  studioNome: string | null;
  config: AberturaPublica;
  onFinish: () => void;
  preview?: boolean;
};

export default function ProjectCinematicIntro({ projetoNome, studioNome, config, onFinish, preview = false }: Props) {
  const [etapa, setEtapa] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [montado, setMontado] = useState(false);
  const terminarRef = useRef(onFinish);
  const botaoRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { terminarRef.current = onFinish; }, [onFinish]);
  useEffect(() => { if (montado) botaoRef.current?.focus(); }, [montado]);

  useEffect(() => {
    setMontado(true);
    const anterior = document.body.style.overflow;
    const focoAnterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    botaoRef.current?.focus();
    const imagens = config.fotos.slice(0, 3).map((foto) => {
      const img = new window.Image();
      img.src = foto.url;
      return img;
    });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") terminarRef.current(); };
    window.addEventListener("keydown", onKey);
    const preferirMenosMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (preferirMenosMovimento) setPausado(true);
    return () => {
      document.body.style.overflow = anterior;
      focoAnterior?.focus();
      window.removeEventListener("keydown", onKey);
      imagens.forEach((img) => { img.src = ""; });
    };
  }, [config.fotos]);

  // Cada etapa tem seu próprio temporizador. Avançar e voltar reinicia o tempo
  // da nova cena; o usuário não perde frases porque o relógio continuou correndo.
  useEffect(() => {
    if (pausado) return;
    const timer = window.setTimeout(() => {
      if (etapa === 2) terminarRef.current();
      else setEtapa((atual) => Math.min(2, atual + 1));
    }, (config.duracao * 1000) / 3);
    return () => window.clearTimeout(timer);
  }, [config.duracao, etapa, pausado]);

  function voltarCena() { setEtapa((atual) => Math.max(0, atual - 1)); }
  function avancarCena() {
    if (etapa === 2) terminarRef.current();
    else setEtapa((atual) => Math.min(2, atual + 1));
  }

  // Sem botões visíveis: teclado também permite navegação para leitores de tela
  // e usuários que não utilizam mouse ou toque.
  useEffect(() => {
    const navegarComTeclado = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setEtapa((atual) => Math.max(0, atual - 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        if (etapa === 2) terminarRef.current();
        else setEtapa((atual) => Math.min(2, atual + 1));
      }
    };
    window.addEventListener("keydown", navegarComTeclado);
    return () => window.removeEventListener("keydown", navegarComTeclado);
  }, [etapa]);

  const fotos = config.fotos.slice(0, config.estilo === "minimalista" ? 1 : 3);
  const textos = [
    config.frase || "Alguns momentos merecem ser revividos.",
    projetoNome,
    "Sua história começa aqui.",
  ];
  if (!montado) return null;
  // Portal evita que transforms/overflows do painel distorçam a prévia.
  return createPortal(
    <section
      className={`fci-intro fci-${config.estilo}`}
      role="dialog"
      aria-modal="true"
      aria-label="Apresentação do projeto"
      aria-describedby="fci-navigation-help"
      onClick={(event) => {
        // A tela inteira é a área de navegação, exceto "Pular introdução".
        // Em desktop e mobile: metade esquerda volta; metade direita avança.
        if ((event.target as HTMLElement).closest(".fci-skip")) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left + rect.width / 2) voltarCena();
        else avancarCena();
      }}
    >
      <style>{css}</style>
      <span id="fci-navigation-help" className="fci-sr-only">
        Toque ou clique na metade esquerda para voltar e na metade direita para avançar.
        Use também as setas do teclado. Na última cena, avance para abrir as fotografias.
      </span>
      <div className="fci-images" aria-hidden="true">
        {fotos.map((foto, i) => (
          <img key={`${foto.pastaId}/${foto.arquivo}`} src={foto.url} alt="" loading="eager"
            className={i === (etapa % fotos.length) ? "visible" : ""}
            style={{ animationDuration: `${config.duracao}s` }} />
        ))}
        <div className="fci-shade" />
      </div>
      <div className="fci-top">
        <span className="fci-studio">{studioNome || "FOTURA"}</span>
        <button ref={botaoRef} type="button" className="fci-skip" onClick={(event) => { event.stopPropagation(); onFinish(); }}>
          {preview ? "Fechar prévia" : "Pular introdução"} <span aria-hidden="true">↗</span>
        </button>
      </div>
      <div className="fci-center" aria-live="polite">
        <div className="fci-eyebrow">{etapa === 2 ? "SUAS FOTOGRAFIAS" : "UMA HISTÓRIA PARA REVIVER"}</div>
        <h1 key={etapa} className="fci-title">{textos[etapa]}</h1>

      </div>
      <div className="fci-bottom" aria-hidden="true">
        <div className="fci-progress">{[0, 1, 2].map((n) => (
          <i key={n} className={n === etapa ? "current" : n < etapa ? "complete" : ""} />
        ))}</div>
      </div>
    </section>,
    document.body
  );
}

const css = `
.fci-intro{position:fixed;inset:0;z-index:100000;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#0b0b12;color:#fff;font-family:var(--font-sora),system-ui,sans-serif;cursor:pointer;touch-action:manipulation}
.fci-images,.fci-images img,.fci-shade{position:absolute;inset:0;width:100%;height:100%}
.fci-images img{object-fit:cover;opacity:0;transform:scale(1.015);transition:opacity 2.15s cubic-bezier(.22,1,.36,1);animation:fci-zoom linear both;will-change:transform}
.fci-images img.visible{opacity:1}
.fci-minimalista .fci-images img{opacity:1}
.fci-editorial .fci-images img{transition-duration:1.45s}
.fci-shade{background:linear-gradient(180deg,rgba(3,4,14,.68),rgba(4,5,13,.56) 38%,rgba(3,4,14,.79)),rgba(5,5,10,.22)}
.fci-top{position:absolute;left:0;right:0;top:0;padding:clamp(22px,4vw,48px);display:flex;justify-content:space-between;align-items:center;gap:12px;z-index:2}
.fci-studio{color:#fff!important;font-size:12px;letter-spacing:.20em;font-weight:700;text-transform:uppercase;text-shadow:0 1px 8px #0008}
.fci-skip{color:#fff;background:rgba(15,17,29,.46);border:1px solid #ffffff6b;border-radius:999px;font:inherit;font-size:12px;padding:12px 17px;cursor:pointer;backdrop-filter:blur(8px)}
.fci-skip span{margin-left:6px}
.fci-skip:focus-visible{outline:3px solid #a8b9ff;outline-offset:3px}
.fci-center{position:relative;max-width:min(900px,90vw);padding:32px;text-align:center;z-index:1}
.fci-eyebrow{color:#f6f4ff!important;font-size:clamp(10px,1.3vw,13px);letter-spacing:.24em;opacity:.94;margin-bottom:24px;font-weight:600}
.fci-intro h1.fci-title{color:#fff!important;font-weight:500;letter-spacing:-.038em;font-size:clamp(38px,7vw,86px);line-height:1.17;text-wrap:balance;text-shadow:0 4px 24px rgba(0,0,0,.85),0 2px 6px #000;animation:fci-fade 1.25s ease both}
.fci-bottom{position:absolute;bottom:clamp(24px,5vw,56px);left:0;right:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:2}
.fci-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.fci-progress{display:flex;gap:6px}
.fci-progress i{display:block;height:3px;width:36px;border-radius:8px;background:#ffffff55;transition:background .3s}
.fci-progress i.current{background:#fff}
.fci-progress i.complete{background:#ffffffaa}
@keyframes fci-zoom{from{transform:scale(1.015)}to{transform:scale(1.075)}}
@keyframes fci-fade{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:650px){.fci-top{padding:24px 18px}.fci-studio{font-size:11px;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fci-center{padding:14px}.fci-intro h1.fci-title{font-size:clamp(32px,9.5vw,54px)}.fci-eyebrow{letter-spacing:.15em}.fci-bottom{bottom:24px}}
@media(prefers-reduced-motion:reduce){.fci-images img,.fci-title,.fci-progress i{animation:none!important;transition:none!important}.fci-images img{transform:none!important}}
`;
