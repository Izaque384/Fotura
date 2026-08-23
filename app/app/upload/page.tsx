"use client";

import { Suspense, useEffect, useRef, useState } from "react";
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
  const [tituloTravado, setTituloTravado] = useState("");
  const [link, setLink] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  const galeriaFixa = searchParams.get("galeria");
  const nomeTravado = Boolean(galeriaFixa);

  useEffect(() => {
    async function verificarUsuario() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      if (galeriaFixa) {
        const { data: g } = await supabase.from("galerias").select("titulo").eq("id", galeriaFixa).maybeSingle();
        setTituloTravado(g?.titulo || "Galeria");
      }
      setCarregando(false);
    }
    verificarUsuario();
  }, [router, supabase, galeriaFixa]);

  async function enviarFotos() {
    setErro(false);
    setLink("");
    setMensagem("");

    if (!arquivos || arquivos.length === 0) {
      setErro(true);
      setMensagem("Escolha pelo menos uma foto.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }
    const uid = userData.user.id;

    let galeriaId = galeriaFixa;
    if (!galeriaId) {
      const t = nomeGaleria.trim();
      if (!t) {
        setErro(true);
        setMensagem("Dê um nome pra galeria (ex: Casamento Ana).");
        return;
      }
      const slug = gerarSlug(t);
      const { data: nova, error: e1 } = await supabase
        .from("galerias")
        .insert({ user_id: uid, slug, titulo: t })
        .select("id")
        .single();
      if (e1 || !nova) {
        setErro(true);
        setMensagem("Erro ao criar a galeria: " + (e1?.message ?? ""));
        return;
      }
      galeriaId = nova.id as string;
    }

    setEnviando(true);

    let enviadas = 0;
    const lista = Array.from(arquivos);
    for (let i = 0; i < lista.length; i++) {
      const arquivo = lista[i];
      const nomeLimpo = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const caminho = `${uid}/${galeriaId}/${Date.now()}-${i}-${nomeLimpo}`;
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
    setLink(`${window.location.origin}/g/${galeriaId}`);
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
      <style>{`
        .up-enviar {
          width: 100%; padding: 15px; font-size: 15px; font-weight: 700; color: #fff;
          border: none; border-radius: 12px; cursor: pointer; font-family: inherit;
          display: flex; align-items: center; justify-content: center; gap: 9px;
          background: linear-gradient(90deg, #1196fc, #5d0dfa);
          box-shadow: 0 10px 28px rgba(74,108,247,0.35);
          transition: transform .15s ease, box-shadow .15s ease, filter .15s ease;
        }
        .up-enviar:hover { transform: translateY(-2px); box-shadow: 0 16px 40px rgba(74,108,247,0.5); }
        .up-enviar:active { transform: translateY(0); }
        .up-enviar:disabled { cursor: default; filter: saturate(0.7) brightness(0.85); box-shadow: none; transform: none; }
        .up-enviar svg { width: 18px; height: 18px; }

        .up-file {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 9px;
          padding: 13px; font-size: 14px; font-weight: 600; font-family: inherit;
          color: #c3c7db; cursor: pointer;
          background: rgba(74,108,247,0.06);
          border: 1.5px dashed #34385a; border-radius: 12px;
          transition: border-color .15s ease, background .15s ease, color .15s ease;
        }
        .up-file:hover { border-color: #4a6cf7; background: rgba(74,108,247,0.10); color: #fff; }
        .up-file svg { width: 18px; height: 18px; color: #7ea2ff; }
        .up-file-status { font-size: 12px; color: #7a7f9a; text-align: center; margin: 10px 0 24px; }
        .up-file-status.tem { color: #8fe3b0; }
      `}</style>
      <MenuFotografo />

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#16162a", borderRadius: 16, padding: 40, width: "100%", maxWidth: 480, border: "1px solid #2a2d40" }}>
          <p style={{ fontSize: 18, fontWeight: 600, color: "#f0f0f5", textAlign: "center", marginBottom: 4 }}>
            {nomeTravado ? "Enviar mais fotos" : "Nova galeria"}
          </p>
          <p style={{ fontSize: 13, color: "#7a7f9a", textAlign: "center", marginBottom: 28 }}>
            {nomeTravado ? tituloTravado : "Dê um nome e escolha as fotos"}
          </p>

          <label style={{ fontSize: 13, color: "#a0a4b8", display: "block", marginBottom: 6 }}>
            Nome da galeria
          </label>
          <input
            type="text"
            value={nomeTravado ? tituloTravado : nomeGaleria}
            onChange={(e) => setNomeGaleria(e.target.value)}
            placeholder="Ex: Casamento Ana e João"
            disabled={nomeTravado}
            style={{ width: "100%", padding: "12px 14px", fontSize: 14, border: "1.5px solid #2a2d40", borderRadius: 10, background: nomeTravado ? "#14141f" : "#0f0f1a", color: nomeTravado ? "#7a7f9a" : "#f0f0f5", outline: "none", marginBottom: 20, boxSizing: "border-box" }}
          />

          <label style={{ fontSize: 13, color: "#a0a4b8", display: "block", marginBottom: 6 }}>
            Fotos
          </label>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setArquivos(e.target.files)}
            style={{ display: "none" }}
          />
          <button type="button" className="up-file" onClick={() => inputRef.current?.click()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2.5" />
              <circle cx="8.5" cy="10" r="1.7" />
              <path d="M4 17l4.5-4.5 3.5 3 3-2.5L20 16.5" />
            </svg>
            Escolher fotos
          </button>
          <p className={"up-file-status" + (arquivos && arquivos.length > 0 ? " tem" : "")}>
            {arquivos && arquivos.length > 0
              ? `${arquivos.length} foto${arquivos.length === 1 ? "" : "s"} selecionada${arquivos.length === 1 ? "" : "s"}`
              : "Nenhuma foto selecionada"}
          </p>

          <button className="up-enviar" onClick={enviarFotos} disabled={enviando}>
            {enviando ? (
              "Enviando..."
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 15V5" />
                  <path d="M8 9l4-4 4 4" />
                  <path d="M5 19h14" />
                </svg>
                {nomeTravado ? "Enviar fotos" : "Criar nova galeria"}
              </>
            )}
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