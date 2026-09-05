import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { temAcessoGaleria } from "../../../../lib/gallery-access";
import { registrarErro } from "../../../../lib/observability";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { uuidValido } from "../../../../lib/validation";

export const dynamic = "force-dynamic";
const EXPIRA_SEG = 3600;
const LISTA_LOTE = 1000;
const ASSINATURA_LOTE = 200;
const CONCORRENCIA_ASSINATURA = 3;

function json(data: unknown, status = 200, retryAfter?: number) {
  const headers: Record<string, string> = { "Cache-Control": "no-store, private" };
  if (retryAfter) headers["Retry-After"] = String(retryAfter);
  return NextResponse.json(data, { status, headers });
}

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

function heroSvg(corBase: string, estilo: string) {
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
        <linearGradient id="premiumLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${paleta.detalhe}" stop-opacity="0"/>
          <stop offset=".18" stop-color="${paleta.detalhe}" stop-opacity=".17"/>
          <stop offset=".50" stop-color="${paleta.detalhe}" stop-opacity=".42"/>
          <stop offset=".82" stop-color="${paleta.detalhe}" stop-opacity=".17"/>
          <stop offset="1" stop-color="${paleta.detalhe}" stop-opacity="0"/>
        </linearGradient>
        <filter id="premiumGlow" x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="1.55" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="1600" height="700" fill="url(#bg)"/>
      <rect width="1600" height="700" fill="url(#leftGlow)"/>
      <rect width="1600" height="700" fill="url(#vignette)"/>

      <g fill="none" stroke="url(#premiumLine)" stroke-linecap="round" filter="url(#premiumGlow)">
        <path d="M-50 82 C42 48 118 112 218 86 C314 62 374 34 462 58 C518 74 550 86 612 72" stroke-width="1.15" opacity=".38"/>
        <path d="M-18 156 C72 126 134 190 228 160 C306 136 350 106 422 120" stroke-width="1" opacity=".25"/>
        <path d="M-44 548 C64 514 132 586 230 552 C316 522 358 500 434 514" stroke-width="1.12" opacity=".34"/>
        <path d="M28 634 C104 606 160 656 242 630 C304 612 342 588 402 598" stroke-width=".95" opacity=".22"/>

        <path d="M1650 98 C1556 60 1480 126 1382 98 C1288 72 1232 48 1142 68 C1088 80 1052 90 998 78" stroke-width="1.15" opacity=".37"/>
        <path d="M1618 172 C1530 140 1466 198 1374 170 C1300 148 1258 120 1186 132" stroke-width="1" opacity=".24"/>
        <path d="M1644 536 C1540 504 1472 576 1374 542 C1290 514 1246 492 1174 506" stroke-width="1.12" opacity=".33"/>
        <path d="M1578 628 C1500 602 1446 646 1364 622 C1302 604 1268 584 1210 594" stroke-width=".95" opacity=".21"/>
      </g>

      <g fill="none" stroke="${paleta.detalhe}" stroke-linecap="round" filter="url(#premiumGlow)">
        <path d="M54 58h116M54 58q-22 0-22 22v32" stroke-width="1.05" opacity=".24"/>
        <path d="M1546 66h-112M1546 66q22 0 22 22v30" stroke-width="1.05" opacity=".24"/>
        <path d="M68 626h102M68 626q-22 0-22-22v-30" stroke-width="1.05" opacity=".20"/>
        <path d="M1532 620h-102M1532 620q22 0 22-22v-28" stroke-width="1.05" opacity=".20"/>
      </g>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="700" viewBox="0 0 1600 700">${decoracao}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}#fotura-hero-${preset}`;
}

