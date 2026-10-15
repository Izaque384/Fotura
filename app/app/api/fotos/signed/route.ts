import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { temAcessoGaleria } from "../../../../lib/gallery-access";
import { registrarErro } from "../../../../lib/observability";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { uuidValido } from "../../../../lib/validation";
import { dataCalendarioExpirada } from "../../../../lib/date-only";
import { planoFotura } from "../../../../lib/billing-plans";
import { heroPresetDataUrl, estiloHeroEfetivo } from "../../../../lib/gallery-hero";
import { createGalleryWatermarkUrl } from "../../../../lib/gallery-watermark-token";
import { ordenarFotos } from "../../../../lib/gallery-photo-order";

export const dynamic = "force-dynamic";
const EXPIRA_SEG = 3600;
const LISTA_LOTE = 1000;
const ASSINATURA_LOTE = 200;
const CONCORRENCIA_ASSINATURA = 3;
const ORIGINAIS_PREASSINADOS_GRADE = 0;
const STATUS_COM_ACESSO = new Set(["active", "trialing", "past_due"]);

function json(data: unknown, status = 200, retryAfter?: number) {
  const headers: Record<string, string> = { "Cache-Control": "no-store, private" };
  if (retryAfter) headers["Retry-After"] = String(retryAfter);
  return NextResponse.json(data, { status, headers });
}

