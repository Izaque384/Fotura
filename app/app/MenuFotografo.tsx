"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../lib/supabase-client";

function Icone({ tipo }: { tipo: "painel" | "galerias" | "config" | "sair" | "menu" | "fechar" }) {
  if (tipo === "painel") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/></svg>;
  if (tipo === "galerias") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 15 3.2-3.4 2.5 2.4 2.3-2.2L19 16"/><circle cx="8.5" cy="8.5" r="1.3"/></svg>;
  if (tipo === "config") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"/><circle cx="10" cy="7" r="2.4" fill="currentColor" stroke="none"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="15" cy="17" r="2.4" fill="currentColor" stroke="none"/></svg>;
  if (tipo === "sair") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 12H4"/><path d="M8 8l-4 4 4 4"/><path d="M13 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/></svg>;
  if (tipo === "fechar") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>;
}

export default function MenuFotografo() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    let ativo = true;
    async function carregarUsuario() {
      const { data } = await supabase.auth.getUser();
      if (!data.user || !ativo) return;
      const userEmail = data.user.email ?? "";
      setEmail(userEmail);
      const { data: perfil } = await supabase.from("perfis").select("nome_estudio").eq("id", data.user.id).maybeSingle();
      if (!ativo) return;
      setNome((perfil?.nome_estudio as string | null)?.trim() || userEmail.split("@")[0] || "Fotógrafo");
    }
    carregarUsuario();
    return () => { ativo = false; };
  }, [supabase]);

  useEffect(() => setDrawer(false), [pathname]);

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const itens = [
    { rota: "/dashboard", label: "Painel", tipo: "painel" as const, exato: true },
    { rota: "/dashboard/galerias", label: "Galerias", tipo: "galerias" as const },
    { rota: "/configuracoes", label: "Configurações", tipo: "config" as const, exato: true },
  ];

  const inicial = (nome || email || "F").charAt(0).toUpperCase();

  return (
    <>
      <style>{`
        .mf-mobile-btn { display:none; position:fixed; left:14px; top:14px; z-index:62; width:42px; height:42px; border-radius:11px; border:1px solid #2a2d40; background:#111126; color:#f0f0f5; align-items:center; justify-content:center; cursor:pointer; }
        .mf-mobile-btn svg { width:21px; height:21px; }
        .mf-backdrop { display:none; }
        .mf-side { position:fixed; top:0; left:0; height:100vh; width:236px; z-index:60; display:flex; flex-direction:column; padding:22px 16px; box-sizing:border-box; background:linear-gradient(180deg,#0c0c1e 0%,#0a0a15 100%); border-right:1px solid #1b1d31; box-shadow:10px 0 40px rgba(0,0,0,.35); overflow:hidden; }
        .mf-side::before { content:""; position:absolute; top:0; left:0; right:0; height:160px; background:radial-gradient(140px 90px at 34px 26px,rgba(74,108,247,.20),transparent 70%); pointer-events:none; }
        .mf-brand { position:relative; display:flex; align-items:center; gap:10px; background:none; border:none; cursor:pointer; padding:4px 8px 18px; margin-bottom:6px; }
        .mf-brand-ic { height:26px; width:30px; display:block; flex-shrink:0; }
        .mf-brand-tx { font-size:18px; font-weight:700; letter-spacing:3px; color:#f0f0f5; }
        .mf-nav { position:relative; display:flex; flex-direction:column; gap:4px; }
        .mf-item,.mf-sair { position:relative; display:flex; align-items:center; gap:12px; width:100%; padding:11px 12px; border-radius:11px; cursor:pointer; background:none; border:1px solid transparent; color:#9298b2; font-size:14px; font-weight:500; text-align:left; font-family:inherit; transition:background .15s ease,color .15s ease,border-color .15s ease; }
        .mf-item:hover { background:#14142a; color:#f0f0f5; }
        .mf-item.ativo { color:#fff; background:linear-gradient(90deg,rgba(17,150,252,.16),rgba(93,13,250,.09)); border-color:rgba(74,108,247,.35); }
        .mf-item.ativo::before { content:""; position:absolute; left:-16px; top:50%; transform:translateY(-50%); width:3px; height:22px; border-radius:0 3px 3px 0; background:linear-gradient(180deg,#1196fc,#5d0dfa); }
        .mf-item:focus-visible,.mf-sair:focus-visible,.mf-brand:focus-visible,.mf-mobile-btn:focus-visible { outline:2px solid #7ea2ff; outline-offset:2px; }
        .mf-ic { display:flex; align-items:center; justify-content:center; width:20px; height:20px; flex-shrink:0; }
        .mf-ic svg { width:20px; height:20px; }
        .mf-tx { white-space:nowrap; }
        .mf-bottom { position:relative; margin-top:auto; display:flex; flex-direction:column; gap:8px; }
        .mf-user { display:flex; align-items:center; gap:10px; min-width:0; padding:10px; border:1px solid #202238; background:rgba(255,255,255,.025); border-radius:12px; }
        .mf-avatar { width:34px; height:34px; border-radius:10px; flex:0 0 auto; display:flex; align-items:center; justify-content:center; color:white; font-size:13px; font-weight:700; background:linear-gradient(135deg,#1196fc,#5d0dfa); }
        .mf-user-info { min-width:0; }
        .mf-user-name,.mf-user-email { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .mf-user-name { color:#e8e9f2; font-size:12px; font-weight:600; }
        .mf-user-email { margin-top:2px; color:#646a86; font-size:10px; }
        .mf-sair { color:#b98a8a; }
        .mf-sair:hover { background:rgba(239,68,68,.10); color:#ff9d9d; border-color:rgba(239,68,68,.22); }
        .mf-shift { padding-left:236px; }
        @media (min-width:641px) and (max-width:980px) {
          .mf-side { width:72px; padding:18px 10px; }
          .mf-brand { justify-content:center; padding:4px 0 18px; }
          .mf-brand-tx,.mf-tx,.mf-user-info { display:none; }
          .mf-item,.mf-sair { justify-content:center; padding:12px 0; gap:0; }
          .mf-item.ativo::before { left:-10px; }
          .mf-user { justify-content:center; padding:8px 0; border-color:transparent; background:transparent; }
          .mf-shift { padding-left:72px; }
        }
        @media (max-width:640px) {
          .mf-mobile-btn { display:flex; }
          .mf-side { width:min(286px,84vw); transform:translateX(-105%); transition:transform .2s ease; }
          .mf-side.aberta { transform:translateX(0); }
          .mf-backdrop { display:block; position:fixed; inset:0; z-index:55; background:rgba(3,3,12,.68); opacity:0; pointer-events:none; transition:opacity .2s ease; }
          .mf-backdrop.aberta { opacity:1; pointer-events:auto; }
          .mf-shift { padding-left:0; }
        }
      `}</style>

      <button className="mf-mobile-btn" onClick={() => setDrawer((v) => !v)} aria-label={drawer ? "Fechar menu" : "Abrir menu"} aria-expanded={drawer}>
        <Icone tipo={drawer ? "fechar" : "menu"}/>
      </button>
      <div className={"mf-backdrop" + (drawer ? " aberta" : "")} onClick={() => setDrawer(false)} aria-hidden="true" />

      <aside className={"mf-side" + (drawer ? " aberta" : "")} aria-label="Navegação do fotógrafo">
        <button className="mf-brand" onClick={() => router.push("/dashboard")} aria-label="Ir para o painel">
          <svg className="mf-brand-ic" viewBox="0 0 115 101" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="mfGrad" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1196fc"/><stop offset="1" stopColor="#5d0dfa"/></linearGradient></defs><g fill="url(#mfGrad)"><path d="M65.5 6.1C60.6 6.6 56.3 8.3 52.5 11.4L7.7 55.1C4.7 59.5 6 64.8 12 68.4c5.1.9 10.2.4 14.9-1.7 4.1-2.5 8.5-7.2 17-14.7l17.8-17.1c3.2-2.7 6.7-4 10.8-4h16.8c5.4-.6 8.5-2.7 12.1-6.5 4.8-4.4 7-7.2 7.4-11.5-.1-4-2.4-6.3-5.6-6.7L65.5 6.1Z"/><path d="M71.3 45.7c-4.7.7-7.4 3-16.3 11.8L29 83c-2.6 4.3-1 9.3 3.5 11.2 3.2 1.2 10.4.7 13.6-.1 4.5-1.5 7.8-5.5 15.1-12l23.3-22.1c3-3.1 4-4.6 4-7.2.1-4.2-2.7-7-6.9-7.2l-10.3.1Z"/></g></svg>
          <span className="mf-brand-tx">FOTURA</span>
        </button>

        <nav className="mf-nav">
          {itens.map((it) => {
            const ativo = it.exato ? pathname === it.rota : pathname === it.rota || pathname.startsWith(it.rota + "/");
            return <button key={it.rota} className={"mf-item" + (ativo ? " ativo" : "")} onClick={() => router.push(it.rota)} title={it.label} aria-label={it.label} aria-current={ativo ? "page" : undefined}><span className="mf-ic"><Icone tipo={it.tipo}/></span><span className="mf-tx">{it.label}</span></button>;
          })}
        </nav>

        <div className="mf-bottom">
          <div className="mf-user" title={email || nome}><div className="mf-avatar" aria-hidden="true">{inicial}</div><div className="mf-user-info"><div className="mf-user-name">{nome || "Fotógrafo"}</div><div className="mf-user-email">{email}</div></div></div>
          <button className="mf-sair" onClick={sair} title="Sair" aria-label="Sair"><span className="mf-ic"><Icone tipo="sair"/></span><span className="mf-tx">Sair</span></button>
        </div>
      </aside>
    </>
  );
}
