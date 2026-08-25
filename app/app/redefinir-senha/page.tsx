"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../lib/supabase-client";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const supabase = createClient();

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [sessaoOk, setSessaoOk] = useState(false);
  const [verificando, setVerificando] = useState(true);

  /* Ao abrir a página, o Supabase client lê o hash da URL (#access_token=...&type=recovery)
     e restaura a sessão automaticamente. Aguardamos esse evento. */
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessaoOk(true);
        setVerificando(false);
      }
    });

    /* Fallback: se o evento já disparou antes do listener, checamos a sessão após breve delay */
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSessaoOk(true);
      }
      setVerificando(false);
    }, 2000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRedefinir() {
    setErro("");
    setMensagem("");

    if (novaSenha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmar) {
      setErro("As senhas não coincidem.");
      return;
    }

    setCarregando(true);

    const { error } = await supabase.auth.updateUser({ password: novaSenha });

    if (error) {
      setErro(error.message);
    } else {
      setMensagem("Senha redefinida com sucesso!");
      setTimeout(() => router.push("/dashboard"), 2000);
    }

    setCarregando(false);
  }

  /* ---- Layout ---- */
  const container: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(180deg, #0b0b1a 0%, #111126 100%)",
    fontFamily: "sans-serif",
    padding: 24,
  };

  const card: React.CSSProperties = {
    background: "#16162a",
    borderRadius: 16,
    padding: 40,
    width: "100%",
    maxWidth: 400,
    border: "1px solid #2a2d40",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    fontSize: 14,
    border: "1.5px solid #2a2d40",
    borderRadius: 10,
    background: "#0f0f1a",
    color: "#f0f0f5",
    outline: "none",
    marginBottom: 20,
  };

  /* Verificando sessão */
  if (verificando) {
    return (
      <div style={container}>
        <div style={card}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 4, color: "#f0f0f5", textAlign: "center", marginBottom: 8 }}>
            FOTURA
          </div>
          <p style={{ fontSize: 14, color: "#7a7f9a", textAlign: "center" }}>
            Verificando link de recuperação…
          </p>
        </div>
      </div>
    );
  }

  /* Link inválido / expirado */
  if (!sessaoOk) {
    return (
      <div style={container}>
        <div style={card}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 4, color: "#f0f0f5", textAlign: "center", marginBottom: 8 }}>
            FOTURA
          </div>
          <p style={{ fontSize: 14, color: "#ef4444", textAlign: "center", marginBottom: 24 }}>
            Link inválido ou expirado.
          </p>
          <Link href="/esqueci-senha" style={{
            display: "block",
            textAlign: "center",
            fontSize: 13,
            color: "#4a6cf7",
            textDecoration: "underline",
          }}>
            Solicitar novo link
          </Link>
        </div>
      </div>
    );
  }

  /* Formulário de nova senha */
  return (
    <div style={container}>
      <div style={card}>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 4, color: "#f0f0f5", textAlign: "center", marginBottom: 8 }}>
          FOTURA
        </div>
        <p style={{ fontSize: 14, color: "#7a7f9a", textAlign: "center", marginBottom: 32 }}>
          Defina sua nova senha
        </p>

        {mensagem ? (
          <div style={{
            background: "#122b1f",
            border: "1px solid #22c55e44",
            borderRadius: 10,
            padding: "16px 18px",
          }}>
            <p style={{ fontSize: 14, color: "#4ade80", margin: 0, lineHeight: 1.6 }}>
              {mensagem} Redirecionando…
            </p>
          </div>
        ) : (
          <>
            <label style={{ fontSize: 13, color: "#a0a4b8", display: "block", marginBottom: 6 }}>
              Nova senha
            </label>
            <input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />

            <label style={{ fontSize: 13, color: "#a0a4b8", display: "block", marginBottom: 6 }}>
              Confirmar nova senha
            </label>
            <input
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRedefinir()}
              placeholder="••••••••"
              style={{ ...inputStyle, marginBottom: 24 }}
            />

            <button
              onClick={handleRedefinir}
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
              {carregando ? "Salvando..." : "Redefinir senha"}
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
          </>
        )}
      </div>
    </div>
  );
}