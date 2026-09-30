export type GalleryHeroStyle = "minimal" | "premium" | "tech";

function corSegura(valor: string | null | undefined) {
  const cor = (valor || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : "#0b0b1a";
}

function hexRgb(hex: string) {
  const cor = corSegura(hex).slice(1);
  return {
    r: parseInt(cor.slice(0, 2), 16),
    g: parseInt(cor.slice(2, 4), 16),
    b: parseInt(cor.slice(4, 6), 16),
  };
}

function rgbHex(r: number, g: number, b: number) {
  const canal = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${canal(r)}${canal(g)}${canal(b)}`;
}

function misturarCores(a: string, b: string, pesoB: number) {
  const ca = hexRgb(a);
  const cb = hexRgb(b);
  const p = Math.max(0, Math.min(1, pesoB));
  return rgbHex(
    ca.r * (1 - p) + cb.r * p,
    ca.g * (1 - p) + cb.g * p,
    ca.b * (1 - p) + cb.b * p,
  );
}

function paletaHero(corBase: string) {
  const base = corSegura(corBase);
  const ancoraEscura = "#07110f";
  return {
    base,
    esquerda: misturarCores(base, ancoraEscura, 0.68),
    meio: misturarCores(base, ancoraEscura, 0.82),
    direita: misturarCores(base, ancoraEscura, 0.90),
    brilho: misturarCores(base, "#ffffff", 0.18),
    detalhe: misturarCores(base, "#d7ffe8", 0.34),
  };
}

export function heroPresetDataUrl(corBase: string, estilo: string) {
  const cor = corSegura(corBase);
  const paleta = paletaHero(cor);
  const preset = estilo === "minimal" || estilo === "tech" ? estilo : "premium";
  let decoracao = "";

  if (preset === "minimal") {
    decoracao = `
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${paleta.esquerda}"/>
          <stop offset=".54" stop-color="${paleta.meio}"/>
          <stop offset="1" stop-color="${paleta.direita}"/>
        </linearGradient>
        <radialGradient id="soft" cx="20%" cy="16%" r="65%">
          <stop offset="0" stop-color="${paleta.brilho}" stop-opacity=".12"/>
          <stop offset="1" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1600" height="700" fill="url(#bg)"/>
      <rect width="1600" height="700" fill="url(#soft)"/>`;
  } else if (preset === "tech") {
    decoracao = `
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${paleta.direita}"/>
          <stop offset=".48" stop-color="${paleta.esquerda}"/>
          <stop offset="1" stop-color="${paleta.direita}"/>
        </linearGradient>
        <pattern id="grid" width="26" height="26" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1.05" fill="${paleta.detalhe}" opacity=".22"/>
        </pattern>
        <radialGradient id="centerGlow" cx="50%" cy="45%" r="48%">
          <stop offset="0" stop-color="${paleta.brilho}" stop-opacity=".36"/>
          <stop offset=".52" stop-color="${paleta.esquerda}" stop-opacity=".18"/>
          <stop offset="1" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${paleta.detalhe}" stop-opacity="0"/>
          <stop offset=".5" stop-color="${paleta.detalhe}" stop-opacity=".82"/>
          <stop offset="1" stop-color="${paleta.detalhe}" stop-opacity="0"/>
        </linearGradient>
        <filter id="techGlow" x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="1.7" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="1600" height="700" fill="url(#bg)"/>
      <rect width="1600" height="700" fill="url(#grid)"/>
      <rect width="1600" height="700" fill="url(#centerGlow)"/>

      <g fill="none" stroke="${paleta.detalhe}" filter="url(#techGlow)">
        <circle cx="800" cy="350" r="345" stroke-width="1.1" opacity=".22"/>
        <circle cx="800" cy="350" r="270" stroke-width="1.05" opacity=".17"/>
        <circle cx="800" cy="350" r="194" stroke-width="1" opacity=".11" stroke-dasharray="7 12"/>
        <path d="M0 378H128l72-72h182l58 58h160M1600 378h-128l-72-72h-182l-58 58H1000" stroke-width="1.25" opacity=".42"/>
        <path d="M0 512H235l44-44h208M1600 512h-235l-44-44h-208" stroke-width="1.1" opacity=".25"/>
        <path d="M0 228h188l38 38h154M1600 228h-188l-38 38h-154" stroke-width="1.1" opacity=".22"/>
        <path d="M90 116h16v16M1494 116h16v16M90 584h16v-16M1494 584h16v-16" stroke-width="1.1" opacity=".48"/>
        <path d="M800 72v54M800 574v54M522 350h54M1024 350h54" stroke-width="1.05" opacity=".32"/>
        <circle cx="800" cy="350" r="5" opacity=".46"/>
      </g>
      <path d="M120 116h92v1h-92zM1388 116h92v1h-92zM120 584h92v1h-92zM1388 584h92v1h-92z" fill="${paleta.detalhe}" opacity=".43"/>
      <rect x="300" y="286" width="1000" height="1.2" fill="url(#line)" opacity=".86"/>
      <rect x="425" y="426" width="750" height="1" fill="url(#line)" opacity=".56"/>
      <circle cx="800" cy="350" r="1.7" fill="${paleta.detalhe}" opacity=".92"/>`;
  } else {
    decoracao = `
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${paleta.esquerda}"/>
          <stop offset=".52" stop-color="${paleta.meio}"/>
          <stop offset="1" stop-color="${paleta.direita}"/>
        </linearGradient>
        <radialGradient id="leftGlow" cx="24%" cy="42%" r="48%">
          <stop offset="0" stop-color="${paleta.brilho}" stop-opacity=".14"/>
          <stop offset="1" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="vignette" cx="50%" cy="45%" r="82%">
          <stop offset=".66" stop-color="#000000" stop-opacity="0"/>
          <stop offset="1" stop-color="#000000" stop-opacity=".10"/>
        </radialGradient>
        <filter id="bokehBlur" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="13"/>
        </filter>
      </defs>
      <rect width="1600" height="700" fill="url(#bg)"/>
      <rect width="1600" height="700" fill="url(#leftGlow)"/>
      <rect width="1600" height="700" fill="url(#vignette)"/>
      <g fill="${paleta.brilho}" filter="url(#bokehBlur)">
        <circle cx="158" cy="126" r="28" opacity=".055"/>
        <circle cx="330" cy="555" r="38" opacity=".045"/>
        <circle cx="520" cy="146" r="19" opacity=".04"/>
        <circle cx="1100" cy="118" r="31" opacity=".04"/>
        <circle cx="1288" cy="520" r="46" opacity=".05"/>
        <circle cx="1470" cy="242" r="23" opacity=".045"/>
      </g>
      <g fill="${paleta.detalhe}">
        <circle cx="260" cy="232" r="4" opacity=".10"/>
        <circle cx="1180" cy="210" r="5" opacity=".08"/>
        <circle cx="1410" cy="438" r="3.5" opacity=".09"/>
      </g>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="700" viewBox="0 0 1600 700">${decoracao}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}#fotura-hero-${preset}`;
}

export function estiloHeroEfetivo(estilo: string, premiumTechLiberado: boolean) {
  if (estilo === "minimal") return "minimal";
  if (premiumTechLiberado && estilo === "tech") return "tech";
  if (premiumTechLiberado && estilo === "premium") return "premium";
  return "minimal";
}

