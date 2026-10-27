"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { Locale } from "../../lib/i18n";
import type { AberturaPublica } from "../../lib/cinematic-intro";

const ProjectCinematicIntro = dynamic(() => import("./ProjectCinematicIntro"), { ssr: false });

const imagensDemonstracao = [
  "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=88",
  "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1600&q=88",
  "https://images.unsplash.com/photo-1759308730169-9156cb9fe8fe?auto=format&fit=crop&w=1600&q=88",
];

const copy = {
  pt: {
    kicker: "Abertura cinematográfica",
    title: "Antes das fotos, uma história.",
    description: "Transforme o primeiro contato do cliente com o projeto em uma apresentação marcante. Vídeo ou fotografias em tela cheia, o nome de quem viveu aquele momento e palavras escolhidas por você.",
    cta: "Experimentar a abertura",
    hint: "Uma demonstração real, com fotografias ilustrativas.",
    benefits: ["Vídeo ou fotografias", "Mensagem personalizada", "Seu estúdio em destaque"],
    studio: "ATELIÊ FOTOGRAFIA",
    phrase: "Alguns momentos merecem ser revividos.",
    project: "Marina & Pedro",
    story: "Cada encontro, cada detalhe, cada lembrança. Esta é a história de vocês.",
    preview: "Prévia da experiência",
    previewAction: "Abrir demonstração cinematográfica em tela cheia",
    previewNote: "Clique para viver a apresentação",
  },
  en: {
    kicker: "Cinematic introduction",
    title: "Every story begins before the first photo.",
    description: "Make the first moment of every client gallery memorable. Full-screen video or photographs, the names behind the story, and a personal message written by you.",
    cta: "Experience the introduction",
    hint: "A real demonstration with illustrative photographs.",
    benefits: ["Video or photographs", "Personal message", "Your studio in the spotlight"],
    studio: "ATELIER PHOTOGRAPHY",
    phrase: "Some moments deserve to be relived.",
    project: "Marina & Pedro",
    story: "Every encounter, every detail, every memory. This is your story.",
    preview: "Experience preview",
    previewAction: "Open the cinematic introduction in full screen",
    previewNote: "Select to experience the introduction",
  },
  es: {
    kicker: "Apertura cinematográfica",
    title: "Antes de las fotos, una historia.",
    description: "Convierte el primer encuentro del cliente con su galería en una presentación memorable. Vídeo o fotografías a pantalla completa, sus nombres y un mensaje escrito por ti.",
    cta: "Probar la apertura",
    hint: "Una demostración real con fotografías ilustrativas.",
    benefits: ["Vídeo o fotografías", "Mensaje personalizado", "Tu estudio como protagonista"],
    studio: "ATELIER FOTOGRAFÍA",
    phrase: "Hay momentos que merecen revivirse.",
    project: "Marina & Pedro",
    story: "Cada encuentro, cada detalle, cada recuerdo. Esta es vuestra historia.",
    preview: "Vista previa de la experiencia",
    previewAction: "Abrir la apertura cinematográfica a pantalla completa",
    previewNote: "Pulsa para vivir la presentación",
  },
} as const;

export default function LandingCinematicShowcase({ locale }: { locale: Locale }) {
  const [aberto, setAberto] = useState(false);
  const texto = copy[locale];
  const config: AberturaPublica = {
    ativo: true,
    estilo: "cinematografico",
    duracao: 21,
    frase: texto.phrase,
    fotos: imagensDemonstracao.map((url, i) => ({
      url,
      pastaId: "demo",
      arquivo: "foto-" + (i + 1) + ".jpg",
    })),
    fundo: "fotos",
    video: null,
    versao: "landing-demo",
  };

  return (
    <section className="lp2-section lp2-opening-section" aria-labelledby="lp2-opening-title">
      <div className="lp2-shell lp2-opening">
        <div className="lp2-opening-copy">
          <div className="lp2-kicker">{texto.kicker}</div>
          <h2 id="lp2-opening-title">{texto.title}</h2>
          <p>{texto.description}</p>
          <ul className="lp2-opening-benefits">
            {texto.benefits.map((benefit) => <li key={benefit}><span aria-hidden="true" />{benefit}</li>)}
          </ul>
          <button type="button" className="lp2-btn lp2-opening-cta" onClick={() => setAberto(true)}>
            <span className="lp2-opening-play" aria-hidden="true">▶</span>
            {texto.cta}
            <span aria-hidden="true">↗</span>
          </button>
          <p className="lp2-opening-note">{texto.hint}</p>
        </div>

        <button
          type="button"
          className="lp2-opening-preview"
          onClick={() => setAberto(true)}
          aria-label={texto.previewAction}
        >
          <span className="lp2-opening-photo" style={{ backgroundImage: 'url("' + imagensDemonstracao[0] + '")' }} aria-hidden="true" />
          <span className="lp2-opening-vignette" aria-hidden="true" />
          <span className="lp2-opening-preview-top">
            <span className="lp2-opening-studio">{texto.studio}</span>
            <span className="lp2-opening-counter">01 <span>/ 03</span></span>
          </span>
          <span className="lp2-opening-preview-center">
            <span className="lp2-opening-eyebrow">{texto.preview}</span>
            <span className="lp2-opening-quote">{texto.phrase}</span>
            <span className="lp2-opening-names">{texto.project}</span>
          </span>
          <span className="lp2-opening-preview-bottom">
            <span className="lp2-opening-progress"><i /><i /><i /></span>
            <span className="lp2-opening-tap"><span aria-hidden="true">↗</span> {texto.previewNote}</span>
          </span>
        </button>
      </div>

      {aberto && (
        <ProjectCinematicIntro
          preview
          projetoNome={texto.project}
          projetoDescricao={texto.story}
          studioNome={texto.studio}
          config={config}
          onFinish={() => setAberto(false)}
        />
      )}
    </section>
  );
}
