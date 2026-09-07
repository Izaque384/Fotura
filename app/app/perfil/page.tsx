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
  const [corHero, setCorHero] = useState("#0b0b1a");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [heroAtivo, setHeroAtivo] = useState(false);
  const [heroEstilo, setHeroEstilo] = useState<HeroEstilo>("minimal");
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
      setCorHero((data?.cor_hero as string | null) ?? "#0b0b1a");
      setHeroAtivo(Boolean(data?.hero_galeria_ativo) && recursos.heroEstudio);
      setHeroEstilo(estiloEfetivo);
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
    if ((estilo === "premium" || estilo === "tech") && !podePremiumTech) {
      setErro(true);
      setMensagem("Premium e Tech estão disponíveis nos planos Profissional e Studio.");
      return;
    }
    setErro(false); setMensagem(""); setHeroEstilo(estilo);
  }

  async function salvar() {
    if (salvando) return;
    setErro(false); setMensagem("");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { router.replace("/login"); return; }
    const estiloEfetivo: HeroEstilo = !podePremiumTech && (heroEstilo === "premium" || heroEstilo === "tech") ? "minimal" : heroEstilo;
    const ativoEfetivo = podeHeroEstudio && heroAtivo;
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
    setHeroAtivo(ativoEfetivo); setHeroEstilo(estiloEfetivo);
    setMensagem(ativoEfetivo ? "Perfil salvo. O Hero do estúdio está ativo nas galerias." : "Perfil do estúdio salvo com sucesso.");
  }

  if (carregando) return <div className="profile-loading">Carregando perfil…<style>{`.profile-loading{min-height:100vh;display:grid;place-items:center;background:linear-gradient(180deg,#0b0b1a,#101024);color:#7a7f9a}`}</style></div>;

  return <main className="profile mf-shift"><MenuFotografo/><style>{`
    .profile{min-height:100vh;background:linear-gradient(180deg,#0b0b1a,#101024);color:#f0f0f5}.profile-body{max-width:1040px;margin:auto;padding:46px 40px 80px}.ey{font-size:11px;letter-spacing:2px;color:#6f76a0}.h1{font-size:30px;margin:7px 0}.sub{font-size:13px;color:#7a7f9a;line-height:1.6}.layout{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:18px;margin-top:24px}.card{background:linear-gradient(180deg,#14142b,#101023);border:1px solid #23233c;border-radius:16px;padding:22px}.card h2{font-size:16px;margin:0 0 4px}.field{display:block;margin-top:18px;font-size:12px;color:#a0a4b8}.input{display:block;width:100%;box-sizing:border-box;margin-top:7px;padding:12px 13px;border:1px solid #2a2d40;border-radius:10px;background:#0d0d1e;color:#f0f0f5;font:inherit}.brandrow{display:flex;align-items:center;gap:16px;margin-top:18px}.preview{width:78px;height:78px;border-radius:16px;border:1px solid #2a2d40;background:#0d0d1e;display:grid;place-items:center;overflow:hidden;flex:none}.preview img{width:100%;height:100%;object-fit:contain}.preview span{font-size:10px;color:#5a5f78}.file{font-size:12px;color:#a0a4b8;max-width:100%}.hint{font-size:11px;color:#686e89;margin:7px 0 0}.colorrow{display:flex;align-items:center;gap:12px;margin-top:9px}.color{width:54px;height:48px;border:1px solid #2a2d40;border-radius:10px;background:#0d0d1e;padding:4px}.hex{font-size:13px;letter-spacing:.8px;text-transform:uppercase}.btn{border:0;border-radius:10px;padding:11px 15px;color:#fff;background:linear-gradient(90deg,#1196fc,#5d0dfa);font:600 13px inherit;cursor:pointer}.btn.secondary{border:1px solid #2b304b;background:#111322;color:#d5daec}.btn:disabled{opacity:.48;cursor:not-allowed}.save{width:100%;margin-top:22px}.notice{margin-top:14px;padding:10px 12px;border-radius:10px;font-size:12px;color:#8fe3b0;background:rgba(143,227,176,.06);border:1px solid rgba(143,227,176,.18)}.notice.err{color:#ff9d9d;background:rgba(255,157,157,.06);border-color:rgba(255,157,157,.18)}.hero-box{margin-top:20px;padding:16px;border:1px solid #292d47;border-radius:14px;background:#0e0f1d}.hero-toggle{display:flex;align-items:center;justify-content:space-between;gap:18px}.hero-toggle strong{font-size:13px}.hero-toggle input{width:18px;height:18px}.styles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}.style-btn{position:relative;border:1px solid #2b304b;border-radius:10px;background:#111322;color:#8892ae;padding:10px 8px;font:650 11px inherit;cursor:pointer}.style-btn.on{border-color:#5369a1;color:#fff;background:linear-gradient(180deg,rgba(30,57,105,.66),rgba(24,35,72,.62))}.style-btn.locked{opacity:.58;cursor:not-allowed}.pro-tag{font-size:8px;margin-left:4px;color:#9fb0ff}.photo-feature{margin-top:12px;padding:13px;border:1px solid rgba(93,13,250,.28);border-radius:11px;background:linear-gradient(135deg,rgba(17,150,252,.05),rgba(93,13,250,.06));display:flex;align-items:center;justify-content:space-between;gap:12px}.photo-feature strong{font-size:12px}.photo-feature p{font-size:10px;color:#747b97;margin:4px 0 0}.sample{min-height:330px;border-radius:14px;overflow:hidden;border:1px solid #282a43;background:#0c0c1a}.sample-hero{height:205px;position:relative;overflow:hidden;display:grid;place-items:center;padding:18px;text-align:center}.sample-hero.premium{background:radial-gradient(circle at 18% 12%,color-mix(in srgb,var(--hero) 76%,#5d0dfa 24%) 0%,transparent 40%),linear-gradient(135deg,color-mix(in srgb,var(--hero) 82%,#111 18%),#0a0b16 70%)}.sample-hero.minimal{background:linear-gradient(145deg,color-mix(in srgb,var(--hero) 86%,#05060b 14%),#090a12)}.sample-hero.tech{background:linear-gradient(rgba(80,105,170,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(80,105,170,.08) 1px,transparent 1px),radial-gradient(circle at 75% 24%,color-mix(in srgb,var(--hero) 62%,#1196fc 38%),transparent 34%),#090a14;background-size:24px 24px,24px 24px,auto,auto}.sample-logo{width:72px;height:72px;object-fit:contain}.sample-name{font-size:13px;font-weight:700;margin-top:9px}.sample-gallery{font-size:22px;font-weight:760;margin-top:16px}.sample-body{padding:16px}.sample-line{height:8px;border-radius:999px;background:#292b43;margin-bottom:8px}.sample-line.short{width:60%}.plan-note{margin-top:10px;color:#777e99;font-size:10px}@media(max-width:860px){.layout{grid-template-columns:1fr}.profile-body{padding:76px 18px 60px}.h1{font-size:25px}.photo-feature{align-items:flex-start;flex-direction:column}}`}</style>
    <div className="profile-body"><div className="ey">PERFIL DO ESTÚDIO</div><h1 className="h1">Sua marca no Fotura</h1><p className="sub">Defina como seu estúdio aparece nas galerias entregues aos clientes.</p>
      <div className="layout"><section className="card"><h2>Identidade do estúdio</h2><p className="sub">Nome, logo e cor principal usados na experiência do cliente.</p>
        <label className="field">Nome do estúdio<input className="input" value={nomeEstudio} onChange={e=>setNomeEstudio(e.target.value)} maxLength={80} placeholder="Ex: JI Motion"/></label>
        <div className="field">Logo do estúdio<div className="brandrow"><div className="preview">{logoUrl?<img src={logoUrl} alt="Logo atual do estúdio"/>:<span>SEM LOGO</span>}</div><div><input className="file" type="file" accept="image/png,image/jpeg,image/webp" disabled={enviandoLogo} onChange={e=>{const f=e.target.files?.[0];if(f)void enviarLogo(f)}}/><p className="hint">PNG, JPG ou WEBP · máximo 5 MB. Fundo transparente funciona melhor.</p></div></div></div>
        <label className="field">Cor preferencial do hero<div className="colorrow"><input className="color" type="color" value={corHero} onChange={e=>setCorHero(e.target.value)}/><div><div className="hex">{corHero}</div><div className="hint">Usada como base quando o hero não utiliza uma foto da galeria.</div></div></div></label>
        <div className="hero-box"><div className="hero-toggle"><div><strong>Hero do estúdio</strong><p className="hint">Controla a composição da logo e dos textos nas galerias.</p></div><input type="checkbox" checked={heroAtivo} disabled={!podeHeroEstudio} onChange={e=>setHeroAtivo(e.target.checked)}/></div><div className="styles" aria-label="Estilo do Hero do estúdio"><button type="button" className={"style-btn"+(heroEstilo==="minimal"?" on":"")} disabled={!podeHeroEstudio} onClick={()=>escolherEstilo("minimal")}>Minimal</button><button type="button" className={"style-btn"+(heroEstilo==="premium"?" on":"")+(!podePremiumTech?" locked":"")} disabled={!podePremiumTech} onClick={()=>escolherEstilo("premium")}>Premium{!podePremiumTech&&<span className="pro-tag">PRO</span>}</button><button type="button" className={"style-btn"+(heroEstilo==="tech"?" on":"")+(!podePremiumTech?" locked":"")} disabled={!podePremiumTech} onClick={()=>escolherEstilo("tech")}>Tech{!podePremiumTech&&<span className="pro-tag">PRO</span>}</button></div><div className="plan-note">Plano atual: {planoNome}. Premium e Tech são liberados a partir do Profissional.</div><div className="photo-feature"><div><strong>Foto da galeria no fundo</strong><p>{podeFotoHero?"Escolha o fundo de cada entrega e mantenha o layout Premium ou Tech por cima.":"Recurso disponível nos planos Profissional e Studio."}</p></div><button className="btn secondary" type="button" onClick={()=>router.push("/dashboard/heros")}>{podeFotoHero?"Personalizar galerias":"Conhecer recurso"}</button></div></div>
        <button className="btn save" type="button" disabled={salvando} onClick={()=>void salvar()}>{salvando?"Salvando…":"Salvar perfil"}</button>{mensagem&&<div role={erro?"alert":"status"} className={"notice"+(erro?" err":"")}>{mensagem}</div>}
      </section><aside className="card"><h2>Prévia do hero</h2><p className="sub">O nome da galeria continua dinâmico; a identidade visual vem do estúdio.</p><div className="sample"><div className={`sample-hero ${heroEstilo}`} style={{"--hero":corHero} as React.CSSProperties}>{logoUrl?<div><img className="sample-logo" src={logoUrl} alt=""/><div className="sample-name">{nomeEstudio||"Seu estúdio"}</div><div className="sample-gallery">Nome da galeria</div></div>:<div><div className="sample-name">{nomeEstudio||"Seu estúdio"}</div><div className="sample-gallery">Nome da galeria</div></div>}</div><div className="sample-body"><div className="sample-line"/><div className="sample-line short"/><div className="sample-line"/></div></div></aside></div>
    </div></main>;
}
