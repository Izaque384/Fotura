"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-client";
import MenuFotografo from "../MenuFotografo";

export default function ConfiguracoesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [nomeEstudio, setNomeEstudio] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState(false);

  useEffect(() => {
    async function carregar() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      // Busca o perfil que já existe (se existir)
      const { data } = await supabase
        .from("perfis")
        .select("nome_estudio")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (data?.nome_estudio) setNomeEstudio(data.nome_estudio);
      setCarregando(false);
    }
    carregar();
  }, [router, supabase]);

  async function salvar() {
    setErro(false);
    setMensagem("");

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }

    setSalvando(true);
    const { error } = await supabase.from("perfis").upsert({
      id: userData.user.id,
      nome_estudio: nomeEstudio.trim(),
      atualizado_em: new Date().toISOString(),
    });

    if (error) {
      setErro(true);
      setMensagem("Erro ao salvar: " + error.message);
    } else {
      setMensagem("Salvo com sucesso!");
    }
    setSalvando(false);
  }

  if (carregando) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg, #0b0b1a 0%, #111126 100%)", color: "#7a7f9a" }}>
        Carregando...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #0b0b1a 0%, #111126 100%)", display: "flex", flexDirection: "column" }}>
      <MenuFotografo />

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#16162a", borderRadius: 16, padding: 40, width: "100%", maxWidth: 480, border: "1px solid #2a2d40" }}>
          <p style={{ fontSize: 18, fontWeight: 600, color: "#f0f0f5", textAlign: "center", marginBottom: 4 }}>
            Configurações
          </p>
          <p style={{ fontSize: 13, color: "#7a7f9a", textAlign: "center", marginBottom: 28 }}>
            A marca que aparece na galeria dos seus clientes
          </p>

          <label style={{ fontSize: 13, color: "#a0a4b8", display: "block", marginBottom: 6 }}>
            Nome do estúdio
          </label>
          <input
            type="text"
            value={nomeEstudio}
            onChange={(e) => setNomeEstudio(e.target.value)}
            placeholder="Ex: JI Motion"
            style={{ width: "100%", padding: "12px 14px", fontSize: 14, border: "1.5px solid #2a2d40", borderRadius: 10, background: "#0f0f1a", color: "#f0f0f5", outline: "none", marginBottom: 24, boxSizing: "border-box" }}
          />

          <button
            onClick={salvar}
            disabled={salvando}
            style={{ width: "100%", padding: "13px", fontSize: 14, fontWeight: 600, color: "#fff", background: salvando ? "#3b5de0" : "#4a6cf7", border: "none", borderRadius: 10, cursor: salvando ? "default" : "pointer" }}
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>

          {mensagem && (
            <p style={{ fontSize: 13, textAlign: "center", marginTop: 16, color: erro ? "#ef4444" : "#22c55e" }}>
              {mensagem}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
