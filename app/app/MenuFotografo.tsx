"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../lib/supabase-client";

type T = "painel" | "galerias" | "selecoes" | "clientes" | "assinatura" | "config" | "sair" | "menu" | "fechar";

function Icone({ tipo }: { tipo: T }) {
  const common = { "aria-hidden": true as const };
  if (tipo === "painel") return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/></svg>;
  if (tipo === "galerias") return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 15 3-3 3 3 2-2 4 3"/></svg>;
  if (tipo === "selecoes") return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 6h12M8 12h12M8 18h12M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"/></svg>;
  if (tipo === "clientes") return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-3.5 2.3-5.3 5.5-5.3s5 1.8 5.5 5.3M16 8.5a2.5 2.5 0 1 1 0 5M17 14.5c2.2.4 3.3 1.8 3.5 4.5"/></svg>;
  if (tipo === "assinatura") return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 14h4"/></svg>;
  if (tipo === "config") return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M4 17h16"/><circle cx="10" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></svg>;
  if (tipo === "sair") return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M15 12H4M8 8l-4 4 4 4M13 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/></svg>;
  if (tipo === "fechar") return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18"/></svg>;
  return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function MenuFotografo() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [uid, setUid] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [selecoesNaoLidas, setSelecoesNaoLidas] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const [mobile, setMobile] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || !ativo) return;
      const e = data.user.email ?? "";
      setUid(data.user.id);
      setEmail(e);
      const { data: perfil } = await supabase.from("perfis").select("nome_estudio,logo_url").eq("id", data.user.id).maybeSingle();
      if (!ativo) return;
      setNome((perfil?.nome_estudio as string | null)?.trim() || e.split("@")[0] || "Fotógrafo");
      setLogo((perfil?.logo_url as string | null) || null);
    })();
    return () => { ativo = false; };
  }, [supabase, pathname]);

  useEffect(() => {
    if (!uid) return;
    let ativo = true;
    async function atualizarNaoLidas() {
      const [{ data: perfil }, { data: galerias }] = await Promise.all([
        supabase.from("perfis").select("notif_visto_em").eq("id", uid).maybeSingle(),
        supabase.from("galerias").select("id").eq("user_id", uid),
      ]);
      if (!ativo) return;
      const ids = (galerias ?? []).map((g) => g.id as string);
      if (!ids.length) { setSelecoesNaoLidas(0); return; }
      const { data: selecoes } = await supabase.from("selecoes").select("atualizado_em").in("galeria", ids).eq("finalizada", true);
      if (!ativo) return;
      const visto = (perfil?.notif_visto_em as string | null) ?? null;
      setSelecoesNaoLidas((selecoes ?? []).filter((s) => !visto || Boolean(s.atualizado_em && (s.atualizado_em as string) > visto)).length);
    }
    void atualizarNaoLidas();
    const intervalo = window.setInterval(() => void atualizarNaoLidas(), 60_000);
    const aoVisivel = () => { if (document.visibilityState === "visible") void atualizarNaoLidas(); };
    document.addEventListener("visibilitychange", aoVisivel);
    return () => { ativo = false; window.clearInterval(intervalo); document.removeEventListener("visibilitychange", aoVisivel); };
  }, [supabase, uid, pathname]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const atualizar = () => setMobile(media.matches);
    atualizar();
    media.addEventListener("change", atualizar);
    return () => media.removeEventListener("change", atualizar);
  }, []);

  useEffect(() => setDrawer(false), [pathname]);

  useEffect(() => {
    if (!drawer || !mobile) return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const sidebar = sidebarRef.current;
    const primeiro = sidebar?.querySelector<HTMLElement>('[aria-current="page"]') ?? sidebar?.querySelector<HTMLElement>(FOCUSABLE);
    requestAnimationFrame(() => (primeiro ?? sidebar)?.focus());

    function teclado(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault(); setDrawer(false); requestAnimationFrame(() => menuButtonRef.current?.focus()); return;
      }
      if (event.key !== "Tab" || !sidebar) return;
      const focaveis = Array.from(sidebar.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((elemento) => !elemento.hasAttribute("disabled"));
      if (!focaveis.length) return;
      const primeiroFoco = focaveis[0], ultimoFoco = focaveis[focaveis.length - 1];
      if (event.shiftKey && document.activeElement === primeiroFoco) { event.preventDefault(); ultimoFoco.focus(); }
      else if (!event.shiftKey && document.activeElement === ultimoFoco) { event.preventDefault(); primeiroFoco.focus(); }
    }
    window.addEventListener("keydown", teclado);
    return () => { window.removeEventListener("keydown", teclado); document.body.style.overflow = overflowAnterior; };
  }, [drawer, mobile]);

  async function sair() { await supabase.auth.signOut(); router.replace("/login"); }

  const itens: { rota: string; label: string; tipo: T; exato?: boolean }[] = [
    { rota: "/dashboard", label: "Painel", tipo: "painel", exato: true },
    { rota: "/dashboard/galerias", label: "Galerias", tipo: "galerias" },
    { rota: "/dashboard/selecoes", label: "Seleções", tipo: "selecoes" },
    { rota: "/dashboard/clientes", label: "Clientes", tipo: "clientes" },
    { rota: "/dashboard/assinatura", label: "Plano", tipo: "assinatura", exato: true },
    { rota: "/configuracoes", label: "Configurações", tipo: "config", exato: true },
  ];

  async function navegar(item: { rota: string; tipo: T }) {
    if (item.tipo === "selecoes" && uid && selecoesNaoLidas > 0) {
      const anterior = selecoesNaoLidas;
      setSelecoesNaoLidas(0);
      const { error } = await supabase.from("perfis").upsert({ id: uid, notif_visto_em: new Date().toISOString() });
      if (error) setSelecoesNaoLidas(anterior);
    }
    router.push(item.rota);
  }

  const inicial = (nome || email || "F")[0].toUpperCase();
  const menuOculto = mobile && !drawer;
  const perfilAtivo = pathname === "/perfil";

  return <>
    <style>{`.mf-mobile-btn{display:none;position:fixed;left:14px;top:14px;z-index:62;width:44px;height:44px;border-radius:11px;border:1px solid #2a2d40;background:#111126;color:#f0f0f5;align-items:center;justify-content:center}.mf-mobile-btn svg,.mf-ic svg{width:20px;height:20px}.mf-backdrop{display:none}.mf-side{position:fixed;inset:0 auto 0 0;width:236px;z-index:60;display:flex;flex-direction:column;padding:22px 16px;box-sizing:border-box;background:linear-gradient(180deg,#0c0c1e,#0a0a15);border-right:1px solid #1b1d31}.mf-brand{display:flex;align-items:center;gap:10px;background:none;border:0;cursor:pointer;padding:4px 8px 18px}.mf-brand-tx{font-size:18px;font-weight:700;letter-spacing:3px;color:#f0f0f5}.mf-brand-ic{width:30px;height:26px}.mf-nav{display:flex;flex-direction:column;gap:4px}.mf-item,.mf-sair{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:44px;padding:11px 12px;border-radius:11px;background:none;border:1px solid transparent;color:#9298b2;font:500 14px inherit;cursor:pointer}.mf-item:hover{background:#14142a;color:#fff}.mf-item.ativo{color:#fff;background:linear-gradient(90deg,rgba(17,150,252,.16),rgba(93,13,250,.09));border-color:rgba(74,108,247,.35)}.mf-ic{width:20px;height:20px;display:flex}.mf-badge{margin-left:auto;min-width:18px;height:18px;padding:0 5px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:#ff6b75;color:#fff;font-size:9px;font-weight:750;line-height:1;box-shadow:0 0 0 3px rgba(255,107,117,.08)}.mf-bottom{margin-top:auto;display:flex;flex-direction:column;gap:8px}.mf-user{display:flex;align-items:center;gap:10px;padding:10px;width:100%;box-sizing:border-box;border:1px solid #202238;border-radius:12px;min-width:0;background:transparent;color:#f0f0f5;text-align:left;cursor:pointer;transition:border-color .16s,background .16s}.mf-user:hover,.mf-user.ativo{border-color:rgba(74,108,247,.45);background:rgba(74,108,247,.08)}.mf-avatar{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1196fc,#5d0dfa);font-weight:700;overflow:hidden;flex:none}.mf-avatar img{width:100%;height:100%;object-fit:contain;background:#111124}.mf-user-info{min-width:0}.mf-user-name,.mf-user-email{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mf-user-name{font-size:12px}.mf-user-email{font-size:10px;color:#646a86}.mf-sair{color:#b98a8a}.mf-shift{padding-left:236px}.mf-item:focus-visible,.mf-sair:focus-visible,.mf-brand:focus-visible,.mf-mobile-btn:focus-visible,.mf-user:focus-visible{outline:2px solid #7ea2ff;outline-offset:2px}@media(min-width:641px) and (max-width:980px){.mf-side{width:72px;padding:18px 10px}.mf-brand{justify-content:center}.mf-brand-tx,.mf-tx,.mf-user-info{display:none}.mf-item,.mf-sair{justify-content:center;padding:12px 0}.mf-item .mf-badge{position:absolute;right:3px;top:4px;min-width:15px;height:15px;padding:0 4px;font-size:8px}.mf-user{justify-content:center;padding:8px 0}.mf-shift{padding-left:72px}}@media(max-width:640px){.mf-mobile-btn{display:flex}.mf-side{width:min(286px,84vw);transform:translateX(-105%);transition:transform .2s}.mf-side.aberta{transform:none}.mf-backdrop{display:block;position:fixed;inset:0;z-index:55;background:rgba(3,3,12,.68);opacity:0;pointer-events:none;transition:opacity .2s}.mf-backdrop.aberta{opacity:1;pointer-events:auto}.mf-shift{padding-left:0}}`}</style>
    <button ref={menuButtonRef} className="mf-mobile-btn" onClick={() => setDrawer((valor) => !valor)} aria-label={drawer ? "Fechar menu" : "Abrir menu"} aria-expanded={drawer} aria-controls="mf-sidebar"><Icone tipo={drawer ? "fechar" : "menu"}/></button>
    <div className={"mf-backdrop" + (drawer ? " aberta" : "")} onClick={() => { setDrawer(false); requestAnimationFrame(() => menuButtonRef.current?.focus()); }} aria-hidden="true"/>
    <aside ref={sidebarRef} id="mf-sidebar" tabIndex={-1} className={"mf-side" + (drawer ? " aberta" : "")} aria-label="Navegação do fotógrafo" aria-hidden={menuOculto || undefined} inert={menuOculto || undefined}>
      <button className="mf-brand" onClick={() => router.push("/dashboard")} aria-label="Ir para o painel"><svg aria-hidden="true" className="mf-brand-ic" viewBox="0 0 115 101"><defs><linearGradient id="g"><stop stopColor="#1196fc"/><stop offset="1" stopColor="#5d0dfa"/></linearGradient></defs><path fill="url(#g)" d="M65 6 8 55c-8 10 5 18 19 12l35-32c3-3 7-4 11-4h17c10-1 19-13 19-19 0-4-3-6-7-6H65Zm6 40L29 83c-7 11 5 15 17 11l39-34c8-8 3-15-4-14H71Z"/></svg><span className="mf-brand-tx">FOTURA</span></button>
      <nav className="mf-nav">{itens.map((item) => { const ativo = item.exato ? pathname === item.rota : pathname === item.rota || pathname.startsWith(item.rota + "/"); const badge=item.tipo==="selecoes"?selecoesNaoLidas:0; return <button key={item.rota} className={"mf-item" + (ativo ? " ativo" : "")} onClick={() => void navegar(item)} aria-current={ativo ? "page" : undefined} aria-label={badge?`${item.label}, ${badge} nova${badge===1?"":"s"}`:item.label} title={item.label}><span className="mf-ic"><Icone tipo={item.tipo}/></span><span className="mf-tx">{item.label}</span>{badge>0&&<span className="mf-badge" aria-hidden="true">{badge>9?"9+":badge}</span>}</button>; })}</nav>
      <div className="mf-bottom"><button className={"mf-user"+(perfilAtivo?" ativo":"")} title="Abrir perfil" onClick={()=>router.push("/perfil")} aria-current={perfilAtivo?"page":undefined}><div className="mf-avatar" aria-hidden="true">{logo?<img src={logo} alt=""/>:inicial}</div><div className="mf-user-info"><div className="mf-user-name">{nome || "Fotógrafo"}</div><div className="mf-user-email">{email}</div></div></button><button className="mf-sair" onClick={sair} aria-label="Sair"><span className="mf-ic"><Icone tipo="sair"/></span><span className="mf-tx">Sair</span></button></div>
    </aside>
  </>;
}
