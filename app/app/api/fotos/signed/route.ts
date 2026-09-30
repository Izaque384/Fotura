import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { temAcessoGaleria } from "../../../../lib/gallery-access";
import { registrarErro } from "../../../../lib/observability";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { uuidValido } from "../../../../lib/validation";
import { dataCalendarioExpirada } from "../../../../lib/date-only";
import { planoFotura } from "../../../../lib/billing-plans";
import { heroPresetDataUrl, estiloHeroEfetivo } from "../../../../lib/gallery-hero";

export const dynamic = "force-dynamic";
const EXPIRA_SEG = 3600;
const LISTA_LOTE = 1000;
const ASSINATURA_LOTE = 200;
const CONCORRENCIA_ASSINATURA = 3;
const STATUS_COM_ACESSO = new Set(["active", "trialing", "past_due"]);

function json(data: unknown, status = 200, retryAfter?: number) {
  const headers: Record<string, string> = { "Cache-Control": "no-store, private" };
  if (retryAfter) headers["Retry-After"] = String(retryAfter);
  return NextResponse.json(data, { status, headers });
}

export async function GET(req: NextRequest) {
  const galeria = req.nextUrl.searchParams.get("galeria")?.trim();
  const modoParam = req.nextUrl.searchParams.get("modo")?.trim();
  const modo = modoParam === "grade" || modoParam === "originais" ? modoParam : "completo";
  const arquivo = req.nextUrl.searchParams.get("arquivo")?.trim() || null;
  if (!uuidValido(galeria)) return json({ error: "galeria inválida." }, 400);

  const permitido = await consumirRateLimit(req, arquivo ? "signed_gallery_file" : "signed_gallery_urls", galeria, 60, arquivo ? 120 : 40);
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
  if (dataCalendarioExpirada(linkAte)) return json({ error: "Link expirado." }, 403);
  if (g.tem_senha && !temAcessoGaleria(req, galeria)) return json({ error: "Acesso à galeria necessário." }, 401);

  const dono = g.user_id as string;
  const [{ data: perfil, error: profileError }, { data: assinatura, error: billingError }] = await Promise.all([
    supabase.from("perfis").select("hero_galeria_ativo,hero_galeria_estilo,hero_foto_capa_ativo,cor_hero").eq("id", dono).maybeSingle(),
    supabase.from("assinaturas").select("plano_codigo,status").eq("user_id", dono).maybeSingle(),
  ]);
  if (profileError || billingError) {
    registrarErro("gallery.signed.identity", req, profileError || billingError, { galeria });
    return json({ error: "Não foi possível carregar a identidade da galeria." }, 500);
  }

  const status = (assinatura?.status as string | null) ?? "active";
  const plano = STATUS_COM_ACESSO.has(status)
    ? planoFotura((assinatura?.plano_codigo as string | null) ?? "sem_plano")
    : planoFotura("sem_plano");
  const usarHeroEstudio = Boolean(perfil?.hero_galeria_ativo) && plano.recursos.heroEstudio;
  const heroEstilo = estiloHeroEfetivo((perfil?.hero_galeria_estilo as string | null) ?? "premium", plano.recursos.heroPremiumTech);
  const heroCor = (perfil?.cor_hero as string | null) ?? "#0b0b1a";
  const usarFotoHero = usarHeroEstudio && Boolean(perfil?.hero_foto_capa_ativo) && plano.recursos.heroFotoGaleria;

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

  if (lista.length === 0) {
    return json({ fotos: [], capaUrl: usarHeroEstudio ? heroPresetDataUrl(heroCor, heroEstilo) : null, etapa });
  }

  const capaFile = (g.capa as string | null) ?? null;
  const capaNome = capaFile && lista.some((f) => f.name === capaFile) ? capaFile : lista[0]?.name;

  const assinar = async (entrada: string[]) => {
    const caminhos = [...new Set(entrada)];
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
    await Promise.all(Array.from({ length: Math.min(CONCORRENCIA_ASSINATURA, Math.max(1, lotes.length)) }, () => worker()));
    return { mapa, erroAssinatura };
  };

  if (arquivo) {
    if (!lista.some((f) => f.name === arquivo)) return json({ error: "Arquivo não encontrado." }, 404);
    const caminho = `${base}/${arquivo}`;
    const { mapa, erroAssinatura } = await assinar([caminho]);
    if (erroAssinatura || !mapa[caminho]) {
      registrarErro("gallery.signed.single", req, erroAssinatura || new Error("signed url missing"), { galeria, arquivo });
      return json({ error: "Não foi possível assinar o arquivo." }, 500);
    }
    return json({ nome: arquivo, url: mapa[caminho], etapa });
  }

  let caminhos: string[] = [];
  if (modo === "grade") {
    caminhos = lista.map((f) => `${base}/thumbs/${f.name}`);
    if (usarFotoHero && capaNome) caminhos.push(`${base}/${capaNome}`);
  } else if (modo === "originais") {
    caminhos = lista.map((f) => `${base}/${f.name}`);
  } else {
    for (const f of lista) {
      caminhos.push(`${base}/${f.name}`);
      caminhos.push(`${base}/thumbs/${f.name}`);
    }
  }

  const assinaturaInicial = await assinar(caminhos);
  if (assinaturaInicial.erroAssinatura) {
    registrarErro("gallery.signed.sign_urls", req, assinaturaInicial.erroAssinatura, { galeria, modo });
    return json({ error: "Não foi possível assinar os arquivos." }, 500);
  }
  const mapa = assinaturaInicial.mapa;

  if (modo === "grade") {
    const semThumb = lista
      .filter((f) => !mapa[`${base}/thumbs/${f.name}`])
      .map((f) => `${base}/${f.name}`);
    if (semThumb.length) {
      const fallback = await assinar(semThumb);
      if (fallback.erroAssinatura) {
        registrarErro("gallery.signed.thumb_fallback", req, fallback.erroAssinatura, { galeria });
      } else {
        Object.assign(mapa, fallback.mapa);
      }
    }
  }

  const fotos = lista.map((f) => {
    const original = mapa[`${base}/${f.name}`] ?? "";
    const thumbAssinada = mapa[`${base}/thumbs/${f.name}`] ?? "";
    if (modo === "grade") {
      const preview = thumbAssinada || original;
      return { nome: f.name, url: preview, thumb: preview };
    }
    if (modo === "originais") return { nome: f.name, url: original, thumb: original };
    return { nome: f.name, url: original, thumb: thumbAssinada || original };
  });

  const fotoCapaUrl = usarFotoHero && capaNome ? (mapa[`${base}/${capaNome}`] ?? null) : null;
  const marcadorPreset = usarHeroEstudio ? `#fotura-hero-${heroEstilo}` : "";
  const capaUrl = usarFotoHero && fotoCapaUrl
    ? `${fotoCapaUrl}${marcadorPreset}`
    : usarHeroEstudio
      ? heroPresetDataUrl(heroCor, heroEstilo)
      : null;
  return json({ fotos, capaUrl, etapa, modo });
}
