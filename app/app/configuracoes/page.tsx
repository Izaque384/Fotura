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
  const [corHero, setCorHero] = useState("#0b0b1a");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState(false);

  useEffect(() => {
    async function carregar() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase
        .from("perfis")
        .select("nome_estudio, logo_url, cor_hero")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (data?.nome_estudio) setNomeEstudio(data.nome_estudio);
      if (data?.logo_url) setLogoUrl(data.logo_url);
      if (data?.cor_hero) setCorHero(data.cor_hero);
      setCarregando(false);
    }
    carregar();
  }, [router, supabase]);

  async function enviarLogo(arquivo: File) {
    setErro(false);
    setMensagem("");

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }

    setEnviandoLogo(true);

    const ext = arquivo.name.split(".").pop() || "png";
    const caminho = `${userData.user.id}/logo-${Date.now()}.${ext}`;

    const { error: erroUpload } = await supabase.storage
      .from("marca")
      .upload(caminho, arquivo);

    if (erroUpload) {
      setErro(true);
      setMensagem("Erro ao enviar o logo: " + erroUpload.message);
      setEnviandoLogo(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("marca").getPublicUrl(caminho);
    const url = urlData.publicUrl;

    const { error: erroPerfil } = await supabase.from("perfis").upsert({
      id: userData.user.id,
      logo_url: url,
      atualizado_em: new Date().toISOString(),
    });

    if (erroPerfil) {
      setErro(true);
      setMensagem("Logo enviado, mas houve erro ao salvar: " + erroPerfil.message);
    } else {
      setLogoUrl(url);
      setMensagem("Logo atualizado!");
    }
    setEnviandoLogo(false);
  }

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
      cor_hero: corHero,
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

          <label style={{ fontSize: 13, color: "#a0a4b8", display: "block", marginBottom: 10 }}>
            Logo do estúdio
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: 12, border: "1px solid #2a2d40", background: "#0f0f1a", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              ) : (
                <span style={{ fontSize: 11, color: "#5a5f78" }}>sem logo</span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) enviarLogo(f);
                }}
                disabled={enviandoLogo}
                style={{ width: "100%", fontSize: 13, color: "#a0a4b8" }}
              />
              <p style={{ fontSize: 11, color: "#5a5f78", marginTop: 6 }}>
                {enviandoLogo ? "Enviando logo..." : "PNG com fundo transparente fica melhor."}
              </p>
            </div>
          </div>

          <label style={{ fontSize: 13, color: "#a0a4b8", display: "block", marginBottom: 10 }}>
            Cor de fundo da galeria
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
            <input
              type="color"
              value={corHero}
              onChange={(e) => setCorHero(e.target.value)}
              style={{ width: 52, height: 52, border: "1px solid #2a2d40", borderRadius: 10, background: "#0f0f1a", cursor: "pointer", padding: 4, boxSizing: "border-box" }}
            />
            <div>
              <p style={{ fontSize: 14, color: "#f0f0f5", margin: 0, textTransform: "uppercase", letterSpacing: 1 }}>{corHero}</p>
              <p style={{ fontSize: 11, color: "#5a5f78", margin: "2px 0 0" }}>Fundo do topo da galeria do cliente</p>
            </div>
          </div>

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
