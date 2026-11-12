"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-client";
import MenuFotografo from "../MenuFotografo";
import { heroPresetDataUrl } from "../../lib/gallery-hero";
import "./studio-profile.css";

const TIPOS_LOGO = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_LOGO = 5 * 1024 * 1024;
const HERO_PREVIEW_WIDTH = 1120;
const HERO_PREVIEW_HEIGHT = 492;
type HeroEstilo = "minimal" | "premium" | "tech";
type Billing = { plano?: { nome?: string; recursos?: { heroEstudio?: boolean; heroPremiumTech?: boolean; heroFotoGaleria?: boolean } } };

export default function PerfilPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [nomeEstudio, setNomeEstudio] = useState("");
  const [corHero, setCorHero] = useState("#0b0b1a");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [heroAtivo, setHeroAtivo] = useState(false);
  const [heroEstilo, setHeroEstilo] = useState<HeroEstilo>("minimal");
  const [heroEstiloSalvo, setHeroEstiloSalvo] = useState<HeroEstilo>("minimal");
  const [heroFotoCapaAtivo, setHeroFotoCapaAtivo] = useState(false);
  const [podeHeroEstudio, setPodeHeroEstudio] = useState(false);
  const [podePremiumTech, setPodePremiumTech] = useState(false);
  const [podeFotoHero, setPodeFotoHero] = useState(false);
  const [planoNome, setPlanoNome] = useState("Sem plano");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState(false);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const [previewScale, setPreviewScale] = useState(0.3);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { router.replace("/login"); return; }
      const [{ data }, { data: { session } }] = await Promise.all([
        supabase.from("perfis").select("nome_estudio,logo_url,cor_hero,hero_galeria_ativo,hero_galeria_estilo,hero_foto_capa_ativo").eq("id", userData.user.id).maybeSingle(),
        supabase.auth.getSession(),
      ]);
      let recursos = { heroEstudio: false, heroPremiumTech: false, heroFotoGaleria: false };
      let nomePlano = "Sem plano";
      if (session?.access_token) {
        try {
          const r = await fetch("/api/billing/status", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
          if (r.ok) {
            const b = await r.json() as Billing;
            recursos = {
              heroEstudio: Boolean(b.plano?.recursos?.heroEstudio),
              heroPremiumTech: Boolean(b.plano?.recursos?.heroPremiumTech),
              heroFotoGaleria: Boolean(b.plano?.recursos?.heroFotoGaleria),
            };
            nomePlano = b.plano?.nome || nomePlano;
          }
        } catch {}
      }
      if (!ativo) return;
      const estiloSalvo = ((data?.hero_galeria_estilo as HeroEstilo | null) ?? "minimal");
      const estiloEfetivo = !recursos.heroPremiumTech && (estiloSalvo === "premium" || estiloSalvo === "tech") ? "minimal" : estiloSalvo;
      setNomeEstudio((data?.nome_estudio as string | null) ?? "");
      setLogoUrl((data?.logo_url as string | null) ?? null);
      setCorHero(/^#[0-9a-fA-F]{6}$/.test(String(data?.cor_hero??""))?String(data?.cor_hero):"#0b0b1a");
      setHeroAtivo(Boolean(data?.hero_galeria_ativo) && recursos.heroEstudio);
      setHeroEstilo(estiloEfetivo);
      setHeroEstiloSalvo(estiloSalvo);
      setHeroFotoCapaAtivo(Boolean(data?.hero_foto_capa_ativo));
      setPodeHeroEstudio(recursos.heroEstudio);
      setPodePremiumTech(recursos.heroPremiumTech);
      setPodeFotoHero(recursos.heroFotoGaleria);
      setPlanoNome(nomePlano);
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [router, supabase]);

  useEffect(() => {
    const el = previewViewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const atualizar = () => setPreviewScale(Math.max(0.1, el.clientWidth / HERO_PREVIEW_WIDTH));
    atualizar();
    const observer = new ResizeObserver(atualizar);
    observer.observe(el);
    return () => observer.disconnect();
  }, [carregando]);

  async function enviarLogo(arquivo: File) {
    setErro(false); setMensagem("");
    if (!TIPOS_LOGO.has(arquivo.type)) {
      setErro(true); setMensagem("Use uma imagem PNG, JPG ou WEBP."); return;
    }
    if (arquivo.size <= 0 || arquivo.size > MAX_LOGO) {
      setErro(true); setMensagem("A logo deve ter no máximo 5 MB."); return;
    }
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.access_token) { router.replace("/login"); return; }
    const authHeader = { Authorization: "Bearer " + session.session.access_token };
    setEnviandoLogo(true);
    try {
      const mode = await fetch("/api/marca", { cache: "no-store" });
      if (!mode.ok) throw new Error("Não foi possível verificar o armazenamento.");
      const destination = await mode.json() as { provider?: string };
      let url: string;

      if (destination.provider === "r2") {
        const prepare = await fetch("/api/marca", {
          method: "POST", cache: "no-store",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ acao: "preparar", mime: arquivo.type, bytes: arquivo.size }),
        });
        const reserved = await prepare.json() as {
          path?: string; url?: string; contentType?: string; error?: string
        };
        if (!prepare.ok || !reserved.url || !reserved.path ||
            reserved.contentType !== arquivo.type) {
          throw new Error(reserved.error || "Não foi possível preparar o envio ao R2.");
        }
        const uploaded = await fetch(reserved.url, {
          method: "PUT", headers: { "Content-Type": arquivo.type }, body: arquivo,
        });
        if (!uploaded.ok) throw new Error("O upload do logotipo para o R2 falhou.");
        const commit = await fetch("/api/marca", {
          method: "POST", cache: "no-store",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ acao: "confirmar", path: reserved.path }),
        });
        const verified = await commit.json() as { logoUrl?: string; error?: string };
        if (!commit.ok || !verified.logoUrl) {
          throw new Error(verified.error || "Não foi possível confirmar o logotipo.");
        }
        url = verified.logoUrl;
      } else if (destination.provider === "supabase") {
        // Existing upload flow remains unchanged until final R2 cutover.
        const ext = arquivo.type === "image/png" ? "png" :
          arquivo.type === "image/webp" ? "webp" : "jpg";
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Sessão expirada.");
        const caminho = userData.user.id + "/logo-" + Date.now() + "." + ext;
        const { error: uploadError } = await supabase.storage.from("marca")
          .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
        if (uploadError) throw new Error("Não foi possível enviar a logo.");
        const { data } = supabase.storage.from("marca").getPublicUrl(caminho);
        url = data.publicUrl;
        const { error: profileError } = await supabase.from("perfis").upsert({
          id: userData.user.id, logo_url: url, atualizado_em: new Date().toISOString(),
        });
        if (profileError) throw new Error("O arquivo foi enviado, mas não foi possível atualizar o perfil.");
      } else {
        // Never fall back to Supabase when the provider selection is invalid.
        throw new Error("Destino de armazenamento inválido. Nada foi enviado.");
      }
      setLogoUrl(url);
      setMensagem("Logotipo atualizado. A nova imagem já aparece na prévia.");
    } catch (error) {
      setErro(true);
      setMensagem(error instanceof Error ? error.message :
        "Não foi possível atualizar o logotipo.");
    } finally {
      setEnviandoLogo(false);
    }
  }

  function escolherEstilo(estilo: HeroEstilo) {
    if (!podeHeroEstudio) return;
    setErro(false);
    setHeroEstilo(estilo);
    if ((estilo === "premium" || estilo === "tech") && !podePremiumTech) {
      setMensagem(`Você está visualizando o estilo ${estilo === "premium" ? "Editorial" : "Moderno"}. Para utilizá-lo, escolha o plano Profissional ou Studio.`);
      return;
    }
    setMensagem("");
  }

  async function salvar() {
    if (salvando) return;
    setErro(false); setMensagem("");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { router.replace("/login"); return; }
    const previewEstiloBloqueado = !podePremiumTech && (heroEstilo === "premium" || heroEstilo === "tech");
    const estiloEfetivo: HeroEstilo = previewEstiloBloqueado ? heroEstiloSalvo : heroEstilo;
    const ativoEfetivo = podeHeroEstudio && heroAtivo;
    setSalvando(true);
    const { error } = await supabase.from("perfis").upsert({
      id: userData.user.id,
      nome_estudio: nomeEstudio.trim(),
      cor_hero: corHero,
      hero_galeria_ativo: ativoEfetivo,
      hero_galeria_estilo: estiloEfetivo,
      hero_foto_capa_ativo: heroFotoCapaAtivo,
      atualizado_em: new Date().toISOString()
    });
    setSalvando(false);
    if (error) { setErro(true); setMensagem("Não foi possível salvar o perfil."); return; }
    setHeroAtivo(ativoEfetivo);
    setHeroEstiloSalvo(estiloEfetivo);
    if (!previewEstiloBloqueado) setHeroEstilo(estiloEfetivo);
    setMensagem(
      previewEstiloBloqueado
        ? "Perfil salvo. O estilo da prévia exige o plano Profissional ou Studio e não foi aplicado."
        : ativoEfetivo
          ? "Perfil salvo. Sua apresentação personalizada está ativa nos projetos."
          : "Perfil do estúdio salvo com sucesso."
    );
  }

  if (carregando) return <div className="profile-loading">Carregando perfil…<style>{`.profile-loading{min-height:100vh;display:grid;place-items:center;background:linear-gradient(180deg,var(--ft-bg-start),var(--ft-bg-end));color:var(--ft-text-muted)}`}</style></div>;

  return <main className="profile mf-shift">
    <MenuFotografo/>
    <style>{`
      .profile{min-height:100vh;background:linear-gradient(180deg,var(--ft-bg-start) 0%,var(--ft-bg-end) 100%);color:var(--ft-text)}
      .profile-body{max-width:1120px;margin:0 auto;padding:46px 5vw 80px}
      .profile-head{margin-bottom:22px}.ey{font-size:10px;font-weight:800;letter-spacing:1.8px;color:#6B5BAE}.h1{font-size:29px;letter-spacing:-.6px;margin:6px 0 5px}.sub{font-size:12.5px;color:var(--ft-text-muted);line-height:1.55;margin:0}
      .layout{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;align-items:start}
      .panel{background:rgba(250,248,253,.96);border:1px solid var(--ft-border-soft);border-radius:16px;box-shadow:0 10px 28px rgba(65,52,111,.05)}
      .editor{padding:18px}.panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:14px;border-bottom:1px solid #E7E2EE}.panel-title{font-size:15px;font-weight:800;margin:0;color:#292E45}.panel-desc{font-size:var(--ft-font-sm);color:var(--ft-text-muted);line-height:1.5;margin:4px 0 0}.panel-badge{flex:none;padding:5px 8px;border-radius:999px;background:#EEE8FA;color:#665C91;font-size:var(--ft-font-xs);font-weight:800;letter-spacing:.5px;text-transform:uppercase}
      .field{display:block;margin-top:14px}.field-label{display:block;margin-bottom:6px;font-size:10px;font-weight:700;color:#5F667E}.input{width:100%;height:38px;box-sizing:border-box;padding:0 11px;border:1px solid var(--ft-border);border-radius:var(--ft-radius-control);background:var(--ft-surface-soft);color:var(--ft-text);font-family:inherit;font-size:12px;outline:none}.input:focus{border-color:#B8ACD5;background:#FCFAFE}
      .brand-block{display:grid;grid-template-columns:64px minmax(0,1fr);gap:12px;align-items:center;padding:11px;border:1px solid #E4DEEC;border-radius:var(--ft-radius-card);background:#F8F5FB}.preview{width:64px;height:64px;border-radius:var(--ft-radius-card);border:1px solid var(--ft-border-soft);background:var(--ft-bg-start);display:grid;place-items:center;overflow:hidden}.preview img{width:100%;height:100%;object-fit:contain}.preview span{font-size:var(--ft-font-xs);font-weight:700;color:var(--ft-text-muted)}.file-wrap{min-width:0}.file{width:100%;font-family:inherit;font-size:10px;color:var(--ft-text-muted)}.file::file-selector-button{height:31px;margin-right:8px;border:1px solid var(--ft-border);border-radius:var(--ft-radius-control);background:var(--ft-surface);color:var(--ft-text-secondary);padding:0 10px;font-family:inherit;font-size:var(--ft-font-xs);font-weight:700;cursor:pointer}.file::file-selector-button:hover{background:#F0EBF7}.hint{font-size:var(--ft-font-xs);color:var(--ft-text-muted);line-height:1.45;margin:5px 0 0}
      .color-block{display:flex;align-items:center;gap:10px;padding:10px 11px;border:1px solid #E4DEEC;border-radius:var(--ft-radius-card);background:#F8F5FB}.color{width:42px;height:36px;border:1px solid var(--ft-border);border-radius:var(--ft-radius-control);background:var(--ft-surface-muted);padding:3px;cursor:pointer}.hex{font-size:var(--ft-font-sm);font-weight:800;letter-spacing:.7px;text-transform:uppercase;color:#3E445B}
      .section-divider{height:1px;background:#E7E2EE;margin:17px 0}
      .hero-section{padding:14px;border:1px solid #DED8E9;border-radius:var(--ft-radius-card);background:#F8F5FB}.hero-header{display:flex;align-items:center;justify-content:space-between;gap:14px}.hero-title{font-size:12.5px;font-weight:800;color:#2E3349}.hero-copy{font-size:var(--ft-font-xs);color:var(--ft-text-muted);line-height:1.45;margin-top:3px}.switch{position:relative;width:36px;height:20px;flex:none}.switch input{position:absolute;opacity:0;pointer-events:none}.switch-track{position:absolute;inset:0;border-radius:999px;background:#D6D0E1;border:1px solid #C9C1D9;transition:.18s;cursor:pointer}.switch-track:after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.12);transition:.18s}.switch input:checked+.switch-track{background:linear-gradient(90deg,var(--ft-brand-blue),var(--ft-brand-purple));border-color:transparent}.switch input:checked+.switch-track:after{transform:translateX(16px)}.switch input:disabled+.switch-track{opacity:.45;cursor:not-allowed}
      .styles{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:13px}.style-btn{height:34px;border:1px solid var(--ft-border);border-radius:var(--ft-radius-control);background:var(--ft-surface);color:#666D86;font-family:inherit;font-size:10px;font-weight:700;cursor:pointer}.style-btn:hover:not(:disabled){background:#F0EBF7;border-color:#C9C0DF}.style-btn.on{border-color:#9E91C6;background:#ECE7F6;color:var(--ft-accent-ink)}.style-btn.locked{opacity:.72}.style-btn.locked.on{border-color:#9E91C6;background:#ECE7F6;color:var(--ft-accent-ink)}.pro-tag{font-size:var(--ft-font-xs);margin-left:4px;color:#7A6BB2}.plan-note{display:flex;align-items:center;gap:6px;margin-top:9px;color:var(--ft-text-muted);font-size:var(--ft-font-xs)}.plan-note:before{content:"";width:6px;height:6px;border-radius:50%;background:#9C90C2;flex:none}
      .photo-feature{margin-top:11px;padding:11px;border:1px solid #DED7E9;border-radius:10px;background:#FCFAFE;display:flex;align-items:center;justify-content:space-between;gap:12px}.photo-feature strong{font-size:var(--ft-font-sm);color:#343950}.photo-feature p{font-size:var(--ft-font-xs);color:var(--ft-text-muted);margin:3px 0 0;line-height:1.4}
      .btn{height:35px;border:1px solid var(--ft-border);border-radius:var(--ft-radius-control);padding:0 12px;background:var(--ft-surface);color:var(--ft-text-secondary);font-family:inherit;font-size:var(--ft-font-sm);font-weight:700;cursor:pointer}.btn:hover:not(:disabled){background:#F0EBF7}.btn.primary{border:0;color:#fff;background:linear-gradient(90deg,var(--ft-brand-blue),var(--ft-brand-purple))}.btn:disabled{opacity:.5;cursor:not-allowed}.editor-actions{display:flex;justify-content:flex-end;margin-top:16px}.save{min-width:142px}
      .notice{margin-top:12px;padding:10px 12px;border-radius:10px;font-size:var(--ft-font-sm);color:var(--ft-success);background:#EAF5EF;border:1px solid #CBE4D6}.notice.err{color:#A6535E;background:#FAF0F2;border-color:#E7C7CC}
      .preview-panel{position:sticky;top:24px;padding:16px}.preview-panel .panel-head{padding-bottom:12px}.sample{margin-top:14px;border-radius:var(--ft-radius-card);overflow:hidden;border:1px solid #DDD7E8;background:#07110f}.hero-preview-viewport{position:relative;width:100%;overflow:hidden;background:#07110f}.hero-preview-stage.gc-hero{position:absolute;left:0;top:0;width:1120px;height:492px;overflow:hidden;transform-origin:top left}.hero-preview-stage .gc-hero-bg{position:absolute;inset:0;background-size:cover;background-position:center}.hero-preview-stage .gc-hero-bg:after{content:"";position:absolute;inset:0;background:rgba(7,7,16,.58)}.hero-preview-stage .gc-hero-wrap{position:relative;max-width:1120px;min-height:40vh;margin:auto;padding:58px 32px;display:flex;align-items:center;gap:52px}.hero-preview-stage .gc-brand{min-width:260px;text-align:center}.hero-preview-stage .gc-brand img{max-height:160px;max-width:280px}.hero-preview-stage .gc-brand span{font-size:46px;font-weight:800}.hero-preview-stage .gc-info{flex:1}.hero-preview-stage .gc-info h1{font-size:clamp(30px,5vw,58px);margin:12px 0}.preview-note{margin-top:10px;padding:9px 10px;border-radius:var(--ft-radius-control);background:var(--ft-surface-soft);border:1px solid #E5E0ED;color:var(--ft-text-muted);font-size:var(--ft-font-xs);line-height:1.45}
      @media(max-width:900px){.profile-body{padding:46px 32px 70px}.layout{grid-template-columns:1fr}.preview-panel{position:static}.sample{max-width:620px}}
      @media(max-width:640px){.profile-body{padding:76px 16px 60px}.h1{font-size:25px}.editor,.preview-panel{padding:15px}.brand-block{grid-template-columns:54px minmax(0,1fr)}.preview{width:54px;height:54px}.styles{grid-template-columns:1fr}.photo-feature{align-items:center}.editor-actions .btn{width:100%}}
    `}</style>

    <div className="profile-body">
      <header className="profile-head">
        <div className="ey">PERSONALIZAÇÃO</div>
        <h1 className="h1">Sua identidade, em cada entrega.</h1>
        <p className="sub">Personalize como sua marca aparece nas galerias que seus clientes recebem.</p>
      </header>

      <div className="layout">
        <div className="profile-editor-stack">
        <section className="panel editor brand-editor">
          <div className="panel-head">
            <div><h2 className="panel-title">Identidade do estúdio</h2><p className="panel-desc">Seu nome, logotipo e cor nas galerias.</p></div>
            <span className="panel-badge">01 · Marca</span>
          </div>

          <label className="field">
            <span className="field-label">Nome do estúdio</span>
            <input className="input" value={nomeEstudio} onChange={e=>setNomeEstudio(e.target.value)} maxLength={80} placeholder="Ex: Alvor Fotografia"/>
          </label>

          <div className="brand-grid">
          <div className="field">
            <span className="field-label">Logotipo</span>
            <div className="brand-block">
              <div className="preview">{logoUrl?<img src={logoUrl} alt="Logo atual do estúdio"/>:<span>SEM LOGO</span>}</div>
              <div className="file-wrap">
                <input id="profile-logo-upload" className="file profile-file-input" type="file" accept="image/png,image/jpeg,image/webp" disabled={enviandoLogo} onChange={e=>{const f=e.target.files?.[0];if(f)void enviarLogo(f);e.currentTarget.value="";}}/><label className={"profile-file-trigger"+(enviandoLogo?" busy":"")} htmlFor="profile-logo-upload">{enviandoLogo?"Enviando…":logoUrl?"Trocar logotipo":"Escolher imagem"}</label>
                <p className="hint">{enviandoLogo?"Atualizando sua marca…":"PNG, JPG ou WEBP · até 5 MB. Atualizado ao escolher."}</p>
              </div>
            </div>
          </div>

          <label className="field">
            <span className="field-label">Cor da marca</span>
            <div className="color-block">
              <input className="color" type="color" value={corHero} onChange={e=>setCorHero(e.target.value)}/>
              <div><div className="hex">{corHero.toUpperCase()}</div><div className="hint">Fundo da galeria quando não há foto de capa.</div></div>
            </div>
          </label>

          </div>
        </section>
        <section className="panel editor presentation-editor">
          <div className="panel-head"><div><h2 className="panel-title">Apresentação das galerias</h2><p className="panel-desc">Defina a aparência que seu cliente verá ao abrir um projeto.</p></div><span className="panel-badge">02 · Galerias</span></div>
          <div className="hero-section">
            <div className="hero-header">
              <div><div className="hero-title">Personalizar a abertura</div><div className="hero-copy">Ative para destacar seu logotipo e o nome do projeto.</div></div>
              <label className="switch" aria-label="Ativar apresentação personalizada">
                <input type="checkbox" checked={heroAtivo} disabled={!podeHeroEstudio} onChange={e=>setHeroAtivo(e.target.checked)}/>
                <span className="switch-track"/>
              </label>
            </div>

            <div className="profile-style-heading"><strong>Estilo da abertura</strong><span>Escolha para visualizar</span></div>
            <div className="styles" role="group" aria-label="Estilo da apresentação das galerias">
              <button type="button" aria-pressed={heroEstilo==="minimal"} className={"style-btn"+(heroEstilo==="minimal"?" on":"")} disabled={!podeHeroEstudio} onClick={()=>escolherEstilo("minimal")}><span className="style-visual visual-classic" aria-hidden="true"><i/><b/><em/></span><span className="style-copy"><strong>Clássico</strong><small>Simples e discreto</small></span><span className="style-indicator" aria-hidden="true">{heroEstilo==="minimal"?"✓":""}</span></button>
              <button type="button" aria-pressed={heroEstilo==="premium"} className={"style-btn"+(heroEstilo==="premium"?" on":"")+(!podePremiumTech?" locked":"")} disabled={!podeHeroEstudio} onClick={()=>escolherEstilo("premium")}><span className="style-visual visual-editorial" aria-hidden="true"><i/><b/><em/></span><span className="style-copy"><strong>Editorial</strong><small>Elegante e expressivo</small></span><span className="style-indicator" aria-hidden="true">{heroEstilo==="premium"?"✓":""}</span>{!podePremiumTech&&<span className="pro-tag">Só prévia</span>}</button>
              <button type="button" aria-pressed={heroEstilo==="tech"} className={"style-btn"+(heroEstilo==="tech"?" on":"")+(!podePremiumTech?" locked":"")} disabled={!podeHeroEstudio} onClick={()=>escolherEstilo("tech")}><span className="style-visual visual-modern" aria-hidden="true"><i/><b/><em/></span><span className="style-copy"><strong>Moderno</strong><small>Marcante e atual</small></span><span className="style-indicator" aria-hidden="true">{heroEstilo==="tech"?"✓":""}</span>{!podePremiumTech&&<span className="pro-tag">Só prévia</span>}</button>
            </div>

            <div className="plan-note">Plano {planoNome}. {podePremiumTech?"Os três estilos estão disponíveis.":podeHeroEstudio?"Editorial e Moderno podem ser vistos na prévia, mas exigem Profissional ou Studio para aplicar.":"A apresentação personalizada começa no plano Essencial."}</div>

            <div className="photo-feature">
              <div><strong>Usar a foto de capa do projeto como fundo</strong><p>{podeFotoHero?"Cada projeto pode exibir sua foto atrás do nome e do logotipo do estúdio.":"Disponível nos planos Profissional e Studio. A foto é escolhida nas configurações do projeto."}</p></div>
              <label className="switch" aria-label="Usar a foto de capa do projeto como fundo">
                <input type="checkbox" checked={podeFotoHero&&heroFotoCapaAtivo} disabled={!podeFotoHero||!podeHeroEstudio} onChange={e=>setHeroFotoCapaAtivo(e.target.checked)}/>
                <span className="switch-track"/>
              </label>
            </div>
          </div>

        </section>
        {mensagem&&<div role={erro?"alert":"status"} className={"notice"+(erro?" err":"")}>{mensagem}</div>}
        <div className="profile-save-dock"><div><strong>Sua identidade, em cada entrega.</strong><span>Nome, cor e apresentação são salvos juntos.</span></div><button className="btn primary save" type="button" disabled={salvando} onClick={()=>void salvar()}>{salvando?"Salvando…":"Salvar alterações"} <span aria-hidden="true">✓</span></button></div>
        </div>

        <aside className="panel preview-panel">
          <div className="panel-head">
            <div><span className="preview-eyebrow">VISUALIZAÇÃO EM TEMPO REAL</span><h2 className="panel-title">Veja como ficará</h2><p className="panel-desc">Uma amostra da abertura que o cliente verá.</p></div>
          </div>

          <div className="sample">
            <div ref={previewViewportRef} className="hero-preview-viewport" style={{height:HERO_PREVIEW_HEIGHT*previewScale}}>
              <div className="hero-preview-stage gc-hero" style={{backgroundColor:corHero,transform:`scale(${previewScale})`}}>
                <div className="gc-hero-bg ready" style={{backgroundImage:`url("${heroPresetDataUrl(corHero,heroEstilo)}")`}}/>
                <div className="gc-hero-wrap">
                  <div className="gc-brand gc-brand-hero">
                    {logoUrl?<img src={logoUrl} alt={nomeEstudio||"Fotura"}/>:<span style={{color:"#fff"}}>{nomeEstudio||"Fotura"}</span>}
                  </div>
                  <div className="gc-info">
                    <div style={{color:"#fff",opacity:.72}}>{nomeEstudio||"PROJETO"}</div>
                    <h1 style={{color:"#fff"}}>Nome do projeto</h1>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="preview-metadata"><div><span>Estilo</span><strong>{heroEstilo==="minimal"?"Clássico":heroEstilo==="premium"?"Editorial":"Moderno"}</strong></div><div><span>Apresentação</span><strong>{heroAtivo?"Ativada":"Desativada"}</strong></div></div>
          <div className="preview-note">{podeFotoHero&&heroFotoCapaAtivo?"Quando houver foto de capa no projeto, ela será usada como fundo. Aqui você visualiza o estilo com sua cor.":"A prévia acompanha suas escolhas. Clique em Salvar alterações para aplicá-las aos projetos."}</div>
        </aside>
      </div>
    </div>
  </main>;
}
