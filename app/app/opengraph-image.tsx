import { ImageResponse } from "next/og";

export const alt = "Fotura — Galerias profissionais para fotógrafos";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #090917 0%, #101024 58%, #0b0b1a 100%)",
          color: "#f0f0f5",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 540,
            height: 540,
            borderRadius: 999,
            right: -110,
            top: -190,
            background: "rgba(93, 13, 250, .24)",
            filter: "blur(70px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 420,
            height: 420,
            borderRadius: 999,
            left: -150,
            bottom: -180,
            background: "rgba(17, 150, 252, .17)",
            filter: "blur(70px)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "76px 86px",
            width: "100%",
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 54,
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 7,
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                transform: "rotate(45deg)",
                background: "linear-gradient(135deg, #1196fc, #5d0dfa)",
              }}
            />
            FOTURA
          </div>
          <div
            style={{
              maxWidth: 870,
              fontSize: 66,
              lineHeight: 1.04,
              letterSpacing: -3,
              fontWeight: 700,
            }}
          >
            Galerias profissionais para fotógrafos.
          </div>
          <div
            style={{
              maxWidth: 760,
              marginTop: 26,
              fontSize: 25,
              lineHeight: 1.45,
              color: "#9096b0",
            }}
          >
            Prova online, seleção de fotos e entrega ao cliente em uma experiência com a sua marca.
          </div>
          <div
            style={{
              marginTop: 52,
              fontSize: 19,
              color: "#777f9f",
            }}
          >
            foturax.com.br
          </div>
        </div>
      </div>
    ),
    size,
  );
}
