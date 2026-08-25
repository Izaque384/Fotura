"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase-client";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const supabase = createClient();

  async function handleSubmit() {
    if (!email.trim()) return;
    setCarregando(true);
    setErro("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    if (error) {
      setErro(error.message);
    } else {
      setEnviado(true);
    }

    setCarregando(false);
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
        maxWidth: 400,
        border: "1px solid #2a2d40",
      }}>
        <div style={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: 4,
          color: "#f0f0f5",
          textAlign: "center",
          marginBottom: 8,
        }}>
          FOTURA
        </div>
        <p style={{
          fontSize: 14,
          color: "#7a7f9a",
          textAlign: "center",
          marginBottom: 32,
        }}>
          Recuperação de senha
        </p>

        {enviado ? (
          <>
            <div style={{
              background: "#122b1f",
              border: "1px solid #22c55e44",
              borderRadius: 10,
              padding: "16px 18px",
              marginBottom: 24,
            }}>
              <p style={{ fontSize: 14, color: "#4ade80", margin: 0, lineHeight: 1.6 }}>
                E-mail enviado! Verifique sua caixa de entrada (e o spam) para redefinir sua senha.
              </p>
            </div>

            <Link href="/login" style={{
              display: "block",
              textAlign: "center",
              fontSize: 13,
              color: "#4a6cf7",
              textDecoration: "underline",
            }}>
              Voltar ao login
            </Link>
          </>
        ) : (
          <>
            <label style={{ fontSize: 13, color: "#a0a4b8", display: "block", marginBottom: 6 }}>
              E-mail da sua conta
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="seu@email.com"
              style={{
                width: "100%",
                padding: "12px 14px",
                fontSize: 14,
                border: "1.5px solid #2a2d40",
                borderRadius: 10,
                background: "#0f0f1a",
                color: "#f0f0f5",
                outline: "none",
                marginBottom: 24,
              }}
            />

            <button
              onClick={handleSubmit}
              disabled={carregando}
              style={{
                width: "100%",
                padding: "13px",
                fontSize: 14,
                fontWeight: 600,
                color: "#fff",
                background: carregando ? "#3b5de0" : "#4a6cf7",
                border: "none",
                borderRadius: 10,
                cursor: carregando ? "default" : "pointer",
              }}
            >
              {carregando ? "Enviando..." : "Enviar link de recuperação"}
            </button>

            {erro && (
              <p style={{
                fontSize: 13,
                textAlign: "center",
                marginTop: 16,
                color: "#ef4444",
              }}>
                {erro}
              </p>
            )}

            <p style={{ fontSize: 13, color: "#7a7f9a", textAlign: "center", marginTop: 24 }}>
              <Link href="/login" style={{
                color: "#4a6cf7",
                textDecoration: "underline",
              }}>
                Voltar ao login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}