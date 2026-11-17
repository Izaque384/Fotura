"use client";

import HomeClient from "../HomeClient";
import LandingHeroVideo from "../components/LandingHeroVideo";
import type { PricingCurrency } from "../../lib/pricing-markets";
import "./video-background-preview.css";

/**
 * Reaproveita a landing de produção por inteiro.
 * O vídeo sai do hero e fica atrás de todas as seções, na prévia e no site público.
 * Nenhuma animação de rolagem, listener ou vídeo adicional é criado.
 */
export default function VideoBackgroundPreview({ initialCurrency, production = false }: { initialCurrency: PricingCurrency; production?: boolean }) {
  return (
    <div className="lp-video-preview">
      <div className="lp-video-preview-backdrop" aria-hidden="true">
        <LandingHeroVideo />
      </div>
      {!production && <div className="lp-video-preview-banner" role="note">
        <span><i aria-hidden="true" /> CONCEITO 02 — VÍDEO FIXO AO FUNDO</span>
        <a href="https://foturax.com.br/pt" target="_blank" rel="noopener noreferrer">
          Comparar com a landing atual <span aria-hidden="true">↗</span>
        </a>
      </div>}
      <HomeClient initialCurrency={initialCurrency} videoAsPageBackground suppressLandingAnalytics={!production} />
    </div>
  );
}
