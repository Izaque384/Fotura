import { ImageResponse } from "next/og";
import { resolvePublicProjectRef } from "../../../lib/project-public-ref.server";
import { createServiceClient } from "../../../lib/supabase-server";

export const runtime = "nodejs";
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

  if (projeto) {
    titulo = projeto.nome;

    const supabase = createServiceClient();
    const { data: perfil } = await supabase
      .from("perfis")
      .select("nome_estudio,logo_url,cor_hero")
      .eq("id", projeto.userId)
      .maybeSingle();

    estudio = String(perfil?.nome_estudio || "Fotura");
    cor = String(perfil?.cor_hero || "#17152b");
    logoUrl = (perfil?.logo_url as string | null) ?? null;
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
