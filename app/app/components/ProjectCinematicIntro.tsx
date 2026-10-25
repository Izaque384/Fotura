"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Newsreader } from "next/font/google";
import type { AberturaPublica } from "../../lib/cinematic-intro";

// Fonte editorial reservada aos textos longos da introdução, sem alterar os títulos.
const introDescriptionFont = Newsreader({
  subsets: ["latin"],
  weight: "300",
  display: "swap",
  variable: "--font-intro-editorial",
});

type Props = {
  projetoNome: string;
  projetoDescricao: string | null;
  studioNome: string | null;
  config: AberturaPublica;
  onFinish: () => void;
  preview?: boolean;
};

export default function ProjectCinematicIntro({ projetoNome, projetoDescricao, studioNome, config, onFinish, preview = false }: Props) {
  const [etapa, setEtapa] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [montado, setMontado] = useState(false);
  const [permiteVideo, setPermiteVideo] = useState(false);
  const [videoPronto, setVideoPronto] = useState(false);
  const [usarFotosFallback, setUsarFotosFallback] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const terminarRef = useRef(onFinish);
  const telaRef = useRef<HTMLElement>(null);
  useEffect(() => { terminarRef.current = onFinish; }, [onFinish]);
  useEffect(() => { if (montado) telaRef.current?.focus({ preventScroll: true }); }, [montado]);

  useEffect(() => {
    setMontado(true);
    const anterior = document.body.style.overflow;
    const focoAnterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";

    const imagens = config.fotos.slice(0, 3).map((foto) => {
      const img = new window.Image();
      img.src = foto.url;
      return img;
    });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") terminarRef.current(); };
    window.addEventListener("keydown", onKey);
    const preferirMenosMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (preferirMenosMovimento) setPausado(true);
    // Modo economia, rede lenta e movimento reduzido recebem imagens estáticas.
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    const economica = Boolean(connection?.saveData) ||
      ["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? "");
    // No modo vídeo, nenhuma foto aparece enquanto o MP4 está carregando.
    // Só habilitamos as imagens caso o aparelho solicite uma alternativa.
    setVideoPronto(false);
    setUsarFotosFallback(preferirMenosMovimento || economica);
    setPermiteVideo(!preferirMenosMovimento && !economica);
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
  const temVideoConfigurado = config.fundo === "video" && Boolean(config.videoUrl);
  const mostrarFotos = !temVideoConfigurado || usarFotosFallback;
  const videoAtivo = temVideoConfigurado && permiteVideo && !usarFotosFallback;
  const descricao = projetoDescricao?.trim() || "";
  const textos = [
    config.frase || "Alguns momentos merecem ser revividos.",
    projetoNome,
  ];
  if (!montado) return null;
  // Portal evita que transforms/overflows do painel distorçam a prévia.
  return createPortal(
    <section
      ref={telaRef}
      tabIndex={-1}
      className={`${introDescriptionFont.variable} fci-intro fci-${config.estilo}`}
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
        {mostrarFotos && fotos.map((foto, i) => (
          <img key={`${foto.pastaId}/${foto.arquivo}`} src={foto.url} alt="" loading="eager"
            className={i === (etapa % fotos.length) ? "visible" : ""}
            style={{ animationDuration: `${config.duracao}s` }} />
        ))}
        {videoAtivo && (
          <video ref={videoRef} className={`fci-video${videoPronto ? " visible" : ""}`}
            src={config.videoUrl ?? undefined}
            autoPlay muted loop playsInline preload="metadata" aria-hidden="true"
            onPlaying={() => setVideoPronto(true)}
            // Durante buffering conservamos o último frame do vídeo, sem mostrar fotos.
            onError={() => { setPermiteVideo(false); setVideoPronto(false); setUsarFotosFallback(true); }}
            onCanPlay={() => {
              void videoRef.current?.play().catch(() => {
                setPermiteVideo(false); setVideoPronto(false); setUsarFotosFallback(true);
              });
            }}
          />
        )}
        <div className="fci-shade" />
      </div>
      <div className="fci-top">
        <span className="fci-studio">{studioNome || "FOTURA"}</span>
        <button type="button" className="fci-skip" onClick={(event) => { event.stopPropagation(); onFinish(); }}>
          {preview ? "Fechar prévia" : "Pular introdução"}
        </button>
      </div>
      <div className="fci-center" aria-live="polite">
        <div className="fci-eyebrow">{etapa === 2 ? "SUAS FOTOGRAFIAS" : "UMA HISTÓRIA PARA REVIVER"}</div>
        {etapa === 2
          ? (descricao ? <p key={etapa} className={`fci-description${descricao.length > 240 ? " fci-description-long" : ""}`}>{descricao}</p> : null)
          : <h1 key={etapa} className="fci-title">{textos[etapa]}</h1>}
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
.fci-images,.fci-images img,.fci-shade,.fci-video{position:absolute;inset:0;width:100%;height:100%}
.fci-video{object-fit:cover;opacity:0;transition:opacity 1.1s ease;pointer-events:none}
.fci-video.visible{opacity:1}
.fci-images img{object-fit:cover;opacity:0;transform:scale(1.015);transition:opacity 2.15s cubic-bezier(.22,1,.36,1);animation:fci-zoom linear both;will-change:transform}
.fci-images img.visible{opacity:1}
.fci-minimalista .fci-images img{opacity:1}
.fci-editorial .fci-images img{transition-duration:1.45s}
.fci-shade{background:linear-gradient(180deg,rgba(3,4,14,.68),rgba(4,5,13,.56) 38%,rgba(3,4,14,.79)),rgba(5,5,10,.22)}
.fci-top{position:absolute;left:0;right:0;top:0;padding:clamp(22px,4vw,48px);display:flex;justify-content:space-between;align-items:flex-start;gap:16px;z-index:2}
.fci-studio{min-width:0;max-width:58%;color:#fff!important;font-size:12px;letter-spacing:.18em;line-height:1.5;font-weight:700;text-transform:uppercase;text-shadow:0 1px 8px #0008;white-space:normal;overflow-wrap:break-word}
.fci-skip{flex:none;color:rgba(255,255,255,.87);background:rgba(15,17,29,.22);border:1px solid rgba(255,255,255,.25);border-radius:999px;font:inherit;font-size:11px;font-weight:500;padding:9px 13px;cursor:pointer;backdrop-filter:blur(5px);transition:background .2s,border-color .2s}
.fci-skip:hover{background:rgba(15,17,29,.44);border-color:rgba(255,255,255,.5)}
.fci-intro:focus{outline:none}
.fci-skip:focus-visible{outline:2px solid #a8b9ff;outline-offset:3px}
.fci-center{position:relative;max-width:min(900px,90vw);padding:32px;text-align:center;z-index:1}
.fci-eyebrow{color:#f6f4ff!important;font-size:clamp(10px,1.3vw,13px);letter-spacing:.24em;opacity:.94;margin-bottom:24px;font-weight:600}
.fci-intro h1.fci-title{color:#fff!important;font-weight:500;letter-spacing:-.038em;font-size:clamp(38px,7vw,86px);line-height:1.17;text-wrap:balance;text-shadow:0 4px 24px rgba(0,0,0,.85),0 2px 6px #000;animation:fci-fade 1.25s ease both}
.fci-intro .fci-description{margin:0 auto;max-width:720px;max-height:54vh;padding:0 8px;overflow-y:auto;overscroll-behavior:contain;overflow-wrap:anywhere;white-space:pre-line;color:#fff!important;font-family:var(--font-intro-editorial),"Iowan Old Style",Baskerville,Georgia,serif!important;font-size:clamp(23px,2.6vw,34px);font-weight:300;line-height:1.52;letter-spacing:.005em;text-wrap:pretty;text-shadow:0 3px 18px rgba(0,0,0,.9),0 1px 5px #000;animation:fci-fade 1.25s ease both}
.fci-intro .fci-description-long{font-size:clamp(20px,2.2vw,28px);line-height:1.56}
.fci-bottom{position:absolute;bottom:clamp(24px,5vw,56px);left:0;right:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:2}
.fci-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.fci-progress{display:flex;gap:6px}
.fci-progress i{display:block;height:3px;width:36px;border-radius:8px;background:#ffffff55;transition:background .3s}
.fci-progress i.current{background:#fff}
.fci-progress i.complete{background:#ffffffaa}
@keyframes fci-zoom{from{transform:scale(1.015)}to{transform:scale(1.075)}}
@keyframes fci-fade{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:650px){.fci-top{padding:24px 18px;gap:12px}.fci-studio{font-size:11px;max-width:calc(100% - 150px);flex:1;letter-spacing:.13em;line-height:1.55;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:break-word}.fci-center{padding:14px}.fci-intro h1.fci-title{font-size:clamp(32px,9.5vw,54px)}.fci-intro .fci-description{max-width:min(100%,36rem);font-size:clamp(21px,5.1vw,25px);line-height:1.47;max-height:56dvh}.fci-intro .fci-description-long{font-size:clamp(19px,4.6vw,22px);line-height:1.5}.fci-eyebrow{letter-spacing:.15em}.fci-bottom{bottom:24px}}
@media(prefers-reduced-motion:reduce){.fci-images img,.fci-title,.fci-description,.fci-progress i,.fci-video{animation:none!important;transition:none!important}.fci-images img{transform:none!important}}
`;
