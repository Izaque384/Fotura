import { ImageResponse } from "next/og";
import { resolvePublicGalleryRef } from "../../../lib/gallery-public-ref.server";
import { createServiceClient } from "../../../lib/supabase-server";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const galeria = await resolvePublicGalleryRef(slug);

  let titulo = "Sua galeria";
  let estudio = "Fotura";
  let cor = "#101024";

  if (galeria) {
    titulo = galeria.titulo;
    const supabase = createServiceClient();
    const { data: perfil } = await supabase
      .from("perfis")
      .select("nome_estudio,cor_hero")
      .eq("id", galeria.userId)
      .maybeSingle();
    estudio = String(perfil?.nome_estudio || "Fotura");
    cor = String(perfil?.cor_hero || "#101024");
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg,#090917 0%,#101024 58%,#0b0b1a 100%)",
          color: "#fff",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 620,
            height: 620,
            borderRadius: 999,
            right: -120,
            top: -240,
            background: cor,
            opacity: 0.28,
            filter: "blur(80px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 430,
            height: 430,
            borderRadius: 999,
            left: -180,
            bottom: -180,
            background: "#1196fc",
            opacity: 0.14,
            filter: "blur(70px)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: "100%",
            padding: "72px 82px",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 22, letterSpacing: 6, fontWeight: 700, color: "#aab0c8" }}>
            <div style={{ width: 15, height: 15, borderRadius: 5, transform: "rotate(45deg)", background: "linear-gradient(135deg,#1196fc,#5d0dfa)" }} />
            FOTURA
          </div>
          <div style={{ marginTop: 54, fontSize: 24, color: "#9ea5bd", fontWeight: 600 }}>
            {estudio}
          </div>
          <div style={{ marginTop: 13, maxWidth: 930, fontSize: 68, lineHeight: 1.02, letterSpacing: -3, fontWeight: 750 }}>
            {titulo}
          </div>
          <div style={{ marginTop: 34, fontSize: 22, color: "#858ca8" }}>
            Galeria de fotos compartilhada com você
          </div>
        </div>
      </div>
    ),
    size,
  );
}
