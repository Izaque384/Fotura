"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../lib/supabase-client";

type Selecao = {
  fotos: string[];
  finalizada: boolean;
  comentarios: Record<string, string>;
  atualizadoEm?: string;
};

type FotoAssinada = { nome: string; thumb: string; original: string };

type Props = {
  uid: string;
  galeriaId: string;
  titulo: string;
  selecao: Selecao;
  onFechar: () => void;
};

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ModalSelecao({ uid, galeriaId, titulo, selecao, onFechar }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const painelRef = useRef<HTMLElement>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const anteriorRef = useRef<HTMLElement | null>(null);
  const renovacaoRef = useRef<Promise<FotoAssinada[]> | null>(null);
  const downloadAbort = useRef<AbortController | null>(null);
  const [fotos, setFotos] = useState<FotoAssinada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [baixando, setBaixando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [falhasDownload, setFalhasDownload] = useState(0);
  const [aberta, setAberta] = useState<number | null>(null);

  const escolhidas = selecao.fotos;
  const comentarios = useMemo(
    () => Object.entries(selecao.comentarios ?? {}).filter(([, texto]) => texto?.trim()),
    [selecao.comentarios]
  );
  const nomes = useMemo(
    () => Array.from(new Set([...escolhidas, ...comentarios.map(([nome]) => nome)])),
    [comentarios, escolhidas]
  );

  async function assinar() {
    if (renovacaoRef.current) return renovacaoRef.current;
    const tarefa = (async () => {
      if (!nomes.length) return [];
      const caminhos = nomes.flatMap((nome) => [
        `${uid}/${galeriaId}/thumbs/${nome}`,
        `${uid}/${galeriaId}/${nome}`,
      ]);
      const { data, error } = await supabase.storage.from("fotos").createSignedUrls(caminhos, 3600);
      if (error) throw error;
      const porPath = new Map((data ?? []).filter((x) => x.path && x.signedUrl).map((x) => [x.path as string, x.signedUrl as string]));
      return nomes.map((nome) => ({
        nome,
        thumb: porPath.get(`${uid}/${galeriaId}/thumbs/${nome}`) ?? "",
        original: porPath.get(`${uid}/${galeriaId}/${nome}`) ?? "",
      })).filter((foto) => foto.original);
    })();
    renovacaoRef.current = tarefa;
    try { return await tarefa; }
    finally { renovacaoRef.current = null; }
  }

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro("");
    void assinar().then((lista) => {
      if (!ativo) return;
      setFotos(lista);
      setCarregando(false);
    }).catch(() => {
      if (!ativo) return;
      setErro("Não foi possível preparar as fotos desta seleção.");
      setCarregando(false);
    });
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galeriaId, uid, nomes.join("\u0001")]);

  useEffect(() => {
    anteriorRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflowAnterior;
      requestAnimationFrame(() => anteriorRef.current?.focus());
    };
  }, []);

  useEffect(() => {
    const alvo = aberta !== null ? lightboxRef.current : painelRef.current;
    requestAnimationFrame(() => {
      const primeiro = alvo?.querySelector<HTMLElement>(FOCUSABLE);
      (primeiro ?? alvo)?.focus();
    });

    function teclado(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (aberta !== null) setAberta(null);
        else onFechar();
        return;
      }
      if (aberta !== null && escolhidas.length) {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setAberta((v) => v === null ? null : (v + 1) % escolhidas.length);
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setAberta((v) => v === null ? null : (v - 1 + escolhidas.length) % escolhidas.length);
          return;
        }
      }
      if (e.key !== "Tab") return;
      const container = aberta !== null ? lightboxRef.current : painelRef.current;
      if (!container) return;
      const focaveis = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((elemento) => !elemento.hasAttribute("disabled"));
      if (!focaveis.length) {
        e.preventDefault();
        container.focus();
        return;
      }
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }
    window.addEventListener("keydown", teclado);
    return () => window.removeEventListener("keydown", teclado);
  }, [aberta, escolhidas.length, onFechar]);

  useEffect(() => () => downloadAbort.current?.abort(), []);

  function fotoPorNome(nome: string) {
    return fotos.find((f) => f.nome === nome);
  }

  function abrirNome(nome: string) {
    const i = escolhidas.indexOf(nome);
    if (i >= 0) setAberta(i);
  }

  async function baixarUma(foto: FotoAssinada, signal?: AbortSignal) {
    let atual = foto;
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const resp = await fetch(atual.original, { signal });
      if (resp.ok) {
        const blob = await resp.blob();
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = atual.nome;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 4000);
        return;
      }
      if (tentativa === 0 && (resp.status === 400 || resp.status === 401 || resp.status === 403)) {
        const renovadas = await assinar();
        setFotos(renovadas);
        const nova = renovadas.find((f) => f.nome === foto.nome);
        if (nova) { atual = nova; continue; }
      }
      throw new Error("download");
    }
  }

  async function baixarTodas() {
    if (!escolhidas.length || baixando) return;
    const controller = new AbortController();
    downloadAbort.current = controller;
    setBaixando(true);
    setProgresso(0);
    setFalhasDownload(0);
    let falhas = 0;
    for (let i = 0; i < escolhidas.length; i++) {
      if (controller.signal.aborted) break;
      const foto = fotoPorNome(escolhidas[i]);
      if (!foto) falhas++;
      else {
        try { await baixarUma(foto, controller.signal); }
        catch (e) {
          if (controller.signal.aborted) break;
          falhas++;
        }
      }
      setProgresso(i + 1);
      if (!controller.signal.aborted) await new Promise((r) => setTimeout(r, 300));
    }
    setFalhasDownload(falhas);
    setBaixando(false);
    downloadAbort.current = null;
  }

  function cancelarDownload() {
    downloadAbort.current?.abort();
    setBaixando(false);
  }

  const fotoAberta = aberta !== null ? fotoPorNome(escolhidas[aberta]) : null;

  return (
    <div className="ms-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <style>{`
        .ms-backdrop{position:fixed;inset:0;z-index:120;background:rgba(3,3,12,.78);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px}.ms-panel{width:min(960px,100%);max-height:min(88vh,880px);overflow:auto;background:linear-gradient(180deg,#14142b,#101023);border:1px solid #2a2d40;border-radius:18px;box-shadow:0 30px 90px rgba(0,0,0,.55);outline:none}.ms-head{position:sticky;top:0;z-index:2;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:22px 24px;background:rgba(20,20,43,.97);border-bottom:1px solid #23233c}.ms-eyebrow{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#6f76a0;font-weight:700}.ms-title{margin:5px 0 0;color:#f0f0f5;font-size:20px}.ms-sub{margin-top:6px;color:#7a7f9a;font-size:12px}.ms-close{width:44px;height:44px;border-radius:10px;border:1px solid #2a2d40;background:#111126;color:#cdd2e4;font-size:20px;cursor:pointer}.ms-body{padding:22px 24px 26px}.ms-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:20px}.ms-actions-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ms-btn{min-height:44px;border:none;border-radius:10px;padding:10px 14px;color:white;font:600 13px inherit;cursor:pointer;background:linear-gradient(90deg,#1196fc,#5d0dfa)}.ms-btn.secondary{background:#111126;border:1px solid #30334d;color:#cfd3e3}.ms-btn:disabled{opacity:.55;cursor:default}.ms-progress{color:#8a90a8;font-size:12px}.ms-warning{color:#ffb0b0;font-size:11px}.ms-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.ms-photo{position:relative;aspect-ratio:1;overflow:hidden;border-radius:11px;border:1px solid #252842;background:#0d0d1c;cursor:pointer}.ms-photo img{width:100%;height:100%;object-fit:cover;display:block}.ms-photo:focus-visible{outline:2px solid #4a6cf7;outline-offset:2px}.ms-comment-dot{position:absolute;right:7px;bottom:7px;min-width:22px;height:22px;padding:0 6px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:rgba(11,11,26,.86);border:1px solid #414765;color:#dce0f1;font-size:10px;font-weight:700}.ms-missing{height:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:10px;color:#626985;font-size:11px}.ms-section{margin-top:24px}.ms-section h3{margin:0 0 12px;color:#eef1f6;font-size:14px}.ms-comment{padding:12px 14px;border:1px solid #24263d;border-radius:11px;background:rgba(255,255,255,.018);margin-bottom:8px}.ms-comment.has-photo{cursor:pointer}.ms-file{color:#9fb0ff;font-size:11px;margin-bottom:5px;word-break:break-all}.ms-text{color:#cfd2df;font-size:13px;line-height:1.5;white-space:pre-wrap}.ms-empty{padding:28px 0;text-align:center;color:#7a7f9a;font-size:13px}.ms-error{padding:18px;border:1px solid rgba(255,157,157,.25);border-radius:11px;color:#ff9d9d;background:rgba(255,157,157,.05);font-size:12px}.ms-lightbox{position:fixed;inset:0;z-index:140;background:rgba(2,2,8,.95);display:flex;align-items:center;justify-content:center;padding:28px;outline:none}.ms-lightbox img{max-width:min(92vw,1500px);max-height:88vh;object-fit:contain}.ms-lb-close,.ms-lb-nav{position:absolute;border:1px solid #34384d;background:rgba(15,15,26,.88);color:#fff;cursor:pointer}.ms-lb-close{right:24px;top:20px;width:44px;height:44px;border-radius:12px;font-size:22px}.ms-lb-nav{top:50%;transform:translateY(-50%);width:46px;height:54px;border-radius:12px;font-size:25px}.ms-lb-nav.prev{left:22px}.ms-lb-nav.next{right:22px}.ms-lb-name{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);max-width:80vw;padding:8px 12px;border-radius:9px;background:rgba(15,15,26,.84);color:#aeb3c8;font-size:11px;word-break:break-all}@media(max-width:700px){.ms-backdrop{padding:10px}.ms-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ms-head,.ms-body{padding-left:16px;padding-right:16px}.ms-actions-right{width:100%}.ms-actions-right .ms-btn{flex:1}.ms-lightbox{padding:12px}.ms-lb-nav{width:44px;height:52px}.ms-lb-nav.prev{left:8px}.ms-lb-nav.next{right:8px}.ms-lb-close{right:10px;top:10px}}
      `}</style>
      <section ref={painelRef} tabIndex={-1} className="ms-panel" role="dialog" aria-modal="true" aria-label={`Seleção da galeria ${titulo}`}>
        <div className="ms-head">
          <div>
            <div className="ms-eyebrow">Seleção do cliente</div>
            <h2 className="ms-title">{titulo}</h2>
            <div className="ms-sub">{escolhidas.length} foto{escolhidas.length === 1 ? "" : "s"} escolhida{escolhidas.length === 1 ? "" : "s"} · {comentarios.length} comentário{comentarios.length === 1 ? "" : "s"}</div>
          </div>
          <button type="button" className="ms-close" onClick={onFechar} aria-label="Fechar seleção">×</button>
        </div>
        <div className="ms-body">
          <div className="ms-actions">
            <span className="ms-progress" aria-live="polite">{selecao.finalizada ? "Seleção finalizada" : "Seleção em andamento"}</span>
            <div className="ms-actions-right">
              {baixando && <button type="button" className="ms-btn secondary" onClick={cancelarDownload}>Cancelar</button>}
              <button type="button" className="ms-btn" onClick={() => void baixarTodas()} disabled={!escolhidas.length || baixando} aria-busy={baixando}>{baixando ? `Baixando ${progresso}/${escolhidas.length}` : "Baixar selecionadas"}</button>
            </div>
          </div>
          {falhasDownload > 0 && <div className="ms-warning" role="status" style={{marginBottom:12}}>{falhasDownload} arquivo{falhasDownload === 1 ? " não pôde" : "s não puderam"} ser baixado{falhasDownload === 1 ? "" : "s"}.</div>}
          {carregando ? <div className="ms-empty" role="status">Preparando miniaturas da seleção…</div> : erro ? <div className="ms-error" role="alert">{erro}</div> : escolhidas.length ? <div className="ms-grid">{escolhidas.map((nome, i) => {
            const foto = fotoPorNome(nome);
            const temComentario = Boolean(selecao.comentarios?.[nome]?.trim());
            return <div className="ms-photo" key={nome} role="button" tabIndex={foto ? 0 : -1} aria-label={`Abrir ${nome}`} aria-disabled={!foto || undefined} onClick={()=>foto&&setAberta(i)} onKeyDown={(e)=>{if(foto&&(e.key==="Enter"||e.key===" ")){e.preventDefault();setAberta(i)}}}>{foto ? <img src={foto.thumb || foto.original} alt={nome} loading="lazy" onError={(e)=>{if(e.currentTarget.src!==foto.original)e.currentTarget.src=foto.original}}/> : <div className="ms-missing">Foto indisponível</div>}{temComentario&&<span className="ms-comment-dot" title="Esta foto tem comentário">1</span>}</div>;
          })}</div> : <div className="ms-empty">O cliente ainda não escolheu fotos.</div>}

          {comentarios.length > 0 && <div className="ms-section"><h3>Comentários</h3>{comentarios.map(([nome,texto]) => {
            const foto = fotoPorNome(nome);
            const podeAbrir = Boolean(foto && escolhidas.includes(nome));
            return <div className={"ms-comment"+(podeAbrir?" has-photo":"")} key={nome} role={podeAbrir ? "button" : undefined} tabIndex={podeAbrir ? 0 : undefined} onClick={()=>podeAbrir&&abrirNome(nome)} onKeyDown={(e)=>{if(podeAbrir&&(e.key==="Enter"||e.key===" ")){e.preventDefault();abrirNome(nome)}}}><div className="ms-file">{nome}{podeAbrir ? " · abrir foto" : ""}</div><div className="ms-text">{texto}</div></div>;
          })}</div>}
        </div>
      </section>

      {aberta !== null && fotoAberta && <div ref={lightboxRef} tabIndex={-1} className="ms-lightbox" role="dialog" aria-modal="true" aria-label={`Foto ${fotoAberta.nome}`} onMouseDown={(e)=>{if(e.target===e.currentTarget)setAberta(null)}}>
        <button type="button" className="ms-lb-close" onClick={()=>setAberta(null)} aria-label="Fechar foto">×</button>
        {escolhidas.length > 1 && <button type="button" className="ms-lb-nav prev" onClick={()=>setAberta((aberta-1+escolhidas.length)%escolhidas.length)} aria-label="Foto anterior">‹</button>}
        <img src={fotoAberta.original} alt={fotoAberta.nome}/>
        {escolhidas.length > 1 && <button type="button" className="ms-lb-nav next" onClick={()=>setAberta((aberta+1)%escolhidas.length)} aria-label="Próxima foto">›</button>}
        <div className="ms-lb-name">{fotoAberta.nome}</div>
      </div>}
    </div>
  );
}
