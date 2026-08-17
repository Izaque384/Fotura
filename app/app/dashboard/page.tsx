"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-client";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function verificarUsuario() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        // Não está logado → manda pro login
        router.replace("/login");
      } else {
        setEmail(data.user.email ?? null);
        setCarregando(false);
      }
    }
    verificarUsuario();
  }, [router, supabase]);

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (carregando) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(180deg, #0b0b1a 0%, #111126 100%)",
        color: "#7a7f9a",
        fontFamily: "sans-serif",
      }}>
        Carregando...
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(180deg, #0b0b1a 0%, #111126 100%)",
      fontFamily: "sans-serif",
      padding: 24,
    }}>
      <div style={{
        background: "#16162a",
        borderRadius: 16,
        padding: 40,
        width: "100%",
        maxWidth: 480,
        border: "1px solid #2a2d40",
        textAlign: "center",
      }}>
        <div style={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: 4,
          color: "#f0f0f5",
          marginBottom: 12,
        }}>
          FOTURA
        </div>
        <p style={{ fontSize: 16, color: "#f0f0f5", marginBottom: 4 }}>
          Bem-vindo! 🎉
        </p>
        <p style={{ fontSize: 13, color: "#7a7f9a", marginBottom: 32 }}>
          Você está logado como{" "}
          <strong style={{ color: "#a0a4b8" }}>{email}</strong>
        </p>
        <button
          onClick={sair}
          style={{
            width: "100%",
            padding: "13px",
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            background: "#4a6cf7",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          Sair
        </button>
      </div>
    </div>
  );
}
