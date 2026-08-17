import { createClient } from "../lib/supabase-client";

export default function Home() {
  const supabase = createClient();

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(180deg, #0b0b1a 0%, #111126 100%)",
      fontFamily: "sans-serif",
    }}>
      <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: 6, color: "#f0f0f5" }}>
        FOTURA
      </div>
      <p style={{ fontSize: 16, color: "#7a7f9a", marginTop: 12 }}>
        A forma mais bonita de entregar fotos
      </p>
      <div style={{
        marginTop: 32,
        padding: "12px 28px",
        background: "#22c55e",
        color: "#fff",
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 600,
      }}>
        ✅ Supabase conectado
      </div>
    </div>
  );
}