"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../lib/supabase-client";

function tituloDeSlug(slug: string) {
  const t = decodeURIComponent(slug).replace(/-/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Texto claro ou escuro conforme a cor de fundo, pra sempre ficar legível
function corContraste(hex: string) {
  const c = (hex || "").replace("#", "");
  if (c.length !== 6) return "#ffffff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#111218" : "#ffffff";
}

export default function GaleriaClientePage() {
  const params = useParams();
  const slug = params.slug as string;
  const supabase = createClient();
  const [carregando, setCarregando] = useState(true);
  const [fotos, setFotos] = useState<{ url: string; nome: string }[]>([]);
  const [estudio, setEstudio] = useState<{ nome: string | null; logo: string | null; cor: string | null }>({ nome: null, logo: null, cor: null });
  const [mensagem, setMensagem] = useState("");
  const [aberta, setAberta] = useState<number | null>(null);
  const toqueX = useRef<number | null>(null);
  const [baixandoTudo, setBaixandoTudo] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [finalizada, setFinalizada] = useState(false);
  const [comentarios, setComentarios] = useState<Record<string, string>>({});
  const [rascunho, setRascunho] = useState("");
  const [prova, setProva] = useState(false);
  const [limite, setLimite] = useState(0);
  const [prazoTexto, setPrazoTexto] = useState<string | null>(null);
  const [encerrada, setEncerrada] = useState(false);
  const [limiteMsg, setLimiteMsg] = useState("");
  const [temSenha, setTemSenha] = useState(false);
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [senhaInput, setSenhaInput] = useState("");
  const [senhaErro, setSenhaErro] = useState(false);

  useEffect(() => {
    async function carregar() {
      const { data: perfil } = await supabase
        .from("perfis")
        .select("nome_estudio, logo_url, cor_hero")
        .limit(1)
        .maybeSingle();
      if (perfil) setEstudio({ nome: perfil.nome_estudio ?? null, logo: perfil.logo_url ?? null, cor: perfil.cor_hero ?? null });

      const { data: cfgRow } = await supabase
        .from("perfis")
        .select("configs")
        .limit(1)
        .maybeSingle();
      const cfg = ((cfgRow?.configs as Record<string, { prova?: boolean; limite?: number; prazo?: string | null; temSenha?: boolean }> | null) ?? {});
      const c = cfg[slug] ?? {};
      setProva(Boolean(c.prova));
      setLimite(c.limite ?? 0);
      const prz = c.prazo ?? null;
      setPrazoTexto(prz);
      setEncerrada(prz ? Date.now() > new Date(prz + "T23:59:59").getTime() : false);
      const tem = Boolean(c.temSenha);
      setTemSenha(tem);
      if (tem) {
        try { if (sessionStorage.getItem(`fotura_ok_${slug}`) === "1") setDesbloqueado(true); } catch {}
      }

      const { data, error } = await supabase.storage.from("fotos").list(slug, {
        limit: 500,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) {
        setMensagem("Não foi possível carregar a galeria.");
        setCarregando(false);
        return;
      }
      const lista = (data ?? [])
        .filter((item) => item.id !== null)
        .map((item) => {
          const { data: urlData } = supabase.storage
            .from("fotos")
            .getPublicUrl(`${slug}/${item.name}`);
          return { url: urlData.publicUrl, nome: item.name };
        });
      setFotos(lista);

      const { data: sel } = await supabase
        .from("selecoes")
        .select("fotos, finalizada, comentarios")
        .eq("galeria", slug)
        .maybeSingle();
      if (sel) {
        setSelecionadas((sel.fotos as string[]) ?? []);
        setFinalizada(Boolean(sel.finalizada));
        setComentarios((sel.comentarios as Record<string, string>) ?? {});
      }

      setCarregando(false);
    }
    carregar();
  }, [slug, supabase]);

  useEffect(() => {
    if (aberta === null) return;
    function aoTeclar(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === "TEXTAREA" || alvo.tagName === "INPUT")) return;
      if (e.key === "Escape") setAberta(null);
      else if (e.key === "ArrowRight") setAberta((v) => (v === null ? null : (v + 1) % fotos.length));
      else if (e.key === "ArrowLeft") setAberta((v) => (v === null ? null : (v - 1 + fotos.length) % fotos.length));
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberta, fotos.length]);

  async function baixar(url: string, nome: string) {
    const resp = await fetch(url);
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
    if (baixandoTudo || fotos.length === 0) return;
    setBaixandoTudo(true);
    setProgresso(0);
    for (let i = 0; i < fotos.length; i++) {
      try {
        await baixar(fotos[i].url, fotos[i].nome);
      } catch {
        // se uma foto falhar, segue para a próxima
      }
      setProgresso(i + 1);
      await new Promise((r) => setTimeout(r, 400));
    }
    setBaixandoTudo(false);
  }

  function fecharLb() {
    setAberta(null);
  }
  useEffect(() => {
    if (aberta === null) return;
    const f = fotos[aberta];
    setRascunho(f ? (comentarios[f.nome] ?? "") : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta]);

  function proxima() {
    setAberta((v) => (v === null ? null : (v + 1) % fotos.length));
  }
  function anterior() {
    setAberta((v) => (v === null ? null : (v - 1 + fotos.length) % fotos.length));
  }

  async function salvarTudo(nomes: string[], fin: boolean, coments: Record<string, string>) {
    await supabase.from("selecoes").upsert({
      galeria: slug,
      fotos: nomes,
      finalizada: fin,
      comentarios: coments,
      atualizado_em: new Date().toISOString(),
    });
  }

  function alternarSelecao(nome: string) {
    if (finalizada || encerrada) return;
    const jaTem = selecionadas.includes(nome);
    if (!jaTem && limite > 0 && selecionadas.length >= limite) {
      setLimiteMsg(`Você já escolheu o máximo de ${limite} foto${limite === 1 ? "" : "s"}.`);
      window.setTimeout(() => setLimiteMsg(""), 2600);
      return;
    }
    const nomes = jaTem
      ? selecionadas.filter((n) => n !== nome)
      : [...selecionadas, nome];
    setSelecionadas(nomes);
    salvarTudo(nomes, false, comentarios);
  }

  async function finalizarSelecao() {
    if (selecionadas.length === 0 || finalizada || encerrada) return;
    const ok = window.confirm(
      `Finalizar sua seleção de ${selecionadas.length} foto${selecionadas.length === 1 ? "" : "s"}? Depois não será possível alterar.`
    );
    if (!ok) return;
    setFinalizada(true);
    await salvarTudo(selecionadas, true, comentarios);
  }

  function enviarComentario() {
    if (aberta === null) return;
    const nome = fotos[aberta].nome;
    const novo = { ...comentarios, [nome]: rascunho.trim() };
    setComentarios(novo);
    salvarTudo(selecionadas, finalizada, novo);
    setAberta(null);
  }

  function fmtData(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
  }

  function marcaMark() {
    if (estudio.logo) {
      return { backgroundImage: `url("${estudio.logo}")`, backgroundRepeat: "repeat", backgroundSize: "116px", backgroundPosition: "center", opacity: 0.3 };
    }
    if (estudio.nome) {
      const esc = estudio.nome.toUpperCase().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='180'><text x='16' y='104' fill='rgba(255,255,255,0.42)' font-size='22' font-weight='700' font-family='Arial, Helvetica, sans-serif' transform='rotate(-28 130 92)'>${esc}</text></svg>`;
      return { backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, backgroundRepeat: "repeat" };
    }
    return null;
  }

  async function verificarSenha() {
    const { data, error } = await supabase.rpc("checar_senha", { p_slug: slug, p_senha: senhaInput });
    if (!error && data === true) {
      setDesbloqueado(true);
      try { sessionStorage.setItem(`fotura_ok_${slug}`, "1"); } catch {}
    } else {
      setSenhaErro(true);
    }
  }

  if (carregando) {
    return <div className="gc-center">Carregando galeria…</div>;
  }

  if (temSenha && !desbloqueado) {
    return (
      <div className="gc-gate">
        <style>{`
          .gc-gate { min-height:100vh; background:#0b0b1a; display:flex; align-items:center; justify-content:center; padding:24px; }
          .gc-gate-card { width:100%; max-width:380px; background:linear-gradient(180deg,#14142b,#101023); border:1px solid #23233c; border-radius:18px; padding:36px 28px; text-align:center; }
          .gc-gate-ic { width:56px; height:56px; margin:0 auto 18px; border-radius:14px; display:flex; align-items:center; justify-content:center; background:rgba(74,108,247,0.12); color:#7ea2ff; }
          .gc-gate-ic svg { width:26px; height:26px; }
          .gc-gate-t { font-size:20px; font-weight:700; color:#f5f6fb; margin:0 0 6px; }
          .gc-gate-d { font-size:14px; color:#8a90a8; margin:0 0 22px; }
          .gc-gate-input { width:100%; padding:13px 14px; font-size:15px; border:1.5px solid #2a2d40; border-radius:11px; background:#0f0f1a; color:#f0f0f5; outline:none; box-sizing:border-box; text-align:center; }
          .gc-gate-input:focus { border-color:#4a6cf7; }
          .gc-gate-erro { font-size:13px; color:#ff9d9d; margin:12px 0 0; }
          .gc-gate-btn { width:100%; margin-top:16px; padding:13px; font-size:15px; font-weight:700; color:#fff; border:none; border-radius:11px; cursor:pointer; font-family:inherit; background:linear-gradient(90deg,#1196fc,#5d0dfa); }
          .gc-gate-btn:hover { filter:brightness(1.08); }
          .gc-gate-foot { margin-top:22px; font-size:12px; color:#5a5f78; }
        `}</style>
        <div className="gc-gate-card">
          <div className="gc-gate-ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          </div>
          <h1 className="gc-gate-t">Galeria protegida</h1>
          <p className="gc-gate-d">Digite a senha para ver as fotos.</p>
          <input
            className="gc-gate-input"
            type="password"
            value={senhaInput}
            onChange={(e) => { setSenhaInput(e.target.value); setSenhaErro(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") verificarSenha(); }}
            placeholder="Senha"
            autoFocus
          />
          {senhaErro && <p className="gc-gate-erro">Senha incorreta. Tente novamente.</p>}
          <button className="gc-gate-btn" onClick={verificarSenha}>Entrar</button>
          <div className="gc-gate-foot">Feito com <b>Fotura</b></div>
        </div>
      </div>
    );
  }

  const titulo = tituloDeSlug(slug);
  const nomeMarca = estudio.nome || "Fotura";
  const cor = estudio.cor || "#0b0b1a";
  const txt = corContraste(cor);
  const wmMark = prova ? marcaMark() : null;
  const bloqueado = finalizada || encerrada;

  return (
    <div className="gc-page">
      <style>{`
        .gc-page { min-height:100vh; background:#0b0b1a; }
        .gc-center { min-height:100vh; display:flex; align-items:center; justify-content:center; background:#0b0b1a; color:#7a7f9a; }

        /* HERO dividido: logo nítido à esquerda | info à direita */
        .gc-hero { position:relative; overflow:hidden; }
        .gc-hero::after { content:''; position:absolute; inset:0; background:linear-gradient(115deg, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.20) 100%); pointer-events:none; }
        .gc-hero-wrap { position:relative; z-index:2; max-width:1120px; margin:0 auto; width:100%; min-height:42vh; display:flex; align-items:center; gap:52px; padding:64px 32px; box-sizing:border-box; }
        .gc-hero-logo { flex-shrink:0; display:flex; align-items:center; justify-content:center; min-width:0; }
        .gc-hero-logo img { max-height:150px; max-width:260px; object-fit:contain; display:block; }
        .gc-hero-logo .txtmark { font-size:clamp(30px, 4.4vw, 52px); font-weight:800; letter-spacing:-1px; line-height:1; }
        .gc-hero-div { width:1px; align-self:stretch; min-height:96px; margin:12px 0; }
        .gc-hero-info { flex:1; min-width:0; }
        .gc-eyebrow { font-size:12px; letter-spacing:3px; text-transform:uppercase; font-weight:600; margin:0 0 14px; }
        .gc-title { font-size:clamp(30px, 5vw, 58px); font-weight:700; margin:0; letter-spacing:-1px; line-height:1.06; }
        .gc-count { font-size:14px; margin:18px 0 0; letter-spacing:0.5px; }

        /* Cabeçalho da grade */
        .gc-body { max-width:1120px; margin:0 auto; padding:44px 32px 120px; }
        .gc-bodyhead { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; padding-bottom:16px; margin-bottom:24px; border-bottom:1px solid #1c1e33; }
        .gc-bodyhead h2 { font-size:14px; font-weight:600; color:#cdd2e4; margin:0; letter-spacing:2px; text-transform:uppercase; }
        .gc-bodyhead span { font-size:13px; color:#6b7191; }
        .gc-head-right { display:flex; align-items:center; gap:16px; }
        .gc-baixar-todas { display:inline-flex; align-items:center; gap:8px; padding:9px 16px; font-size:13px; font-weight:600; font-family:inherit; color:#eaf0ff; cursor:pointer; background:rgba(74,108,247,0.14); border:1px solid rgba(74,108,247,0.5); border-radius:10px; transition:background .18s ease, border-color .18s ease, transform .18s ease; }
        .gc-baixar-todas:hover { background:#4a6cf7; border-color:#4a6cf7; color:#fff; transform:translateY(-1px); }
        .gc-baixar-todas:disabled { cursor:default; opacity:0.85; transform:none; background:rgba(74,108,247,0.14); border-color:rgba(74,108,247,0.35); }
        .gc-baixar-todas svg { width:16px; height:16px; }

        /* Grade premium */
        .gc-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:16px; }
        .gc-card { position:relative; aspect-ratio:1/1; border-radius:16px; overflow:hidden; background:#12131f; border:1px solid #1e2036; transition:border-color .25s ease, transform .25s ease; }
        .gc-card:hover { border-color:#33375a; transform:translateY(-3px); }
        .gc-card img { width:100%; height:100%; object-fit:cover; display:block; cursor:zoom-in; transition:transform .6s ease; }
        .gc-card:hover img { transform:scale(1.08); }
        .gc-card::before { content:''; position:absolute; inset:0; background:linear-gradient(to top, rgba(6,6,14,0.6) 0%, rgba(6,6,14,0) 42%); opacity:0; transition:opacity .28s ease; z-index:1; pointer-events:none; }
        .gc-card:hover::before { opacity:1; }
        .gc-dl { position:absolute; z-index:2; bottom:12px; right:12px; width:42px; height:42px; display:flex; align-items:center; justify-content:center; background:rgba(11,11,26,0.55); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.18); border-radius:11px; cursor:pointer; opacity:0.85; transition:opacity .2s ease, background .2s ease; }
        .gc-dl:hover { opacity:1; background:#4a6cf7; border-color:#4a6cf7; }
        .gc-dl svg { width:19px; height:19px; }

        .gc-sel { position:absolute; z-index:2; top:12px; left:12px; width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:50%; cursor:pointer; padding:0; background:rgba(11,11,26,0.5); backdrop-filter:blur(8px); border:1.5px solid rgba(255,255,255,0.55); opacity:0.92; transition:background .18s ease, border-color .18s ease, transform .18s ease; }
        .gc-sel:hover { transform:scale(1.08); }
        .gc-sel svg { width:18px; height:18px; }
        .gc-sel.on { background:#4a6cf7; border-color:#4a6cf7; opacity:1; }
        .gc-sel:disabled { cursor:default; }
        .gc-card.sel { border-color:#4a6cf7; box-shadow:inset 0 0 0 2px #4a6cf7; }

        /* Lightbox */
        .gc-lb { position:fixed; inset:0; background:rgba(4,4,10,0.95); display:flex; align-items:center; justify-content:center; padding:32px; z-index:50; cursor:zoom-out; }
        .gc-lb-imgwrap { position:relative; display:inline-block; line-height:0; max-width:90vw; max-height:88vh; }
        .gc-lb-imgwrap img { display:block; max-width:90vw; max-height:88vh; width:auto; height:auto; border-radius:12px; box-shadow:0 24px 70px rgba(0,0,0,0.7); cursor:default; user-select:none; -webkit-user-select:none; }
        .gc-wm { position:absolute; inset:0; pointer-events:none; border-radius:12px; overflow:hidden; background-image: repeating-linear-gradient(30deg, rgba(255,255,255,0.18) 0 1px, transparent 1px 24px), repeating-linear-gradient(-30deg, rgba(255,255,255,0.18) 0 1px, transparent 1px 24px), repeating-linear-gradient(90deg, rgba(255,255,255,0.1) 0 1px, transparent 1px 40px); }
        .gc-wm-mark { position:absolute; inset:0; }
        .gc-lb-nav, .gc-lb-close { position:absolute; display:flex; align-items:center; justify-content:center; color:#fff; cursor:pointer; background:rgba(20,20,36,0.55); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.18); transition:background .18s ease, border-color .18s ease; }
        .gc-lb-nav:hover, .gc-lb-close:hover { background:#4a6cf7; border-color:#4a6cf7; }
        .gc-lb-nav { top:50%; transform:translateY(-50%); width:52px; height:52px; border-radius:50%; }
        .gc-lb-nav svg { width:24px; height:24px; }
        .gc-lb-prev { left:20px; }
        .gc-lb-next { right:20px; }
        .gc-lb-close { top:20px; right:20px; width:44px; height:44px; border-radius:12px; }
        .gc-lb-close svg { width:20px; height:20px; }
        .gc-lb-count { position:absolute; top:20px; left:50%; transform:translateX(-50%); font-size:13px; color:#dfe3f2; background:rgba(20,20,36,0.6); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.14); padding:6px 14px; border-radius:999px; letter-spacing:0.5px; cursor:default; }
        .gc-lb-coment { position:absolute; bottom:20px; left:50%; transform:translateX(-50%); width:min(600px,92%); display:flex; align-items:center; gap:8px; background:rgba(20,20,36,0.72); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.14); border-radius:14px; padding:8px 8px 8px 14px; }
        .gc-lb-input { flex:1; background:transparent; border:none; outline:none; color:#fff; font-family:inherit; font-size:14px; resize:none; line-height:1.45; max-height:90px; }
        .gc-lb-input::placeholder { color:#9aa0c0; }
        .gc-lb-salvo { flex-shrink:0; font-size:12px; font-weight:600; color:#8fe3b0; white-space:nowrap; }
        .gc-lb-send { flex-shrink:0; width:38px; height:38px; display:flex; align-items:center; justify-content:center; border:none; border-radius:10px; cursor:pointer; background:linear-gradient(90deg,#1196fc,#5d0dfa); transition:filter .15s ease; }
        .gc-lb-send:hover { filter:brightness(1.1); }
        .gc-lb-send svg { width:18px; height:18px; }
        .gc-lb-comtxt { margin:0; color:#eaf0ff; font-size:14px; line-height:1.45; }
        .gc-lb-comtxt.vazio { color:#8a90a8; font-style:italic; }
        .gc-hascom { position:absolute; z-index:2; bottom:12px; left:12px; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:50%; background:rgba(74,108,247,0.9); border:1px solid rgba(255,255,255,0.25); }
        .gc-hascom svg { width:15px; height:15px; }

        .gc-selhint { font-size:13px; color:#9aa0c0; margin:0 0 18px; padding:12px 16px; background:rgba(74,108,247,0.07); border:1px solid rgba(74,108,247,0.22); border-radius:12px; line-height:1.5; }
        .gc-prazo { font-size:13px; color:#cdd2e4; margin:0 0 14px; padding:12px 16px; background:rgba(74,108,247,0.07); border:1px solid rgba(74,108,247,0.22); border-radius:12px; }
        .gc-prazo.encerrada { color:#ffc2c2; background:rgba(239,68,68,0.09); border-color:rgba(239,68,68,0.3); }
        .gc-toast { position:fixed; z-index:46; bottom:88px; left:50%; transform:translateX(-50%); background:rgba(239,68,68,0.94); color:#fff; padding:10px 18px; border-radius:999px; font-size:13px; font-weight:600; box-shadow:0 10px 30px rgba(0,0,0,0.45); max-width:92vw; text-align:center; }
        .gc-selhint b { color:#cdd2e4; font-weight:600; }
        .gc-selbar { position:fixed; z-index:45; left:50%; bottom:22px; transform:translateX(-50%); max-width:92vw; display:flex; align-items:center; gap:14px; padding:10px 12px 10px 22px; background:rgba(16,16,34,0.92); backdrop-filter:blur(12px); border:1px solid #2a2d4a; border-radius:999px; box-shadow:0 16px 44px rgba(0,0,0,0.55); }
        .gc-selbar-n { font-size:14px; font-weight:600; color:#f0f0f5; white-space:nowrap; }
        .gc-selbar-btn { padding:10px 20px; font-size:14px; font-weight:700; color:#fff; border:none; border-radius:999px; cursor:pointer; font-family:inherit; background:linear-gradient(90deg,#1196fc,#5d0dfa); box-shadow:0 8px 22px rgba(74,108,247,0.4); transition:filter .15s ease; }
        .gc-selbar-btn:hover { filter:brightness(1.08); }
        .gc-selbar-done { padding:12px 22px; color:#8fe3b0; }
        .gc-selbar-done svg { width:18px; height:18px; }
        .gc-selbar-done span { font-size:14px; font-weight:600; color:#8fe3b0; white-space:nowrap; }

        .gc-empty { color:#7a7f9a; text-align:center; padding:70px 24px; }
        .gc-foot { text-align:center; color:#40455f; font-size:12px; padding:8px 24px 34px; letter-spacing:0.5px; }
        .gc-foot b { color:#636a8c; font-weight:600; }

        @media (max-width:760px){
          .gc-hero-wrap { flex-direction:column; text-align:center; gap:26px; min-height:auto; padding:48px 24px; }
          .gc-hero-div { display:none; }
          .gc-hero-logo img { max-height:104px; }
          .gc-hero-info { display:flex; flex-direction:column; align-items:center; }
          .gc-lb-nav { width:44px; height:44px; }
          .gc-lb-nav svg { width:20px; height:20px; }
          .gc-lb-prev { left:8px; }
          .gc-lb-next { right:8px; }
          .gc-lb-imgwrap img { max-width:94vw; }
        }
      `}</style>

      {/* HERO com a marca (cor editável) */}
      <header className="gc-hero" style={{ backgroundColor: cor }}>
        <div className="gc-hero-wrap">
          <div className="gc-hero-logo">
            {estudio.logo ? (
              <img src={estudio.logo} alt={nomeMarca} />
            ) : (
              <span className="txtmark" style={{ color: txt }}>{nomeMarca}</span>
            )}
          </div>

          <div className="gc-hero-div" style={{ background: txt, opacity: 0.18 }} />

          <div className="gc-hero-info">
            {estudio.nome && (
              <p className="gc-eyebrow" style={{ color: txt, opacity: 0.72 }}>{estudio.nome}</p>
            )}
            <h1 className="gc-title" style={{ color: txt }}>{titulo}</h1>
            <p className="gc-count" style={{ color: txt, opacity: 0.66 }}>
              {fotos.length} foto{fotos.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </header>

      {mensagem ? (
        <div className="gc-empty">{mensagem}</div>
      ) : fotos.length === 0 ? (
        <div className="gc-empty">Esta galeria ainda não tem fotos.</div>
      ) : (
        <div className="gc-body">
          <div className="gc-bodyhead">
            <h2>Todas as fotos</h2>
            <div className="gc-head-right">
              <span>{fotos.length} foto{fotos.length === 1 ? "" : "s"}</span>
              {!prova && (
                <button className="gc-baixar-todas" onClick={baixarTodas} disabled={baixandoTudo}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {baixandoTudo ? `Baixando ${progresso}/${fotos.length}` : "Baixar todas"}
                </button>
              )}
            </div>
          </div>

          {encerrada ? (
            <p className="gc-prazo encerrada">
              A seleção desta galeria foi encerrada{prazoTexto ? ` (prazo: ${fmtData(prazoTexto)})` : ""}.
            </p>
          ) : prazoTexto ? (
            <p className="gc-prazo">Seleção aberta até <b>{fmtData(prazoTexto)}</b>.</p>
          ) : null}

          {!bloqueado && (
            <p className="gc-selhint">
              Toque no <b>círculo</b> das fotos que você quer{limite > 0 ? <> (até <b>{limite}</b>)</> : null} e clique em <b>Finalizar seleção</b> quando terminar.
            </p>
          )}

          <div className="gc-grid">
            {fotos.map((foto, i) => {
              const sel = selecionadas.includes(foto.nome);
              return (
                <div key={foto.url} className={"gc-card" + (sel ? " sel" : "")}>
                  <img src={foto.url} alt="Foto" onClick={() => setAberta(i)} />
                  {prova && <div className="gc-wm">{wmMark && <div className="gc-wm-mark" style={wmMark} />}</div>}
                  <button
                    className={"gc-sel" + (sel ? " on" : "")}
                    onClick={() => alternarSelecao(foto.nome)}
                    disabled={bloqueado}
                    aria-label={sel ? "Remover da seleção" : "Selecionar"}
                    title={sel ? "Selecionada" : "Selecionar"}
                  >
                    {sel && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="5 12 10 17 19 7" />
                      </svg>
                    )}
                  </button>
                  {!prova && (
                    <button className="gc-dl" onClick={() => baixar(foto.url, foto.nome)} aria-label="Baixar foto" title="Baixar">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </button>
                  )}
                  {(comentarios[foto.nome] ?? "").trim() !== "" && (
                    <span className="gc-hascom" title="Você comentou nesta foto">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 20l1.4-4.2A8.5 8.5 0 1 1 21 11.5z" />
                      </svg>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {fotos.length > 0 && !bloqueado && selecionadas.length > 0 && (
        <div className="gc-selbar">
          <span className="gc-selbar-n">{selecionadas.length}{limite > 0 ? ` / ${limite}` : ""} selecionada{selecionadas.length === 1 ? "" : "s"}</span>
          <button className="gc-selbar-btn" onClick={finalizarSelecao}>Finalizar seleção</button>
        </div>
      )}
      {limiteMsg && <div className="gc-toast">{limiteMsg}</div>}
      {fotos.length > 0 && finalizada && (
        <div className="gc-selbar gc-selbar-done">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 12 10 17 19 7" /></svg>
          <span>Seleção enviada — {selecionadas.length} foto{selecionadas.length === 1 ? "" : "s"} escolhida{selecionadas.length === 1 ? "" : "s"}</span>
        </div>
      )}

      <footer className="gc-foot">Feito com <b>Fotura</b></footer>

      {aberta !== null && fotos[aberta] && (
        <div className="gc-lb" onClick={fecharLb}>
          <button className="gc-lb-close" onClick={(e) => { e.stopPropagation(); fecharLb(); }} aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
          </button>

          {fotos.length > 1 && (
            <button className="gc-lb-nav gc-lb-prev" onClick={(e) => { e.stopPropagation(); anterior(); }} aria-label="Anterior">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
          )}

          <div className="gc-lb-imgwrap" onClick={(e) => e.stopPropagation()}>
            <img
              src={fotos[aberta].url}
              alt="Foto ampliada"
              onTouchStart={(e) => { toqueX.current = e.changedTouches[0].clientX; }}
              onTouchEnd={(e) => {
                if (toqueX.current === null) return;
                const dx = e.changedTouches[0].clientX - toqueX.current;
                toqueX.current = null;
                if (Math.abs(dx) > 50) { if (dx < 0) proxima(); else anterior(); }
              }}
            />
            {prova && <div className="gc-wm">{wmMark && <div className="gc-wm-mark" style={wmMark} />}</div>}
          </div>

          {fotos.length > 1 && (
            <button className="gc-lb-nav gc-lb-next" onClick={(e) => { e.stopPropagation(); proxima(); }} aria-label="Próxima">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          )}

          {fotos.length > 1 && (
            <div className="gc-lb-count" onClick={(e) => e.stopPropagation()}>{aberta + 1} / {fotos.length}</div>
          )}

          <div className="gc-lb-coment" onClick={(e) => e.stopPropagation()}>
            {bloqueado ? (
              (comentarios[fotos[aberta].nome] ?? "").trim() !== "" ? (
                <p className="gc-lb-comtxt">{comentarios[fotos[aberta].nome]}</p>
              ) : (
                <p className="gc-lb-comtxt vazio">Sem comentário nesta foto.</p>
              )
            ) : (
              <>
                <textarea
                  className="gc-lb-input"
                  rows={1}
                  placeholder="Comente nesta foto… (Enter envia, Shift+Enter quebra linha)"
                  value={rascunho}
                  onChange={(e) => setRascunho(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviarComentario();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <button className="gc-lb-send" onClick={enviarComentario} aria-label="Enviar comentário" title="Enviar comentário">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}