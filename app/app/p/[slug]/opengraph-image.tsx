import { ImageResponse } from "next/og";
import sharp from "sharp";
import { resolvePublicProjectRef } from "../../../lib/project-public-ref.server";
import { createServiceClient } from "../../../lib/supabase-server";
import { dataCalendarioExpirada } from "../../../lib/date-only";
import { podeExibirCapaOG } from "../../../lib/project-og-cover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function carregarLogo(url: string | null) {
  if (!url) return null;
  try {
    const resposta = await fetch(url, { cache: "no-store" });
    if (!resposta.ok) return null;
    const tipo = resposta.headers.get("content-type") || "image/png";
    const bytes = Buffer.from(await resposta.arrayBuffer()).toString("base64");
    return `data:${tipo};base64,${bytes}`;
  } catch {
    return null;
  }
}

function corTexto(hex: string) {
  const limpa = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(limpa)) return "#ffffff";
  const r = parseInt(limpa.slice(0, 2), 16);
  const g = parseInt(limpa.slice(2, 4), 16);
  const b = parseInt(limpa.slice(4, 6), 16);
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.68 ? "#17182a" : "#ffffff";
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const projeto = await resolvePublicProjectRef(slug);

  let titulo = "Projeto";
  let estudio = "Fotura";
  let cor = "#17152b";
  let logoUrl: string | null = null;
  let capa: string | null = null;

  if (projeto) {
    titulo = projeto.nome;

    const supabase = createServiceClient();
    const [{ data: perfil }, { data: dadosProjeto }] = await Promise.all([
      supabase.from("perfis")
        .select("nome_estudio,logo_url,cor_hero")
        .eq("id", projeto.userId).maybeSingle(),
      supabase.from("galeria_projetos")
        .select("capa_galeria_id,capa_arquivo,tem_senha,og_capa_autorizada,link_ate")
        .eq("id", projeto.id).eq("user_id", projeto.userId).maybeSingle(),
    ]);

    estudio = String(perfil?.nome_estudio || "Fotura");
    cor = String(perfil?.cor_hero || "#17152b");
    logoUrl = (perfil?.logo_url as string | null) ?? null;

    const pastaId = dadosProjeto?.capa_galeria_id;
    const arquivo = dadosProjeto?.capa_arquivo;
    if (pastaId && arquivo && !arquivo.includes("/") && !arquivo.includes("\\\\")) {
      const { data: pasta } = await supabase.from("galerias")
        .select("id").eq("id", pastaId).eq("projeto_id", projeto.id)
        .eq("user_id", projeto.userId).eq("visivel", true).maybeSingle();

      if (podeExibirCapaOG({
        temSenha: Boolean(dadosProjeto?.tem_senha),
        autorizada: Boolean(dadosProjeto?.og_capa_autorizada),
        expirada: dataCalendarioExpirada(dadosProjeto?.link_ate ?? null),
        capaConfigurada: true,
        pastaPublicada: Boolean(pasta),
      })) {
        // O Storage continua privado; a imagem não expõe URLs assinadas nem
        // quaisquer outras fotografias. Só esta capa é renderizada pelo servidor.
        const caminho = `${projeto.userId}/${pastaId}/thumbs/${arquivo}`;
        const { data: blob } = await supabase.storage.from("fotos").download(caminho);
        if (blob && blob.size <= 12_000_000) {
          try {
            const foto = await sharp(Buffer.from(await blob.arrayBuffer()))
              .rotate().resize(1200, 630, { fit: "cover", position: "attention" })
              .jpeg({ quality: 82, progressive: true }).toBuffer();
            capa = `data:image/jpeg;base64,${foto.toString("base64")}`;
          } catch {
            // Thumb removida ou ilegível: retorna a arte padrão já existente.
          }
        }
      }
    }
  }

  if (capa) {
    return new ImageResponse(
      <div style={{
        width: "100%", height: "100%", position: "relative", overflow: "hidden",
        display: "flex", alignItems: "flex-end",
        backgroundColor: "#10111e", fontFamily: "Arial, sans-serif",
      }}>
        <img src={capa} alt="" style={{
          position: "absolute", left: 0, top: 0, width: "100%", height: "100%",
          objectFit: "cover",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, rgba(9,10,19,.08) 5%, rgba(9,10,19,.17) 38%, rgba(9,10,19,.90) 100%)",
        }} />
        <div style={{
          position: "relative", display: "flex", flexDirection: "column",
          justifyContent: "flex-end", padding: "56px 72px", width: "100%",
          color: "#fff",
        }}>
          <div style={{
            display: "flex", fontSize: 21, fontWeight: 700,
            letterSpacing: 1.3, color: "#f3f0ff",
          }}>{estudio}</div>
          <div style={{
            display: "flex", maxWidth: 1000, marginTop: 16,
            fontSize: titulo.length > 60 ? 42 : titulo.length > 34 ? 50 : 61,
            lineHeight: 1.1, letterSpacing: -1.1, fontWeight: 750,
            overflowWrap: "break-word",
          }}>{titulo}</div>
          <div style={{
            display: "flex", width: 72, height: 4, marginTop: 28,
            borderRadius: 999, backgroundColor: "#ffffff",
          }} />
        </div>
      </div>,
      size,
    );
  }

  const logo = await carregarLogo(logoUrl);
  const texto = corTexto(cor);
  const textoSuave = texto === "#ffffff" ? "rgba(255,255,255,.76)" : "rgba(23,24,42,.7)";
  const linha = texto === "#ffffff" ? "rgba(255,255,255,.24)" : "rgba(23,24,42,.16)";
  const inicial = estudio.trim().charAt(0).toUpperCase() || "F";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: cor,
          color: texto,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            padding: "68px 86px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 72,
            position: "relative",
          }}
        >
          <div
            style={{
              width: 320,
              height: 320,
              flex: "0 0 320px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {logo ? (
              <img
                src={logo}
                alt={estudio}
                style={{
                  maxWidth: "260px",
                  maxHeight: "260px",
                  objectFit: "contain",
                }}
              />
            ) : (
              <div
                style={{
                  width: 168,
                  height: 168,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 34,
                  border: `1px solid ${linha}`,
                  fontSize: 72,
                  fontWeight: 800,
                }}
              >
                {inicial}
              </div>
            )}
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                fontSize: 22,
                lineHeight: 1.2,
                fontWeight: 700,
                color: textoSuave,
                letterSpacing: 1.2,
              }}
            >
              {estudio}
            </div>

            <div
              style={{
                marginTop: 22,
                maxWidth: 650,
                fontSize: titulo.length > 34 ? 52 : 62,
                lineHeight: 1.04,
                letterSpacing: -2.2,
                fontWeight: 760,
              }}
            >
              {titulo}
            </div>

            <div
              style={{
                width: 74,
                height: 4,
                marginTop: 30,
                borderRadius: 999,
                background: texto,
                opacity: 0.7,
              }}
            />
          </div>
        </div>
      </div>
    ),
    size,
  );
}
