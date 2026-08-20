"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase-client";
import MenuFotografo from "../MenuFotografo";

function gerarSlug(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function tituloDeSlug(slug: string) {
  const t = slug.replace(/-/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function UploadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState(false);
  const [arquivos, setArquivos] = useState<FileList | null>(null);
  const [nomeGaleria, setNomeGaleria] = useState("");
  const [link, setLink] = useState("");

  const galeriaFixa = searchParams.get("galeria");
  const nomeTravado = Boolean(galeriaFixa);

  useEffect(() => {
    async function verificarUsuario() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
      } else {
        if (galeriaFixa) {
          setNomeGaleria(tituloDeSlug(galeriaFixa));
        }
        setCarregando(false);
      }
    }
    verificarUsuario();
  }, [router, supabase, galeriaFixa]);

  async function enviarFotos() {
    setErro(false);
    setLink("");
    setMensagem("");

    const slug = nomeTravado ? galeriaFixa! : gerarSlug(nomeGaleria);
    if (!slug) {
      setErro(true);
      setMensagem("Dê um nome pra galeria (ex: Casamento Ana).");
      return;
    }
    if (!arquivos || arquivos.length === 0) {
      setErro(true);
      setMensagem("Escolha pelo menos uma foto.");
      return;
    }

    setEnviando(true);

    let enviadas = 0;
    for (const arquivo of Array.from(arquivos)) {
      const nomeLimpo = arquivo.name.replace(/\s+/g, "-");
      const caminho = `${slug}/${Date.now()}-${nomeLimpo}`;
      const { error } = await supabase.storage.from("fotos").upload(caminho, arquivo);
      if (error) {
        setErro(true);
        setMensagem("Erro ao enviar " + arquivo.name + ": " + error.message);
        setEnviando(false);
        return;
      }
      enviadas++;
    }

    setMensagem(`${enviadas} foto(s) enviada(s) com sucesso!`);
    setLink(`${window.location.origin}/g/${slug}`);
    setEnviando(false);
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(link);
      setErro(false);
      setMensagem("Link copiado!");
    } catch {
      setErro(true);
      setMensagem("Não consegui copiar — copie o link manualmente.");
    }
  }

  if (carregando) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg, #0b0b1a 0%, #111126 100%)", color: "#7a7f9a" }}>
        Carregando...
      </div>
    );
  }

  return (
    <div className="mf-shift" style={{ minHeight: "100vh", background: "linear-gradient(180deg, #0b0b1a 0%, #111126 100%)", display: "flex", flexDirection: "column" }}>
      <MenuFotografo />

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#16162a", borderRadius: 16, padding: 40, width: "100%", maxWidth: 480, border: "1px solid #2a2d40" }}>
          <p style={{ fontSize: 18, fontWeight: 600, color: "#f0f0f5", textAlign: "center", marginBottom: 4 }}>
            {nomeTravado ? "Enviar mais fotos" : "Nova galeria"}
          </p>
          <p style={{ fontSize: 13, color: "#7a7f9a", textAlign: "center", marginBottom: 28 }}>
            {nomeTravado ? tituloDeSlug(galeriaFixa!) : "Dê um nome e escolha as fotos"}
          </p>

          <label style={{ fontSize: 13, color: "#a0a4b8", display: "block", marginBottom: 6 }}>
            Nome da galeria
          </label>
          <input
            type="text"
            value={nomeGaleria}
            onChange={(e) => setNomeGaleria(e.target.value)}
            placeholder="Ex: Casamento Ana e João"
            disabled={nomeTravado}
            style={{ width: "100%", padding: "12px 14px", fontSize: 14, border: "1.5px solid #2a2d40", borderRadius: 10, background: nomeTravado ? "#14141f" : "#0f0f1a", color: nomeTravado ? "#7a7f9a" : "#f0f0f5", outline: "none", marginBottom: 20, boxSizing: "border-box" }}
          />

          <label style={{ fontSize: 13, color: "#a0a4b8", display: "block", marginBottom: 6 }}>
            Fotos
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setArquivos(e.target.files)}
            style={{ width: "100%", fontSize: 13, color: "#a0a4b8", marginBottom: 24 }}
          />

          <button
            onClick={enviarFotos}
            disabled={enviando}
            style={{ width: "100%", padding: "13px", fontSize: 14, fontWeight: 600, color: "#fff", background: enviando ? "#3b5de0" : "#4a6cf7", border: "none", borderRadius: 10, cursor: enviando ? "default" : "pointer" }}
          >
            {enviando ? "Enviando..." : "Enviar fotos"}
          </button>

          {mensagem && (
            <p style={{ fontSize: 13, textAlign: "center", marginTop: 16, color: erro ? "#ef4444" : "#22c55e" }}>
              {mensagem}
            </p>
          )}

          {link && (
            <div style={{ marginTop: 20, padding: 16, background: "#0f0f1a", border: "1px solid #2a2d40", borderRadius: 10 }}>
              <p style={{ fontSize: 12, color: "#7a7f9a", marginBottom: 8 }}>
                Link pra enviar ao cliente:
              </p>
              <p style={{ fontSize: 13, color: "#4a6cf7", wordBreak: "break-all", marginBottom: 12 }}>
                {link}
              </p>
              <button
                onClick={copiarLink}
                style={{ width: "100%", padding: "10px", fontSize: 13, fontWeight: 600, color: "#4a6cf7", background: "transparent", border: "1px solid #4a6cf7", borderRadius: 8, cursor: "pointer" }}
              >
                Copiar link
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg, #0b0b1a 0%, #111126 100%)", color: "#7a7f9a" }}>
          Carregando...
        </div>
      }
    >
      <UploadContent />
    </Suspense>
  );
}