export async function GET(req: NextRequest) {
  const galeria = req.nextUrl.searchParams.get("galeria")?.trim();
  if (!uuidValido(galeria)) return json({ error: "galeria inválida." }, 400);

  const permitido = await consumirRateLimit(req, "signed_gallery_urls", galeria, 60, 40);
  if (!permitido) return json({ error: "Muitas solicitações. Aguarde um minuto." }, 429, 60);

  const supabase = createServiceClient();
  const { data: g, error: galleryError } = await supabase
    .from("galerias")
    .select("user_id,capa,link_ate,tem_senha,etapa,prova")
    .eq("id", galeria)
    .maybeSingle();

  if (galleryError) {
    registrarErro("gallery.signed.lookup", req, galleryError, { galeria });
    return json({ error: "Não foi possível verificar a galeria." }, 500);
  }
  if (!g) return json({ error: "Galeria não encontrada." }, 404);
  const linkAte = (g.link_ate as string | null) ?? null;
  if (linkAte && Date.now() > new Date(`${linkAte}T23:59:59`).getTime()) return json({ error: "Link expirado." }, 403);
  if (g.tem_senha && !temAcessoGaleria(req, galeria)) return json({ error: "Acesso à galeria necessário." }, 401);

  const dono = g.user_id as string;
  const { data: perfil, error: profileError } = await supabase
    .from("perfis")
    .select("hero_galeria_ativo,hero_galeria_estilo,cor_hero")
    .eq("id", dono)
    .maybeSingle();
  if (profileError) {
    registrarErro("gallery.signed.profile", req, profileError, { galeria });
    return json({ error: "Não foi possível carregar a identidade da galeria." }, 500);
  }
  const usarHeroEstudio = Boolean(perfil?.hero_galeria_ativo);
  const heroEstilo = (perfil?.hero_galeria_estilo as string | null) ?? "premium";
  const heroCor = (perfil?.cor_hero as string | null) ?? "#0b0b1a";

  const etapa = (g.etapa as string | null) || (g.prova ? "prova" : "entrega");
  const entregaFinalDeProva = etapa === "entrega" && Boolean(g.prova);
  const base = entregaFinalDeProva ? `${dono}/${galeria}/entrega` : `${dono}/${galeria}`;
  const lista: Array<{ name: string }> = [];
  let offset = 0;
  while (true) {
    const { data: arquivos, error: listError } = await supabase.storage.from("fotos").list(base, {
      limit: LISTA_LOTE,
      offset,
      sortBy: { column: "created_at", order: "asc" },
    });
    if (listError) {
      registrarErro("gallery.signed.storage_list", req, listError, { galeria });
      return json({ error: "Não foi possível listar a galeria." }, 500);
    }
    const pagina = arquivos ?? [];
    lista.push(...pagina.filter((f) => f.id !== null && f.name !== "thumbs").map((f) => ({ name: f.name })));
    if (pagina.length < LISTA_LOTE) break;
    offset += LISTA_LOTE;
  }

  if (lista.length === 0) return json({ fotos: [], capaUrl: usarHeroEstudio ? heroSvg(heroCor, heroEstilo) : null, etapa });

  const caminhos: string[] = [];
  for (const f of lista) {
    caminhos.push(`${base}/${f.name}`);
    caminhos.push(`${base}/thumbs/${f.name}`);
  }
  const capaFile = (g.capa as string | null) ?? null;
  if (capaFile && lista.some((f) => f.name === capaFile) && !caminhos.includes(`${base}/${capaFile}`)) caminhos.push(`${base}/${capaFile}`);

  const lotes: string[][] = [];
  for (let i = 0; i < caminhos.length; i += ASSINATURA_LOTE) lotes.push(caminhos.slice(i, i + ASSINATURA_LOTE));
  const mapa: Record<string, string> = {};
  let cursor = 0;
  let erroAssinatura: unknown = null;
  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= lotes.length || erroAssinatura) return;
      const { data, error } = await supabase.storage.from("fotos").createSignedUrls(lotes[i], EXPIRA_SEG);
      if (error) { erroAssinatura = error; return; }
      for (const s of data ?? []) if (s.signedUrl && s.path) mapa[s.path] = s.signedUrl;
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCORRENCIA_ASSINATURA, lotes.length) }, () => worker()));
  if (erroAssinatura) {
    registrarErro("gallery.signed.sign_urls", req, erroAssinatura, { galeria });
    return json({ error: "Não foi possível assinar os arquivos." }, 500);
  }

  const fotos = lista.map((f) => {
    const url = mapa[`${base}/${f.name}`] ?? "";
    const thumb = mapa[`${base}/thumbs/${f.name}`] || url;
    return { nome: f.name, url, thumb };
  });
  const capaNome = capaFile && lista.some((f) => f.name === capaFile) ? capaFile : lista[0]?.name;
  const capaUrl = usarHeroEstudio ? heroSvg(heroCor, heroEstilo) : (capaNome ? (mapa[`${base}/${capaNome}`] ?? null) : null);
  return json({ fotos, capaUrl, etapa });
}
