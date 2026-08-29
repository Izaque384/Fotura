"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-client";
import MenuFotografo from "../MenuFotografo";

const TIPOS_LOGO = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_LOGO = 5 * 1024 * 1024;

export default function PerfilPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [nomeEstudio, setNomeEstudio] = useState("");
  const [corHero, setCorHero] = useState("#0b0b1a");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { router.replace("/login"); return; }
      const { data } = await supabase.from("perfis").select("nome_estudio, logo_url, cor_hero").eq("id", userData.user.id).maybeSingle();
      if (!ativo) return;
      setNomeEstudio((data?.nome_estudio as string | null) ?? "");
      setLogoUrl((data?.logo_url as string | null) ?? null);
      setCorHero((data?.cor_hero as string | null) ?? "#0b0b1a");
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
    else { setLogoUrl(url); setMensagem("Logo atualizada. Ela também aparecerá no seu perfil do menu."); }
    setEnviandoLogo(false);
  }

  async function salvar() {
    if (salvando) return;
    setErro(false); setMensagem("");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { router.replace("/login"); return; }
    setSalvando(true);
    const { error } = await supabase.from("perfis").upsert({ id: userData.user.id, nome_estudio: nomeEstudio.trim(), cor_hero: corHero, atualizado_em: new Date().toISOString() });
    setSalvando(false);
    if (error) { setErro(true); setMensagem("Não foi possível salvar o perfil."); return; }
    setMensagem("Perfil do estúdio salvo com sucesso.");
  }

  if (carregando) return <div className="profile-loading">Carregando perfil…<style>{`.profile-loading{min-height:100vh;display:grid;place-items:center;background:linear-gradient(180deg,#0b0b1a,#101024);color:#7a7f9a}`}</style></div>;

  return <main className="profile mf-shift"><MenuFotografo/><style>{`
    .profile{min-height:100vh;background:linear-gradient(180deg,#0b0b1a,#101024);color:#f0f0f5}.profile-body{max-width:920px;margin:auto;padding:46px 40px 80px}.ey{font-size:11px;letter-spacing:2px;color:#6f76a0}.h1{font-size:30px;margin:7px 0}.sub{font-size:13px;color:#7a7f9a;line-height:1.6}.layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px;margin-top:24px}.card{background:linear-gradient(180deg,#14142b,#101023);border:1px solid #23233c;border-radius:16px;padding:22px}.card h2{font-size:16px;margin:0 0 4px}.field{display:block;margin-top:18px;font-size:12px;color:#a0a4b8}.input{display:block;width:100%;box-sizing:border-box;margin-top:7px;padding:12px 13px;border:1px solid #2a2d40;border-radius:10px;background:#0d0d1e;color:#f0f0f5;font:inherit}.brandrow{display:flex;align-items:center;gap:16px;margin-top:18px}.preview{width:78px;height:78px;border-radius:16px;border:1px solid #2a2d40;background:#0d0d1e;display:grid;place-items:center;overflow:hidden;flex:none}.preview img{width:100%;height:100%;object-fit:contain}.preview span{font-size:10px;color:#5a5f78}.file{font-size:12px;color:#a0a4b8;max-width:100%}.hint{font-size:11px;color:#686e89;margin:7px 0 0}.colorrow{display:flex;align-items:center;gap:12px;margin-top:9px}.color{width:54px;height:48px;border:1px solid #2a2d40;border-radius:10px;background:#0d0d1e;padding:4px}.hex{font-size:13px;letter-spacing:.8px;text-transform:uppercase}.btn{border:0;border-radius:10px;padding:11px 15px;color:#fff;background:linear-gradient(90deg,#1196fc,#5d0dfa);font:600 13px inherit;cursor:pointer}.btn:disabled{opacity:.55;cursor:default}.save{width:100%;margin-top:22px}.notice{margin-top:14px;padding:10px 12px;border-radius:10px;font-size:12px;color:#8fe3b0;background:rgba(143,227,176,.06);border:1px solid rgba(143,227,176,.18)}.notice.err{color:#ff9d9d;background:rgba(255,157,157,.06);border-color:rgba(255,157,157,.18)}.sample{min-height:240px;border-radius:14px;overflow:hidden;border:1px solid #282a43;background:#0c0c1a}.sample-hero{height:118px;display:grid;place-items:center;padding:16px;text-align:center}.sample-logo{width:54px;height:54px;object-fit:contain;border-radius:10px}.sample-name{font-size:13px;font-weight:700;margin-top:8px}.sample-body{padding:16px}.sample-line{height:8px;border-radius:999px;background:#292b43;margin-bottom:8px}.sample-line.short{width:60%}@media(max-width:780px){.layout{grid-template-columns:1fr}.profile-body{padding:76px 18px 60px}.h1{font-size:25px}}`}</style>
    <div className="profile-body"><div className="ey">PERFIL DO ESTÚDIO</div><h1 className="h1">Sua marca no Fotura</h1><p className="sub">Defina como seu estúdio aparece nas galerias entregues aos clientes.</p>
      <div className="layout"><section className="card"><h2>Identidade do estúdio</h2><p className="sub">Nome, logo e cor principal usados na experiência do cliente.</p>
        <label className="field">Nome do estúdio<input className="input" value={nomeEstudio} onChange={e=>setNomeEstudio(e.target.value)} maxLength={80} placeholder="Ex: JI Motion"/></label>
        <div className="field">Logo do estúdio<div className="brandrow"><div className="preview">{logoUrl?<img src={logoUrl} alt="Logo atual do estúdio"/>:<span>SEM LOGO</span>}</div><div><input className="file" type="file" accept="image/png,image/jpeg,image/webp" disabled={enviandoLogo} onChange={e=>{const f=e.target.files?.[0];if(f)void enviarLogo(f)}}/><p className="hint">PNG, JPG ou WEBP · máximo 5 MB. Fundo transparente funciona melhor.</p></div></div></div>
        <label className="field">Cor preferencial do hero<div className="colorrow"><input className="color" type="color" value={corHero} onChange={e=>setCorHero(e.target.value)}/><div><div className="hex">{corHero}</div><div className="hint">Aplicada ao topo da galeria do cliente.</div></div></div></label>
        <button className="btn save" type="button" disabled={salvando} onClick={()=>void salvar()}>{salvando?"Salvando…":"Salvar perfil"}</button>{mensagem&&<div role={erro?"alert":"status"} className={"notice"+(erro?" err":"")}>{mensagem}</div>}
      </section><aside className="card"><h2>Prévia</h2><p className="sub">Uma referência rápida da sua marca na galeria.</p><div className="sample"><div className="sample-hero" style={{background:corHero}}>{logoUrl?<div><img className="sample-logo" src={logoUrl} alt=""/><div className="sample-name">{nomeEstudio||"Seu estúdio"}</div></div>:<div className="sample-name">{nomeEstudio||"Seu estúdio"}</div>}</div><div className="sample-body"><div className="sample-line"/><div className="sample-line short"/><div className="sample-line"/></div></div></aside></div>
    </div></main>;
}
