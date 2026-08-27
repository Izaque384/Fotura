"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase-client";

type Selecao = {
  fotos: string[];
  finalizada: boolean;
  comentarios: Record<string, string>;
  atualizadoEm?: string;
};

type FotoAssinada = { nome: string; url: string };

type Props = {
  uid: string;
  galeriaId: string;
  titulo: string;
  selecao?: Selecao;
  onFechar: () => void;
};

export default function ModalSelecao({ uid, galeriaId, titulo, selecao, onFechar }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [fotos, setFotos] = useState<FotoAssinada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [baixando, setBaixando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const comentadas = Object.entries(selecao?.comentarios ?? {})
        .filter(([, texto]) => texto?.trim())
        .map(([nome]) => nome);
      const nomes = Array.from(new Set([...(selecao?.fotos ?? []), ...comentadas]));
      if (!nomes.length) {
        if (ativo) setCarregando(false);
        return;
      }
      const caminhos = nomes.map((nome) => `${uid}/${galeriaId}/${nome}`);
      const { data } = await supabase.storage.from("fotos").createSignedUrls(caminhos, 3600);
      if (!ativo) return;
      const porPath = new Map((data ?? []).filter((x) => x.path && x.signedUrl).map((x) => [x.path as string, x.signedUrl as string]));
      setFotos(nomes.map((nome) => ({ nome, url: porPath.get(`${uid}/${galeriaId}/${nome}`) ?? "" })).filter((f) => f.url));
      setCarregando(false);
    }
    carregar();
    return () => { ativo = false; };
  }, [galeriaId, selecao, supabase, uid]);

  useEffect(() => {
    function esc(e: KeyboardEvent) { if (e.key === "Escape") onFechar(); }
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  async function baixarUma(url: string, nome: string) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("download");
    const blob = await resp.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
  }

  async function baixarTodas() {
    const escolhidas = fotos.filter((f) => selecao?.fotos.includes(f.nome));
    if (!escolhidas.length || baixando) return;
    setBaixando(true);
    setProgresso(0);
    for (let i = 0; i < escolhidas.length; i++) {
      try { await baixarUma(escolhidas[i].url, escolhidas[i].nome); } catch { /* segue */ }
      setProgresso(i + 1);
      await new Promise((r) => setTimeout(r, 350));
    }
    setBaixando(false);
  }

  const escolhidas = selecao?.fotos ?? [];
  const comentarios = Object.entries(selecao?.comentarios ?? {}).filter(([, texto]) => texto?.trim());

  return (
    <div className="ms-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <style>{`
        .ms-backdrop { position:fixed; inset:0; z-index:120; background:rgba(3,3,12,.78); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; padding:24px; }
        .ms-panel { width:min(920px,100%); max-height:min(86vh,860px); overflow:auto; background:linear-gradient(180deg,#14142b,#101023); border:1px solid #2a2d40; border-radius:18px; box-shadow:0 30px 90px rgba(0,0,0,.55); }
        .ms-head { position:sticky; top:0; z-index:2; display:flex; align-items:flex-start; justify-content:space-between; gap:16px; padding:22px 24px; background:rgba(20,20,43,.96); border-bottom:1px solid #23233c; }
        .ms-eyebrow { font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:#6f76a0; font-weight:700; }
        .ms-title { margin:5px 0 0; color:#f0f0f5; font-size:20px; }
        .ms-sub { margin-top:6px; color:#7a7f9a; font-size:12px; }
        .ms-close { width:38px; height:38px; border-radius:10px; border:1px solid #2a2d40; background:#111126; color:#cdd2e4; font-size:20px; cursor:pointer; }
        .ms-body { padding:22px 24px 26px; }
        .ms-actions { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:20px; }
        .ms-btn { border:none; border-radius:10px; padding:10px 14px; color:white; font:600 13px inherit; cursor:pointer; background:linear-gradient(90deg,#1196fc,#5d0dfa); }
        .ms-btn:disabled { opacity:.55; cursor:default; }
        .ms-progress { color:#8a90a8; font-size:12px; }
        .ms-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
        .ms-photo { aspect-ratio:1; overflow:hidden; border-radius:11px; border:1px solid #252842; background:#0d0d1c; }
        .ms-photo img { width:100%; height:100%; object-fit:cover; display:block; }
        .ms-section { margin-top:24px; }
        .ms-section h3 { margin:0 0 12px; color:#eef1f6; font-size:14px; }
        .ms-comment { padding:12px 14px; border:1px solid #24263d; border-radius:11px; background:rgba(255,255,255,.018); margin-bottom:8px; }
        .ms-file { color:#9fb0ff; font-size:11px; margin-bottom:5px; word-break:break-all; }
        .ms-text { color:#cfd2df; font-size:13px; line-height:1.5; }
        .ms-empty { padding:28px 0; text-align:center; color:#7a7f9a; font-size:13px; }
        @media(max-width:700px){ .ms-backdrop{padding:10px}.ms-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ms-head,.ms-body{padding-left:16px;padding-right:16px} }
      `}</style>
      <section className="ms-panel" role="dialog" aria-modal="true" aria-label={`Seleção da galeria ${titulo}`}>
        <div className="ms-head">
          <div><div className="ms-eyebrow">Seleção do cliente</div><h2 className="ms-title">{titulo}</h2><div className="ms-sub">{escolhidas.length} foto{escolhidas.length === 1 ? "" : "s"} escolhida{escolhidas.length === 1 ? "" : "s"} · {comentarios.length} comentário{comentarios.length === 1 ? "" : "s"}</div></div>
          <button className="ms-close" onClick={onFechar} aria-label="Fechar seleção">×</button>
        </div>
        <div className="ms-body">
          <div className="ms-actions">
            <span className="ms-progress">{selecao?.finalizada ? "Seleção finalizada" : "Seleção em andamento"}</span>
            <button className="ms-btn" onClick={baixarTodas} disabled={!escolhidas.length || baixando}>{baixando ? `Baixando ${progresso}/${escolhidas.length}` : "Baixar selecionadas"}</button>
          </div>
          {carregando ? <div className="ms-empty">Preparando fotos da seleção…</div> : escolhidas.length ? <div className="ms-grid">{escolhidas.map((nome) => { const foto = fotos.find((f) => f.nome === nome); return <div className="ms-photo" key={nome}>{foto?.url ? <img src={foto.url} alt={nome}/> : null}</div>; })}</div> : <div className="ms-empty">O cliente ainda não escolheu fotos.</div>}
          {comentarios.length > 0 && <div className="ms-section"><h3>Comentários</h3>{comentarios.map(([nome,texto]) => <div className="ms-comment" key={nome}><div className="ms-file">{nome}</div><div className="ms-text">{texto}</div></div>)}</div>}
        </div>
      </section>
    </div>
  );
}
