import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { temAcessoGaleria } from "../../../../lib/gallery-access";
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

function heroSvg(corBase: string, estilo: string) {
  const cor = corSegura(corBase);
  const preset = estilo === "minimal" || estilo === "tech" ? estilo : "premium";
  let decoracao = "";

  if (preset === "minimal") {
    decoracao = `
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${cor}" stop-opacity=".82"/>
          <stop offset=".48" stop-color="#0b1716"/>
          <stop offset="1" stop-color="#050812"/>
        </linearGradient>
        <radialGradient id="soft" cx="20%" cy="16%" r="65%">
          <stop offset="0" stop-color="#4ac98b" stop-opacity=".08"/>
          <stop offset="1" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1600" height="700" fill="url(#bg)"/>
      <rect width="1600" height="700" fill="url(#soft)"/>`;
  } else if (preset === "tech") {
    decoracao = `
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#050b0d"/>
          <stop offset=".50" stop-color="${cor}" stop-opacity=".72"/>
          <stop offset="1" stop-color="#050812"/>
        </linearGradient>
        <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="#72dda6" opacity=".12"/>
        </pattern>
        <radialGradient id="centerGlow" cx="50%" cy="43%" r="46%">
          <stop offset="0" stop-color="#61d99a" stop-opacity=".22"/>
          <stop offset=".58" stop-color="#3ea978" stop-opacity=".07"/>
          <stop offset="1" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#65d89b" stop-opacity="0"/>
          <stop offset=".5" stop-color="#65d89b" stop-opacity=".42"/>
          <stop offset="1" stop-color="#65d89b" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="1600" height="700" fill="url(#bg)"/>
      <rect width="1600" height="700" fill="url(#grid)"/>
      <rect width="1600" height="700" fill="url(#centerGlow)"/>
      <circle cx="800" cy="360" r="330" fill="none" stroke="#6be0a3" stroke-width="1" opacity=".07"/>
      <circle cx="800" cy="360" r="255" fill="none" stroke="#6be0a3" stroke-width="1" opacity=".055"/>
      <path d="M0 382H125l72-72h176l64 64h190M1600 382h-125l-72-72h-176l-64 64H973" fill="none" stroke="#6be0a3" stroke-width="1" opacity=".18"/>
      <path d="M0 520H240l42-42h220M1600 520h-240l-42-42h-220" fill="none" stroke="#6be0a3" stroke-width="1" opacity=".08"/>
      <rect x="360" y="295" width="880" height="1" fill="url(#line)" opacity=".5"/>`;
  } else {
    decoracao = `
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${cor}" stop-opacity=".88"/>
          <stop offset=".46" stop-color="#0c1917"/>
          <stop offset="1" stop-color="#050812"/>
        </linearGradient>
        <radialGradient id="leftGlow" cx="24%" cy="42%" r="48%">
          <stop offset="0" stop-color="#43bd80" stop-opacity=".12"/>
          <stop offset="1" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="vignette" cx="50%" cy="45%" r="72%">
          <stop offset=".55" stop-color="#000000" stop-opacity="0"/>
          <stop offset="1" stop-color="#000000" stop-opacity=".34"/>
        </radialGradient>
      </defs>
      <rect width="1600" height="700" fill="url(#bg)"/>
      <rect width="1600" height="700" fill="url(#leftGlow)"/>
      <rect width="1600" height="700" fill="url(#vignette)"/>`;
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
  const { data: g } = await supabase
    .from("galerias")
    .select("user_id,capa,link_ate,tem_senha,etapa,prova")
    .eq("id", galeria)
    .maybeSingle();

  if (!g) return json({ error: "Galeria não encontrada." }, 404);
  const linkAte = (g.link_ate as string | null) ?? null;
  if (linkAte && Date.now() > new Date(`${linkAte}T23:59:59`).getTime()) return json({ error: "Link expirado." }, 403);
  if (g.tem_senha && !temAcessoGaleria(req, galeria)) return json({ error: "Acesso à galeria necessário." }, 401);

  const dono = g.user_id as string;
  const { data: perfil } = await supabase
    .from("perfis")
    .select("hero_galeria_ativo,hero_galeria_estilo,cor_hero")
    .eq("id", dono)
    .maybeSingle();
  const usarHeroEstudio = Boolean(perfil?.hero_galeria_ativo);
  const heroEstilo = (perfil?.hero_galeria_estilo as string | null) ?? "premium";
  const heroCor = (perfil?.cor_hero as string | null) ?? "#0b0b1a";

  const etapa = (g.etapa as string | null) || (g.prova ? "prova" : "entrega");
  const entregaFinal = etapa === "entrega";
  const base = entregaFinal ? `${dono}/${galeria}/entrega` : `${dono}/${galeria}`;
  const lista: Array<{ name: string }> = [];
  let offset = 0;
  while (true) {
    const { data: arquivos, error: listError } = await supabase.storage.from("fotos").list(base, {
      limit: LISTA_LOTE,
      offset,
      sortBy: { column: "created_at", order: "asc" },
    });
    if (listError) return json({ error: "Não foi possível listar a galeria." }, 500);
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
  let erroAssinatura = false;
  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= lotes.length || erroAssinatura) return;
      const { data, error } = await supabase.storage.from("fotos").createSignedUrls(lotes[i], EXPIRA_SEG);
      if (error) { erroAssinatura = true; return; }
      for (const s of data ?? []) if (s.signedUrl && s.path) mapa[s.path] = s.signedUrl;
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCORRENCIA_ASSINATURA, lotes.length) }, () => worker()));
  if (erroAssinatura) return json({ error: "Não foi possível assinar os arquivos." }, 500);

  const fotos = lista.map((f) => {
    const url = mapa[`${base}/${f.name}`] ?? "";
    const thumb = mapa[`${base}/thumbs/${f.name}`] || url;
    return { nome: f.name, url, thumb };
  });
  const capaNome = capaFile && lista.some((f) => f.name === capaFile) ? capaFile : lista[0]?.name;
  const capaUrl = usarHeroEstudio ? heroSvg(heroCor, heroEstilo) : (capaNome ? (mapa[`${base}/${capaNome}`] ?? null) : null);
  return json({ fotos, capaUrl, etapa });
}
