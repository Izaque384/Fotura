"use client";

import { useEffect, useRef, useState } from "react";
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
  const terminarRef = useRef(onFinish);
  const botaoRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { terminarRef.current = onFinish; }, [onFinish]);

  useEffect(() => {
    const anterior = document.body.style.overflow;
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
      window.removeEventListener("keydown", onKey);
      imagens.forEach((img) => { img.src = ""; });
    };
  }, [config.fotos]);

  useEffect(() => {
    if (pausado) return;
    const duracao = config.duracao * 1000;
    const fase = duracao / 3; // 8, 12 ou 16 segundos totais: tempo para ler cada frase.
    const a = window.setTimeout(() => setEtapa(1), fase);
    const b = window.setTimeout(() => setEtapa(2), fase * 2);
    const c = window.setTimeout(() => terminarRef.current(), duracao);
    return () => { window.clearTimeout(a); window.clearTimeout(b); window.clearTimeout(c); };
  }, [config.duracao, pausado]);

  const fotos = config.fotos.slice(0, config.estilo === "minimalista" ? 1 : 3);
  const textos = [
    config.frase || "Alguns momentos merecem ser revividos.",
    projetoNome,
    "Sua história começa aqui.",
  ];
  return (
    <section className={`fci-intro fci-${config.estilo}`} role="dialog" aria-modal="true" aria-label="Apresentação do projeto">
      <style>{css}</style>
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
        <button ref={botaoRef} type="button" className="fci-skip" onClick={onFinish}>
          {preview ? "Fechar prévia" : "Pular introdução"} <span aria-hidden="true">↗</span>
        </button>
      </div>
      <div className="fci-center" aria-live="polite">
        <div className="fci-eyebrow">{etapa === 2 ? "SUAS FOTOGRAFIAS" : "UMA HISTÓRIA PARA REVIVER"}</div>
        <h1 key={etapa} className="fci-title">{textos[etapa]}</h1>
        {etapa === 2 && <button type="button" className="fci-explore" onClick={onFinish}>
          Explorar fotografias <span aria-hidden="true">→</span>
        </button>}
      </div>
      <div className="fci-bottom">
        <span>UMA EXPERIÊNCIA FOTURA</span>
        <div className="fci-progress" aria-hidden="true">{[0, 1, 2].map((n) => (
          <i key={n} className={n === etapa ? "current" : n < etapa ? "complete" : ""} />
        ))}</div>
        {pausado && <button type="button" onClick={onFinish}>Continuar para as galerias →</button>}
      </div>
    </section>
  );
}

const css = `
.fci-intro{position:fixed;inset:0;z-index:100000;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#0b0b12;color:#fff;font-family:var(--font-sora),system-ui,sans-serif}
.fci-images,.fci-images img,.fci-shade{position:absolute;inset:0;width:100%;height:100%}
.fci-images img{object-fit:cover;opacity:0;transform:scale(1.015);transition:opacity 1.8s cubic-bezier(.22,1,.36,1);animation:fci-zoom linear both;will-change:transform}
.fci-images img.visible{opacity:1}
.fci-minimalista .fci-images img{opacity:1}
.fci-editorial .fci-images img{transition-duration:1.15s}
.fci-shade{background:linear-gradient(180deg,rgba(3,4,14,.68),rgba(4,5,13,.56) 38%,rgba(3,4,14,.79)),rgba(5,5,10,.22)}
.fci-top{position:absolute;left:0;right:0;top:0;padding:clamp(22px,4vw,48px);display:flex;justify-content:space-between;align-items:center;gap:12px;z-index:2}
.fci-studio{color:#fff!important;font-size:12px;letter-spacing:.20em;font-weight:700;text-transform:uppercase;text-shadow:0 1px 8px #0008}
.fci-skip{color:#fff;background:rgba(15,17,29,.46);border:1px solid #ffffff6b;border-radius:999px;font:inherit;font-size:12px;padding:12px 17px;cursor:pointer;backdrop-filter:blur(8px)}
.fci-skip span{margin-left:6px}
.fci-skip:focus-visible,.fci-explore:focus-visible,.fci-bottom button:focus-visible{outline:3px solid #a8b9ff;outline-offset:3px}
.fci-center{position:relative;max-width:min(900px,90vw);padding:32px;text-align:center;z-index:1}
.fci-eyebrow{color:#f6f4ff!important;font-size:clamp(10px,1.3vw,13px);letter-spacing:.24em;opacity:.94;margin-bottom:24px;font-weight:600}
.fci-intro h1.fci-title{color:#fff!important;font-weight:500;letter-spacing:-.038em;font-size:clamp(38px,7vw,86px);line-height:1.17;text-wrap:balance;text-shadow:0 4px 24px rgba(0,0,0,.85),0 2px 6px #000;animation:fci-fade 1.25s ease both}
.fci-explore{margin-top:35px;border:1px solid #ffffff88;color:#fff;background:rgba(22,24,37,.38);padding:15px 24px;border-radius:100px;cursor:pointer;font:inherit;font-size:13px}
.fci-explore span{margin-left:14px}
.fci-bottom{position:absolute;bottom:clamp(24px,5vw,56px);left:0;right:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:17px;z-index:2}
.fci-bottom>span{color:#fff!important;font-size:10px;letter-spacing:.24em;opacity:.7}
.fci-progress{display:flex;gap:6px}
.fci-progress i{display:block;height:3px;width:36px;border-radius:8px;background:#ffffff55;transition:background .3s}
.fci-progress i.current{background:#fff}
.fci-progress i.complete{background:#ffffffaa}
.fci-bottom button{background:transparent;border:0;color:#fff;text-decoration:underline;font:inherit;cursor:pointer}
@keyframes fci-zoom{from{transform:scale(1.015)}to{transform:scale(1.075)}}
@keyframes fci-fade{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:650px){.fci-top{padding:24px 18px}.fci-studio{font-size:11px;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fci-center{padding:14px}.fci-intro h1.fci-title{font-size:clamp(32px,9.5vw,54px)}.fci-eyebrow{letter-spacing:.15em}.fci-bottom{bottom:30px}}
@media(prefers-reduced-motion:reduce){.fci-images img,.fci-title,.fci-progress i{animation:none!important;transition:none!important}.fci-images img{transform:none!important}}
`;
