import { ImageResponse } from "next/og";
import { resolvePublicGalleryRef } from "../../../lib/gallery-public-ref.server";
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

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const galeria = await resolvePublicGalleryRef(slug);

  let titulo = "Galeria";
  let estudio = "Fotura";
  let cor = "#17152b";
  let logoUrl: string | null = null;

  if (galeria) {
    titulo = galeria.titulo;

    const supabase = createServiceClient();
    const { data: perfil } = await supabase
      .from("perfis")
      .select("nome_estudio,logo_url,cor_hero")
      .eq("id", galeria.userId)
      .maybeSingle();

    estudio = String(perfil?.nome_estudio || "Fotura");
    cor = String(perfil?.cor_hero || "#17152b");
    logoUrl = (perfil?.logo_url as string | null) ?? null;
  }

  const logo = await carregarLogo(logoUrl);
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
          background: "linear-gradient(135deg, #090913 0%, #11101d 58%, #0b0b14 100%)",
          color: "#ffffff",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 620,
            height: 620,
            borderRadius: 999,
            right: -190,
            top: -250,
            background: cor,
            opacity: 0.24,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 420,
            height: 420,
            borderRadius: 999,
            left: -180,
            bottom: -210,
            background: "#1196fc",
            opacity: 0.08,
          }}
        />

        <div
          style={{
            width: "100%",
            height: "100%",
            padding: "58px 82px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: 300,
              height: 220,
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
                  maxWidth: "300px",
                  maxHeight: "220px",
                  objectFit: "contain",
                }}
              />
            ) : (
              <div
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255,255,255,.08)",
                  border: "1px solid rgba(255,255,255,.12)",
                  fontSize: 68,
                  fontWeight: 800,
                }}
              >
                {inicial}
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: 26,
              fontSize: 23,
              color: "#a7acc0",
              fontWeight: 600,
              letterSpacing: 0.2,
            }}
          >
            {estudio}
          </div>

          <div
            style={{
              marginTop: 12,
              maxWidth: 930,
              textAlign: "center",
              fontSize: 54,
              lineHeight: 1.05,
              letterSpacing: -1.8,
              fontWeight: 760,
            }}
          >
            {titulo}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
