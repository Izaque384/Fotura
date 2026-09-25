"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../lib/supabase-client";

type T = "painel" | "galerias" | "storage" | "selecoes" | "vendas" | "clientes" | "assinatura" | "config" | "admin" | "sair" | "menu" | "fechar";

function Icone({ tipo }: { tipo: T }) {
  const common = { "aria-hidden": true as const };
  if (tipo === "painel") return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/></svg>;
  if (tipo === "galerias") return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 15 3-3 3 3 2-2 4 3"/></svg>;
  if (tipo === "storage") return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7c0-2 3.6-3.6 8-3.6S20 5 20 7s-3.6 3.6-8 3.6S4 9 4 7Z"/><path d="M4 7v5c0 2 3.6 3.6 8 3.6S20 14 20 12V7M4 12v5c0 2 3.6 3.6 8 3.6s8-1.6 8-3.6v-5"/></svg>;
  if (tipo === "selecoes") return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 6h12M8 12h12M8 18h12M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"/></svg>;
  if (tipo === "vendas") return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M8 12h8M12 9v6"/></svg>;
  if (tipo === "clientes") return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-3.5 2.3-5.3 5.5-5.3s5 1.8 5.5 5.3M16 8.5a2.5 2.5 0 1 1 0 5M17 14.5c2.2.4 3.3 1.8 3.5 4.5"/></svg>;
  if (tipo === "assinatura") return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 14h4"/></svg>;
  if (tipo === "config") return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M4 17h16"/><circle cx="10" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></svg>;
  if (tipo === "admin") return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3 20 6v5c0 5-3.2 8.3-8 10-4.8-1.7-8-5-8-10V6l8-3Z"/><path d="M9 12h6M12 9v6"/></svg>;
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
  const [admin, setAdmin] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [mobile, setMobile] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let ativo = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { data } = await supabase.auth.getUser();
          if (!data.user || !ativo) return;
          const e = data.user.email ?? "";
          setUid(data.user.id);
          setEmail(e);
          const { data: perfil } = await supabase.from("perfis").select("nome_estudio,logo_url").eq("id", data.user.id).maybeSingle();
          if (!ativo) return;
          setNome((perfil?.nome_estudio as string | null)?.trim() || e.split("@")[0] || "Fotógrafo");
          setLogo((perfil?.logo_url as string | null) || null);
        } catch {}
      })();
    }, 300);
    return () => { ativo = false; window.clearTimeout(timer); };
  }, [supabase]);

  useEffect(() => {
    if (!uid) { setAdmin(false); return; }
    let ativo = true;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const resposta = await fetch("/api/admin/acesso", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const body = await resposta.json().catch(() => null) as { admin?: boolean } | null;
        if (ativo) setAdmin(resposta.ok && body?.admin === true);
      } catch {
        if (ativo) setAdmin(false);
      }
    })();
    return () => { ativo = false; };
  }, [supabase, uid]);

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
  }, [supabase, uid]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const atualizar = () => setMobile(media.matches);
    atualizar();
    media.addEventListener("change", atualizar);
    return () => media.removeEventListener("change", atualizar);
  }, []);

  useEffect(() => setDrawer(false), [pathname]);

  useEffect(() => {
    ["/dashboard", "/dashboard/galerias", "/dashboard/armazenamento", "/dashboard/selecoes", "/dashboard/vendas", "/dashboard/clientes", "/dashboard/assinatura", "/configuracoes", "/perfil", "/upload"].forEach((rota) => router.prefetch(rota));
  }, [router]);

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
    { rota: "/dashboard/armazenamento", label: "Armazenamento", tipo: "storage" },
    { rota: "/dashboard/selecoes", label: "Seleções", tipo: "selecoes" },
    { rota: "/dashboard/vendas", label: "Vendas", tipo: "vendas" },
    { rota: "/dashboard/clientes", label: "Clientes", tipo: "clientes" },
    { rota: "/dashboard/assinatura", label: "Plano", tipo: "assinatura", exato: true },
    { rota: "/configuracoes", label: "Configurações", tipo: "config", exato: true },
  ];

  function navegar(item: { rota: string; tipo: T }) {
    if (item.tipo === "selecoes" && uid && selecoesNaoLidas > 0) {
      const anterior = selecoesNaoLidas;
      setSelecoesNaoLidas(0);
      void supabase.from("perfis").upsert({ id: uid, notif_visto_em: new Date().toISOString() }).then(({ error }) => {
        if (error) setSelecoesNaoLidas(anterior);
      });
    }
    router.push(item.rota);
  }

  const inicial = (nome || email || "F")[0].toUpperCase();
  const saudacao = ((nome || email.split("@")[0] || "Fotógrafo").trim().split(/\\s+/)[0]) || "Fotógrafo";
  const menuOculto = mobile && !drawer;
  const perfilAtivo = pathname === "/perfil";

  return <>
    <style>{`.mf-mobile-btn{display:none;position:fixed;left:14px;top:14px;z-index:62;width:44px;height:44px;border-radius:11px;border:1px solid #D7D0E7;background:#ECE8F4;color:#21253A;align-items:center;justify-content:center}.mf-mobile-btn svg,.mf-ic svg{width:20px;height:20px}.mf-backdrop{display:none}.mf-side{position:fixed;inset:0 auto 0 0;width:236px;z-index:60;display:flex;flex-direction:column;padding:22px 16px;box-sizing:border-box;background:linear-gradient(180deg,#ECE8F4,#F0EDF7);border-right:1px solid #DDD7E8}.mf-brand{display:flex;align-items:center;gap:10px;background:none;border:0;cursor:pointer;padding:4px 8px 18px}.mf-brand-tx{font-size:18px;font-weight:700;letter-spacing:3px;color:#21253A}.mf-brand-ic{width:30px;height:26px}.mf-nav{display:flex;flex-direction:column;gap:4px}.mf-item,.mf-sair{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:44px;padding:11px 12px;border-radius:11px;background:none;border:1px solid transparent;color:#73758D;font:500 14px inherit;cursor:pointer}.mf-item:hover{background:#FAF8FD;color:#21253A}.mf-item.ativo{color:#4E556D;background:linear-gradient(90deg,rgba(17,150,252,.16),rgba(93,13,250,.09));border-color:rgba(74,108,247,.35)}.mf-admin{color:#9da7cc;border-color:rgba(74,108,247,.16)}.mf-admin:hover{border-color:rgba(74,108,247,.38)}.mf-ic{width:20px;height:20px;display:flex}.mf-badge{margin-left:auto;min-width:18px;height:18px;padding:0 5px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:#ff6b75;color:#fff;font-size:9px;font-weight:750;line-height:1;box-shadow:0 0 0 3px rgba(255,107,117,.08)}.mf-bottom{margin-top:auto;display:flex;flex-direction:column;gap:8px}.mf-top-user{position:absolute;top:17px;right:max(24px,calc((100vw - 1356px)/2 + 40px));z-index:54;display:flex;align-items:center;gap:10px;min-height:44px;padding:4px 7px;border:0;border-radius:14px;background:transparent;color:#21253A;text-align:left;cursor:pointer;transition:background .16s,transform .16s}.mf-top-user:hover{background:rgba(65,52,111,.05)}.mf-top-user:active{transform:translateY(1px)}.mf-top-avatar{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1196fc,#5d0dfa);color:#fff;font-size:13px;font-weight:750;overflow:hidden;flex:none;box-shadow:0 0 0 1px rgba(255,255,255,.08)}.mf-top-avatar img{width:100%;height:100%;object-fit:cover;background:#FAF8FD}.mf-top-user-info{min-width:0;max-width:150px}.mf-top-greeting,.mf-top-role{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mf-top-greeting{font-size:11px;font-weight:700;line-height:1.25}.mf-top-role{font-size:9px;color:#777e99;margin-top:2px}.mf-sair{color:#b98a8a}.mf-shift{padding-left:236px}.mf-item:focus-visible,.mf-sair:focus-visible,.mf-brand:focus-visible,.mf-mobile-btn:focus-visible,.mf-top-user:focus-visible{outline:2px solid #7ea2ff;outline-offset:2px}@media(min-width:641px) and (max-width:980px){.mf-side{width:72px;padding:18px 10px}.mf-brand{justify-content:center}.mf-brand-tx,.mf-tx{display:none}.mf-item,.mf-sair{justify-content:center;padding:12px 0}.mf-item .mf-badge{position:absolute;right:3px;top:4px;min-width:15px;height:15px;padding:0 4px;font-size:8px}.mf-top-user{right:20px}.mf-shift{padding-left:72px}}@media(max-width:640px){.mf-mobile-btn{display:flex}.mf-side{width:min(286px,84vw);transform:translateX(-105%);transition:transform .2s}.mf-side.aberta{transform:none}.mf-backdrop{display:block;position:fixed;inset:0;z-index:55;background:rgba(3,3,12,.68);opacity:0;pointer-events:none;transition:opacity .2s}.mf-backdrop.aberta{opacity:1;pointer-events:auto}.mf-top-user{top:12px;right:12px;padding:3px}.mf-top-user-info{display:none}.mf-top-avatar{width:40px;height:40px}.mf-shift{padding-left:0}}`}</style>
    <button ref={menuButtonRef} className="mf-mobile-btn" onClick={() => setDrawer((valor) => !valor)} aria-label={drawer ? "Fechar menu" : "Abrir menu"} aria-expanded={drawer} aria-controls="mf-sidebar"><Icone tipo={drawer ? "fechar" : "menu"}/></button>
    <div className={"mf-backdrop" + (drawer ? " aberta" : "")} onClick={() => { setDrawer(false); requestAnimationFrame(() => menuButtonRef.current?.focus()); }} aria-hidden="true"/>
    <aside ref={sidebarRef} id="mf-sidebar" tabIndex={-1} className={"mf-side" + (drawer ? " aberta" : "")} aria-label="Navegação do fotógrafo" aria-hidden={menuOculto || undefined} inert={menuOculto || undefined}>
      <button className="mf-brand" onClick={() => router.push("/dashboard")} aria-label="Ir para o painel"><svg aria-hidden="true" className="mf-brand-ic" viewBox="0 0 115 101"><defs><linearGradient id="g"><stop stopColor="#1196fc"/><stop offset="1" stopColor="#5d0dfa"/></linearGradient></defs><path fill="url(#g)" d="M65 6 8 55c-8 10 5 18 19 12l35-32c3-3 7-4 11-4h17c10-1 19-13 19-19 0-4-3-6-7-6H65Zm6 40L29 83c-7 11 5 15 17 11l39-34c8-8 3-15-4-14H71Z"/></svg><span className="mf-brand-tx">FOTURA</span></button>
      <nav className="mf-nav">{itens.map((item) => { const ativo = item.exato ? pathname === item.rota : pathname === item.rota || pathname.startsWith(item.rota + "/"); const badge=item.tipo==="selecoes"?selecoesNaoLidas:0; return <button key={item.rota} className={"mf-item" + (ativo ? " ativo" : "")} onClick={() => void navegar(item)} aria-current={ativo ? "page" : undefined} aria-label={badge?`${item.label}, ${badge} nova${badge===1?"":"s"}`:item.label} title={item.label}><span className="mf-ic"><Icone tipo={item.tipo}/></span><span className="mf-tx">{item.label}</span>{badge>0&&<span className="mf-badge" aria-hidden="true">{badge>9?"9+":badge}</span>}</button>; })}</nav>
      <div className="mf-bottom">{admin&&<button className="mf-item mf-admin" title="Administração" onClick={()=>router.push("/admin")}><span className="mf-ic"><Icone tipo="admin"/></span><span className="mf-tx">Administração</span></button>}<button className="mf-sair" onClick={sair} aria-label="Sair"><span className="mf-ic"><Icone tipo="sair"/></span><span className="mf-tx">Sair</span></button></div>
    </aside>
    <button className={"mf-top-user"+(perfilAtivo?" ativo":"")} title="Abrir perfil" onClick={()=>router.push("/perfil")} aria-current={perfilAtivo?"page":undefined}><div className="mf-top-avatar" aria-hidden="true">{logo?<img src={logo} alt=""/>:inicial}</div><div className="mf-top-user-info"><div className="mf-top-greeting">Olá, {saudacao}</div><div className="mf-top-role">Fotógrafo</div></div></button>
  </>;
}