export async function GET(req: NextRequest) {
  const galeria = req.nextUrl.searchParams.get("galeria")?.trim();
  const modoParam = req.nextUrl.searchParams.get("modo")?.trim();
  const modo = modoParam === "originais" ? "originais" : modoParam === "completo" ? "completo" : "grade";
  const arquivo = req.nextUrl.searchParams.get("arquivo")?.trim() || null;
  if (!uuidValido(galeria)) return json({ error: "galeria inválida." }, 400);

  const permitido = await consumirRateLimit(req, arquivo ? "signed_gallery_file" : "signed_gallery_urls", galeria, 60, arquivo ? 120 : 40);
  if (!permitido) return json({ error: "Muitas solicitações. Aguarde um minuto." }, 429, 60);

  const supabase = createServiceClient();
  const { data: g, error: galleryError } = await supabase
    .from("galerias")
    .select("user_id,capa,visivel,link_ate,tem_senha,etapa,prova,ordem_fotos,download_ativo,download_tamanho,watermark_ativo,watermark_texto,watermark_opacidade")
    .eq("id", galeria)
    .maybeSingle();

  if (galleryError) {
    registrarErro("gallery.signed.lookup", req, galleryError, { galeria });
    return json({ error: "Não foi possível verificar a galeria." }, 500);
  }
  if (!g || g.visivel === false) return json({ error: "Galeria não encontrada." }, 404);
  const linkAte = (g.link_ate as string | null) ?? null;
  if (dataCalendarioExpirada(linkAte)) return json({ error: "Link expirado." }, 403);
  if (g.tem_senha && !temAcessoGaleria(req, galeria)) return json({ error: "Acesso à galeria necessário." }, 401);

  const dono = g.user_id as string;
  const etapa = (g.etapa as string | null) || (g.prova ? "prova" : "entrega");
  const entregaFinalDeProva = etapa === "entrega" && Boolean(g.prova);
  const base = entregaFinalDeProva ? `${dono}/${galeria}/entrega` : `${dono}/${galeria}`;
  const protegerOriginais = Boolean(g.watermark_ativo) && etapa !== "entrega";
  const originalHabilitado = etapa === "entrega" && Boolean(g.download_ativo) && g.download_tamanho === "original";

  if (arquivo) {
    if (arquivo.includes("/") || arquivo.includes("\\") || arquivo === "." || arquivo === "..") {
      return json({ error: "Arquivo inválido." }, 400);
    }
    if (!originalHabilitado) {
      return json({ error: "Alta resolução não está habilitada para esta galeria." }, 403);
    }
    const caminho = `${base}/${arquivo}`;
    const { data, error } = await supabase.storage.from("fotos").createSignedUrl(caminho, EXPIRA_SEG);
    if (error || !data?.signedUrl) {
      registrarErro("gallery.signed.single", req, error || new Error("signed url missing"), { galeria, arquivo });
      return json({ error: "Não foi possível assinar o arquivo." }, 404);
    }
    return json({ nome: arquivo, url: data.signedUrl, etapa, watermarkProtected: false });
  }

  if ((modo === "originais" || modo === "completo") && !originalHabilitado) {
    return json({ error: "Originais não estão habilitados para esta galeria." }, 403);
  }

  const [{ data: perfil, error: profileError }, { data: assinatura, error: billingError }] = await Promise.all([
    supabase.from("perfis").select("hero_galeria_ativo,hero_galeria_estilo,hero_foto_capa_ativo,cor_hero,nome_estudio").eq("id", dono).maybeSingle(),
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

  type FotoListada={name:string;largura?:number;altura?:number;bytes?:number;mimeType?:string|null;criadoEm?:string|null};
  let lista:FotoListada[]=[];
  const variante=entregaFinalDeProva?"entrega":"principal";
  const { data: catalogo, error: catalogoError } = await supabase.rpc("listar_fotos_galeria_storage", {
    p_galeria: galeria,
    p_user: dono,
    p_variante: variante,
  });
  if (!catalogoError && Array.isArray(catalogo)) {
    lista = catalogo.map((item: {nome?:unknown;largura?:unknown;altura?:unknown;bytes?:unknown;mime_type?:unknown;criado_em?:unknown}) => ({
      name: String(item.nome || ""),
      largura: typeof item.largura === "number" ? item.largura : undefined,
      altura: typeof item.altura === "number" ? item.altura : undefined,
      bytes: typeof item.bytes === "number" ? item.bytes : undefined,
      mimeType: typeof item.mime_type === "string" ? item.mime_type : null,
      criadoEm: typeof item.criado_em === "string" ? item.criado_em : null,
    })).filter((item:FotoListada)=>Boolean(item.name));
  } else {
    registrarErro("gallery.signed.catalog_fallback", req, catalogoError || new Error("catalog unavailable"), { galeria, variante });
    let offset=0;
    while(true){
      const { data: arquivos, error: listError } = await supabase.storage.from("fotos").list(base, {
        limit: LISTA_LOTE,
        offset,
        sortBy: { column: "created_at", order: "asc" },
      });
      if (listError) {
        registrarErro("gallery.signed.storage_list", req, listError, { galeria });
        return json({ error: "Não foi possível listar a galeria." }, 500);
      }
      const pagina=arquivos??[];
      lista.push(...pagina.filter((item)=>item.id!==null&&item.name!=="thumbs"&&item.name!=="entrega").map((item)=>({name:item.name,criadoEm:item.created_at??null})));
      if(pagina.length<LISTA_LOTE)break;
      offset+=LISTA_LOTE;
    }
  }

  lista=ordenarFotos(lista,(g.ordem_fotos as string|null)??"upload");

  if (lista.length === 0) {
    return json({ fotos: [], capaUrl: usarHeroEstudio ? heroPresetDataUrl(heroCor, heroEstilo) : null, etapa });
  }

  const capaFile = (g.capa as string | null) ?? null;
  const capaNome = capaFile && lista.some((f) => f.name === capaFile) ? capaFile : lista[0]?.name;

  if (protegerOriginais) {
    const watermarkTexto = ((g.watermark_texto as string | null) ?? (perfil?.nome_estudio as string | null) ?? "FOTURA").trim() || "FOTURA";
    const watermarkOpacidade = Number(g.watermark_opacidade ?? 22);
    try {
      const urlProtegida = (nome: string) => createGalleryWatermarkUrl({
        g: galeria,
        u: dono,
        f: nome,
        t: watermarkTexto,
        o: watermarkOpacidade,
      });
      const fotos = lista.map((f) => {
        const url = urlProtegida(f.name);
        return { nome: f.name, url, thumb: url, largura:f.largura, altura:f.altura, bytes:f.bytes, mimeType:f.mimeType };
      });
      const fotoCapaUrl = usarFotoHero && capaNome ? urlProtegida(capaNome) : null;
      const marcadorPreset = usarHeroEstudio ? `#fotura-hero-${heroEstilo}` : "";
      const capaUrl = usarFotoHero && fotoCapaUrl
        ? `${fotoCapaUrl}${marcadorPreset}`
        : usarHeroEstudio
          ? heroPresetDataUrl(heroCor, heroEstilo)
          : null;
      return json({ fotos, capaUrl, etapa, modo, watermarkProtected: true });
    } catch (error) {
      registrarErro("gallery.signed.watermark_urls", req, error, { galeria, modo });
      return json({ error: "Não foi possível proteger as prévias." }, 503);
    }
  }

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

  let caminhos: string[] = [];
  if (protegerOriginais) {
    caminhos = lista.map((f) => `${base}/thumbs/${f.name}`);
  } else if (modo === "grade") {
    caminhos = lista.map((f) => `${base}/thumbs/${f.name}`);
    caminhos.push(...lista.slice(0, ORIGINAIS_PREASSINADOS_GRADE).map((f) => `${base}/${f.name}`));
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

  const fotos = lista.map((f) => {
    const original = mapa[`${base}/${f.name}`] ?? "";
    const thumbAssinada = mapa[`${base}/thumbs/${f.name}`] ?? "";
    if (modo === "grade") {
      const preview = thumbAssinada || original;
      return { nome: f.name, url: preview, thumb: preview, largura:f.largura, altura:f.altura, bytes:f.bytes, mimeType:f.mimeType };
    }
    if (modo === "originais") {
      const protegida = protegerOriginais ? (thumbAssinada || original) : original;
      return { nome: f.name, url: protegida, thumb: protegida, largura:f.largura, altura:f.altura, bytes:f.bytes, mimeType:f.mimeType };
    }
    return { nome: f.name, url: protegerOriginais ? (thumbAssinada || original) : original, thumb: thumbAssinada || original, largura:f.largura, altura:f.altura, bytes:f.bytes, mimeType:f.mimeType };
  });

  const fotoCapaUrl = usarFotoHero && capaNome ? (mapa[`${base}/thumbs/${capaNome}`] ?? mapa[`${base}/${capaNome}`] ?? null) : null;
  const marcadorPreset = usarHeroEstudio ? `#fotura-hero-${heroEstilo}` : "";
  const capaUrl = usarFotoHero && fotoCapaUrl
    ? `${fotoCapaUrl}${marcadorPreset}`
    : usarHeroEstudio
      ? heroPresetDataUrl(heroCor, heroEstilo)
      : null;
  return json({ fotos, capaUrl, etapa, modo, watermarkProtected: protegerOriginais });
}
