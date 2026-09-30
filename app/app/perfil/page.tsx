"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-client";
import MenuFotografo from "../MenuFotografo";

const TIPOS_LOGO = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_LOGO = 5 * 1024 * 1024;
type HeroEstilo = "minimal" | "premium" | "tech";
type Billing = { plano?: { nome?: string; recursos?: { heroEstudio?: boolean; heroPremiumTech?: boolean; heroFotoGaleria?: boolean } } };

export default function PerfilPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [nomeEstudio, setNomeEstudio] = useState("");
  const [corHero, setCorHero] = useState("#F0EDF7");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [heroAtivo, setHeroAtivo] = useState(false);
  const [heroEstilo, setHeroEstilo] = useState<HeroEstilo>("minimal");
  const [heroEstiloSalvo, setHeroEstiloSalvo] = useState<HeroEstilo>("minimal");
  const [previewFotoDemo, setPreviewFotoDemo] = useState(false);
  const [podeHeroEstudio, setPodeHeroEstudio] = useState(false);
  const [podePremiumTech, setPodePremiumTech] = useState(false);
  const [podeFotoHero, setPodeFotoHero] = useState(false);
  const [planoNome, setPlanoNome] = useState("Sem plano");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { router.replace("/login"); return; }
      const [{ data }, { data: { session } }] = await Promise.all([
        supabase.from("perfis").select("nome_estudio,logo_url,cor_hero,hero_galeria_ativo,hero_galeria_estilo").eq("id", userData.user.id).maybeSingle(),
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
      setCorHero((data?.cor_hero as string | null) ?? "#F0EDF7");
      setHeroAtivo(Boolean(data?.hero_galeria_ativo) && recursos.heroEstudio);
      setHeroEstilo(estiloEfetivo);
      setHeroEstiloSalvo(estiloSalvo);
      setPodeHeroEstudio(recursos.heroEstudio);
      setPodePremiumTech(recursos.heroPremiumTech);
      setPodeFotoHero(recursos.heroFotoGaleria);
      setPlanoNome(nomePlano);
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [router, supabase]);

  async function enviarLogo(arquivo: File) {
    setErro(false); setMensagem("");
    if (!TIPOS_LOGO.has(arquivo.type)) { setErro(true); setMensagem("Use uma imagem PNG, JPG ou WEBP."); return; }
    if (arquivo.size > MAX_LOGO) { setErro(true); setMensagem("A logo deve ter no máximo 5 MB."); return; }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { router.replace("/login"); return; }
    setEnviandoLogo(true);
    const ext = arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg";
    const caminho = `${userData.user.id}/logo-${Date.now()}.${ext}`;
    const { error: erroUpload } = await supabase.storage.from("marca").upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
    if (erroUpload) { setErro(true); setMensagem("Não foi possível enviar a logo."); setEnviandoLogo(false); return; }
    const { data: urlData } = supabase.storage.from("marca").getPublicUrl(caminho);
    const url = urlData.publicUrl;
    const { error: erroPerfil } = await supabase.from("perfis").upsert({ id: userData.user.id, logo_url: url, atualizado_em: new Date().toISOString() });
    if (erroPerfil) { setErro(true); setMensagem("A imagem foi enviada, mas não foi possível atualizar o perfil."); }
    else { setLogoUrl(url); setMensagem("Logo atualizada. O Hero do estúdio também usa essa imagem."); }
    setEnviandoLogo(false);
  }

  function escolherEstilo(estilo: HeroEstilo) {
    if (!podeHeroEstudio) return;
    setErro(false);
    setHeroEstilo(estilo);
    if ((estilo === "premium" || estilo === "tech") && !podePremiumTech) {
      setMensagem(`Prévia do Hero ${estilo === "premium" ? "Premium" : "Tech"}. Para aplicar este estilo, use o plano Profissional ou Studio.`);
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
    const previewFotoBloqueada = previewFotoDemo && !podeFotoHero;
    setSalvando(true);
    const { error } = await supabase.from("perfis").upsert({
      id: userData.user.id,
      nome_estudio: nomeEstudio.trim(),
      cor_hero: corHero,
      hero_galeria_ativo: ativoEfetivo,
      hero_galeria_estilo: estiloEfetivo,
      atualizado_em: new Date().toISOString()
    });
    setSalvando(false);
    if (error) { setErro(true); setMensagem("Não foi possível salvar o perfil."); return; }
    setHeroAtivo(ativoEfetivo);
    setHeroEstiloSalvo(estiloEfetivo);
    if (!previewEstiloBloqueado) setHeroEstilo(estiloEfetivo);
    setMensagem(
      previewEstiloBloqueado || previewFotoBloqueada
        ? "Perfil salvo. Os recursos marcados como prévia não foram aplicados; eles ficam disponíveis no Profissional e Studio."
        : ativoEfetivo
          ? "Perfil salvo. O Hero do estúdio está ativo nas galerias."
          : "Perfil do estúdio salvo com sucesso."
    );
  }

  if (carregando) return <div className="profile-loading">Carregando perfil…<style>{`.profile-loading{min-height:100vh;display:grid;place-items:center;background:linear-gradient(180deg,#F0EDF7,#ECE8F4);color:#7a7f9a}`}</style></div>;

  return <main className="profile mf-shift">
    <MenuFotografo/>
    <style>{`
      .profile{min-height:100vh;background:linear-gradient(180deg,#F0EDF7 0%,#ECE8F4 100%);color:#21253A}
      .profile-body{max-width:1120px;margin:0 auto;padding:46px 5vw 80px}
      .profile-head{margin-bottom:22px}.ey{font-size:10px;font-weight:800;letter-spacing:1.8px;color:#6B5BAE}.h1{font-size:29px;letter-spacing:-.6px;margin:6px 0 5px}.sub{font-size:12.5px;color:#73758D;line-height:1.55;margin:0}
      .layout{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;align-items:start}
      .panel{background:rgba(250,248,253,.96);border:1px solid #DCD6EE;border-radius:16px;box-shadow:0 10px 28px rgba(65,52,111,.05)}
      .editor{padding:18px}.panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:14px;border-bottom:1px solid #E7E2EE}.panel-title{font-size:15px;font-weight:800;margin:0;color:#292E45}.panel-desc{font-size:10.5px;color:#777D93;line-height:1.5;margin:4px 0 0}.panel-badge{flex:none;padding:5px 8px;border-radius:999px;background:#EEE8FA;color:#665C91;font-size:8px;font-weight:800;letter-spacing:.5px;text-transform:uppercase}
      .field{display:block;margin-top:14px}.field-label{display:block;margin-bottom:6px;font-size:10px;font-weight:750;color:#5F667E}.input{width:100%;height:38px;box-sizing:border-box;padding:0 11px;border:1px solid #D7D0E7;border-radius:9px;background:#F7F4FB;color:#21253A;font-family:inherit;font-size:12px;outline:none}.input:focus{border-color:#B8ACD5;background:#FCFAFE}
      .brand-block{display:grid;grid-template-columns:64px minmax(0,1fr);gap:12px;align-items:center;padding:11px;border:1px solid #E4DEEC;border-radius:11px;background:#F8F5FB}.preview{width:64px;height:64px;border-radius:12px;border:1px solid #DCD6EE;background:#F0EDF7;display:grid;place-items:center;overflow:hidden}.preview img{width:100%;height:100%;object-fit:contain}.preview span{font-size:8px;font-weight:750;color:#777D93}.file-wrap{min-width:0}.file{width:100%;font-family:inherit;font-size:10px;color:#777D93}.file::file-selector-button{height:31px;margin-right:8px;border:1px solid #D7D0E7;border-radius:8px;background:#FAF8FD;color:#596079;padding:0 10px;font-family:inherit;font-size:9.5px;font-weight:750;cursor:pointer}.file::file-selector-button:hover{background:#F0EBF7}.hint{font-size:9.5px;color:#85899B;line-height:1.45;margin:5px 0 0}
      .color-block{display:flex;align-items:center;gap:10px;padding:10px 11px;border:1px solid #E4DEEC;border-radius:11px;background:#F8F5FB}.color{width:42px;height:36px;border:1px solid #D7D0E7;border-radius:8px;background:#F3EFF9;padding:3px;cursor:pointer}.hex{font-size:11px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;color:#3E445B}
      .section-divider{height:1px;background:#E7E2EE;margin:17px 0}
      .hero-section{padding:14px;border:1px solid #DED8E9;border-radius:13px;background:#F8F5FB}.hero-header{display:flex;align-items:center;justify-content:space-between;gap:14px}.hero-title{font-size:12.5px;font-weight:800;color:#2E3349}.hero-copy{font-size:9.5px;color:#85899B;line-height:1.45;margin-top:3px}.switch{position:relative;width:36px;height:20px;flex:none}.switch input{position:absolute;opacity:0;pointer-events:none}.switch-track{position:absolute;inset:0;border-radius:999px;background:#D6D0E1;border:1px solid #C9C1D9;transition:.18s;cursor:pointer}.switch-track:after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.12);transition:.18s}.switch input:checked+.switch-track{background:linear-gradient(90deg,#1196FC,#5D0DFA);border-color:transparent}.switch input:checked+.switch-track:after{transform:translateX(16px)}.switch input:disabled+.switch-track{opacity:.45;cursor:not-allowed}
      .styles{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:13px}.style-btn{height:34px;border:1px solid #D7D0E7;border-radius:8px;background:#FAF8FD;color:#666D86;font-family:inherit;font-size:10px;font-weight:750;cursor:pointer}.style-btn:hover:not(:disabled){background:#F0EBF7;border-color:#C9C0DF}.style-btn.on{border-color:#9E91C6;background:#ECE7F6;color:#514780}.style-btn.locked{opacity:.72}.style-btn.locked.on{border-color:#9E91C6;background:#ECE7F6;color:#514780}.pro-tag{font-size:7px;margin-left:4px;color:#7A6BB2}.plan-note{display:flex;align-items:center;gap:6px;margin-top:9px;color:#777D93;font-size:8.8px}.plan-note:before{content:"";width:6px;height:6px;border-radius:50%;background:#9C90C2;flex:none}
      .photo-feature{margin-top:11px;padding:11px;border:1px solid #DED7E9;border-radius:10px;background:#FCFAFE;display:flex;align-items:center;justify-content:space-between;gap:12px}.photo-feature strong{font-size:10.5px;color:#343950}.photo-feature p{font-size:9px;color:#85899B;margin:3px 0 0;line-height:1.4}.photo-actions{display:flex;gap:6px;flex:none}
      .btn{height:35px;border:1px solid #D7D0E7;border-radius:9px;padding:0 12px;background:#FAF8FD;color:#596079;font-family:inherit;font-size:10.5px;font-weight:750;cursor:pointer}.btn:hover:not(:disabled){background:#F0EBF7}.btn.primary{border:0;color:#fff;background:linear-gradient(90deg,#1196FC,#5D0DFA)}.btn:disabled{opacity:.5;cursor:not-allowed}.editor-actions{display:flex;justify-content:flex-end;margin-top:16px}.save{min-width:142px}
      .notice{margin-top:12px;padding:10px 12px;border-radius:10px;font-size:10.5px;color:#3F7C5B;background:#EAF5EF;border:1px solid #CBE4D6}.notice.err{color:#A6535E;background:#FAF0F2;border-color:#E7C7CC}
      .preview-panel{position:sticky;top:24px;padding:16px}.preview-panel .panel-head{padding-bottom:12px}.sample{margin-top:14px;border-radius:13px;overflow:hidden;border:1px solid #DDD7E8;background:#F7F4FB}.sample-hero{height:210px;position:relative;overflow:hidden;display:grid;place-items:center;padding:18px;text-align:center}.sample-hero.premium{background:radial-gradient(circle at 18% 12%,color-mix(in srgb,var(--hero) 76%,#5D0DFA 24%) 0%,transparent 40%),linear-gradient(135deg,color-mix(in srgb,var(--hero) 82%,#D7D0E7 18%),#ECE8F4 70%)}.sample-hero.minimal{background:linear-gradient(145deg,color-mix(in srgb,var(--hero) 86%,#DAD3EA 14%),#ECE8F4)}.sample-hero.tech{background:linear-gradient(rgba(80,105,170,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(80,105,170,.08) 1px,transparent 1px),radial-gradient(circle at 75% 24%,color-mix(in srgb,var(--hero) 62%,#1196FC 38%),transparent 34%),#ECE8F4;background-size:24px 24px,24px 24px,auto,auto}.sample-hero.photo-preview{background-image:linear-gradient(rgba(7,7,16,.48),rgba(7,7,16,.48)),url("/hero/casamento-por-do-sol.webp")!important;background-size:cover!important;background-position:center!important}.sample-hero.photo-preview .sample-name,.sample-hero.photo-preview .sample-gallery{color:#fff;text-shadow:0 2px 18px rgba(0,0,0,.38)}.sample-logo{width:66px;height:66px;object-fit:contain}.sample-name{font-size:11.5px;font-weight:750;margin-top:8px;color:#252A41}.sample-gallery{font-size:21px;font-weight:800;margin-top:14px;letter-spacing:-.3px;color:#21253A}.sample-body{padding:14px}.sample-line{height:7px;border-radius:999px;background:#DAD4E6;margin-bottom:7px}.sample-line.short{width:60%}.preview-note{margin-top:10px;padding:9px 10px;border-radius:9px;background:#F7F4FB;border:1px solid #E5E0ED;color:#777D93;font-size:9px;line-height:1.45}
      @media(max-width:900px){.profile-body{padding:46px 32px 70px}.layout{grid-template-columns:1fr}.preview-panel{position:static}.sample{max-width:520px}}
      @media(max-width:640px){.profile-body{padding:76px 16px 60px}.h1{font-size:25px}.editor,.preview-panel{padding:15px}.brand-block{grid-template-columns:54px minmax(0,1fr)}.preview{width:54px;height:54px}.styles{grid-template-columns:1fr}.photo-feature{align-items:flex-start;flex-direction:column}.photo-actions{width:100%}.photo-feature .btn{width:100%}.editor-actions .btn{width:100%}}
    `}</style>

    <div className="profile-body">
      <header className="profile-head">
        <div className="ey">PERFIL DO ESTÚDIO</div>
        <h1 className="h1">Sua marca no Fotura</h1>
        <p className="sub">Defina como seu estúdio aparece nas galerias entregues aos clientes.</p>
      </header>

      <div className="layout">
        <section className="panel editor">
          <div className="panel-head">
            <div><h2 className="panel-title">Identidade do estúdio</h2><p className="panel-desc">Nome, logo e aparência usados na experiência do cliente.</p></div>
            <span className="panel-badge">Marca</span>
          </div>

          <label className="field">
            <span className="field-label">Nome do estúdio</span>
            <input className="input" value={nomeEstudio} onChange={e=>setNomeEstudio(e.target.value)} maxLength={80} placeholder="Ex: Alvor Fotografia"/>
          </label>

          <div className="field">
            <span className="field-label">Logo do estúdio</span>
            <div className="brand-block">
              <div className="preview">{logoUrl?<img src={logoUrl} alt="Logo atual do estúdio"/>:<span>SEM LOGO</span>}</div>
              <div className="file-wrap">
                <input className="file" type="file" accept="image/png,image/jpeg,image/webp" disabled={enviandoLogo} onChange={e=>{const f=e.target.files?.[0];if(f)void enviarLogo(f)}}/>
                <p className="hint">{enviandoLogo?"Enviando logo…":"PNG, JPG ou WEBP · máximo 5 MB. Fundo transparente funciona melhor."}</p>
              </div>
            </div>
          </div>

          <label className="field">
            <span className="field-label">Cor preferencial do hero</span>
            <div className="color-block">
              <input className="color" type="color" value={corHero} onChange={e=>setCorHero(e.target.value)}/>
              <div><div className="hex">{corHero}</div><div className="hint">Usada como base quando o hero não utiliza uma foto da galeria.</div></div>
            </div>
          </label>

          <div className="section-divider"/>

          <div className="hero-section">
            <div className="hero-header">
              <div><div className="hero-title">Hero do estúdio</div><div className="hero-copy">Controle a composição da logo e dos textos nas galerias.</div></div>
              <label className="switch">
                <input type="checkbox" checked={heroAtivo} disabled={!podeHeroEstudio} onChange={e=>setHeroAtivo(e.target.checked)}/>
                <span className="switch-track"/>
              </label>
            </div>

            <div className="styles" aria-label="Estilo do Hero do estúdio">
              <button type="button" className={"style-btn"+(heroEstilo==="minimal"?" on":"")} disabled={!podeHeroEstudio} onClick={()=>escolherEstilo("minimal")}>Minimal</button>
              <button type="button" className={"style-btn"+(heroEstilo==="premium"?" on":"")+(!podePremiumTech?" locked":"")} disabled={!podeHeroEstudio} onClick={()=>escolherEstilo("premium")}>Premium{!podePremiumTech&&<span className="pro-tag">PRÉVIA</span>}</button>
              <button type="button" className={"style-btn"+(heroEstilo==="tech"?" on":"")+(!podePremiumTech?" locked":"")} disabled={!podeHeroEstudio} onClick={()=>escolherEstilo("tech")}>Tech{!podePremiumTech&&<span className="pro-tag">PRÉVIA</span>}</button>
            </div>

            <div className="plan-note">Plano atual: {planoNome}. {podePremiumTech?"Premium, Tech e foto de fundo estão liberados no seu plano.":podeHeroEstudio?"Premium, Tech e foto de fundo podem ser pré-visualizados; para aplicar, use Profissional ou Studio.":"O Hero personalizado começa no Essencial."}</div>

            <div className="photo-feature">
              <div><strong>Foto da galeria no fundo</strong><p>{podeFotoHero?"Escolha o fundo de cada entrega e mantenha o layout escolhido por cima.":podeHeroEstudio?"Veja uma prévia aqui; a aplicação por galeria fica disponível no Profissional e Studio.":"Recurso disponível a partir do plano Profissional."}</p></div>
              {podeFotoHero
                ? <button className="btn" type="button" onClick={()=>router.push("/dashboard/heros")}>Personalizar galerias</button>
                : podeHeroEstudio
                  ? <div className="photo-actions"><button className="btn" type="button" onClick={()=>setPreviewFotoDemo(v=>!v)}>{previewFotoDemo?"Remover prévia":"Ver prévia"}</button><button className="btn" type="button" onClick={()=>router.push("/dashboard/assinatura")}>Ver planos</button></div>
                  : <button className="btn" type="button" onClick={()=>router.push("/dashboard/assinatura")}>Ver planos</button>}
            </div>
          </div>

          <div className="editor-actions"><button className="btn primary save" type="button" disabled={salvando} onClick={()=>void salvar()}>{salvando?"Salvando…":"Salvar alterações"}</button></div>
          {mensagem&&<div role={erro?"alert":"status"} className={"notice"+(erro?" err":"")}>{mensagem}</div>}
        </section>

        <aside className="panel preview-panel">
          <div className="panel-head">
            <div><h2 className="panel-title">Prévia do hero</h2><p className="panel-desc">Veja como sua identidade aparece na abertura das galerias.</p></div>
            <span className="panel-badge">Ao vivo</span>
          </div>

          <div className="sample">
            <div className={`sample-hero ${heroEstilo}${previewFotoDemo?" photo-preview":""}`} style={{"--hero":corHero} as React.CSSProperties}>
              {logoUrl?<div><img className="sample-logo" src={logoUrl} alt=""/><div className="sample-name">{nomeEstudio||"Seu estúdio"}</div><div className="sample-gallery">Nome da galeria</div></div>:<div><div className="sample-name">{nomeEstudio||"Seu estúdio"}</div><div className="sample-gallery">Nome da galeria</div></div>}
            </div>
            <div className="sample-body"><div className="sample-line"/><div className="sample-line short"/><div className="sample-line"/></div>
          </div>

          <div className="preview-note">{previewFotoDemo&&!podeFotoHero?"Esta foto é apenas demonstrativa. No Profissional e Studio você escolhe uma foto real de cada galeria.":"O nome da galeria continua dinâmico. Logo, cor e estilo são aplicados conforme as configurações salvas aqui."}</div>
        </aside>
      </div>
    </div>
  </main>;
}
