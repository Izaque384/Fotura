"use client";

import { useEffect, useState } from "react";

type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean; effectiveType?: string };
};

// A imagem permanece visível até o vídeo realmente começar a tocar.
// Economia de dados e movimento reduzido usam apenas a imagem estática.
export default function LandingHeroVideo() {
  const [permitirVideo, setPermitirVideo] = useState(false);
  const [reproduzindo, setReproduzindo] = useState(false);

  useEffect(() => {
    const preferencia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const atualizar = () => {
      const rede = (navigator as NavigatorWithConnection).connection;
      const conexaoLenta = rede?.effectiveType === "slow-2g" || rede?.effectiveType === "2g";
      setPermitirVideo(!preferencia.matches && !rede?.saveData && !conexaoLenta);
    };
    atualizar();
    preferencia.addEventListener("change", atualizar);
    return () => preferencia.removeEventListener("change", atualizar);
  }, []);

  return (
    <div className="lp2-hero-media" aria-hidden="true">
      <img
        className="lp2-hero-poster"
        src="/media/fotura-abertura-poster.jpg"
        alt=""
        fetchPriority="high"
      />
      {permitirVideo && (
        <video
          className={"lp2-hero-video" + (reproduzindo ? " is-playing" : "")}
          src="/media/fotura-abertura-web-720p.mp4"
          poster="/media/fotura-abertura-poster.jpg"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          disablePictureInPicture
          disableRemotePlayback
          tabIndex={-1}
          onPlaying={() => setReproduzindo(true)}
          onError={() => { setReproduzindo(false); setPermitirVideo(false); }}
          onPause={() => setReproduzindo(false)}
        />
      )}
      <div className="lp2-hero-scrim" />
    </div>
  );
}
