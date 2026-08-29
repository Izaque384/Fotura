"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-client";
import { inscreverPush } from "../../lib/push-client";
import MenuFotografo from "../MenuFotografo";

type Permissao = "granted" | "denied" | "default" | "unsupported";

export default function ConfiguracoesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [carregando, setCarregando] = useState(true);
  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [permissao, setPermissao] = useState<Permissao>("default");
  const [ativandoPush, setAtivandoPush] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.replace("/login"); return; }
      if (!ativo) return;
      setUid(data.user.id);
      setEmail(data.user.email ?? "");
      setPermissao(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [router, supabase]);

  async function ativarNotificacoes() {
    if (!uid || ativandoPush) return;
    setAtivandoPush(true); setMensagem(""); setErro(false);
    const ok = await inscreverPush(uid);
    setAtivandoPush(false);
    const atual = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
    setPermissao(atual);
    if (ok) setMensagem("Notificações ativadas neste navegador.");
    else { setErro(true); setMensagem(atual === "denied" ? "As notificações estão bloqueadas nas permissões do navegador." : "Não foi possível ativar as notificações neste navegador."); }
  }

  async function encerrarOutrasSessoes() {
    if (encerrando) return;
    setEncerrando(true); setMensagem(""); setErro(false);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setEncerrando(false);
    if (error) { setErro(true); setMensagem("Não foi possível encerrar as outras sessões."); return; }
    setMensagem("Outras sessões da sua conta foram encerradas.");
  }

  const statusPush = permissao === "granted" ? "Ativas neste navegador" : permissao === "denied" ? "Bloqueadas pelo navegador" : permissao === "unsupported" ? "Não suportadas neste navegador" : "Ainda não ativadas";

  if (carregando) return <div className="cfg-loading">Carregando configurações…<style>{`.cfg-loading{min-height:100vh;display:grid;place-items:center;background:linear-gradient(180deg,#0b0b1a,#101024);color:#7a7f9a}`}</style></div>;

  return <main className="cfg mf-shift"><MenuFotografo/><style>{`
    .cfg{min-height:100vh;background:linear-gradient(180deg,#0b0b1a,#101024);color:#f0f0f5}.cfg-body{max-width:980px;margin:auto;padding:46px 40px 80px}.ey{font-size:11px;letter-spacing:2px;color:#6f76a0}.h1{font-size:30px;margin:7px 0}.sub{font-size:13px;color:#7a7f9a;line-height:1.6}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px}.card{background:linear-gradient(180deg,#14142b,#101023);border:1px solid #23233c;border-radius:16px;padding:20px}.card.wide{grid-column:1/-1}.card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.icon{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:rgba(74,108,247,.1);border:1px solid rgba(74,108,247,.22);color:#9fb0ff;flex:none}.icon svg{width:19px;height:19px}.title{font-size:15px;font-weight:650;margin:0}.desc{font-size:12px;color:#7a7f9a;line-height:1.55;margin:5px 0 0}.row{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:14px 0;border-top:1px solid #22243b;margin-top:15px}.label{font-size:12px;color:#cfd3e2}.value{font-size:11px;color:#757b97;margin-top:4px}.btn{border:1px solid #2a2d40;border-radius:10px;padding:9px 12px;background:#111124;color:#cfd5ea;font:600 12px inherit;cursor:pointer;white-space:nowrap}.btn.primary{border:0;color:#fff;background:linear-gradient(90deg,#1196fc,#5d0dfa)}.btn.danger{color:#ffb0b0;border-color:rgba(255,157,157,.22);background:rgba(255,157,157,.05)}.btn:disabled{opacity:.5;cursor:default}.account{display:flex;align-items:center;gap:12px;margin-top:17px;padding:13px;border:1px solid #24263d;border-radius:12px;background:#111124}.avatar{width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#1196fc,#5d0dfa);display:grid;place-items:center;font-weight:700}.notice{margin-top:16px;padding:11px 13px;border-radius:10px;font-size:12px;color:#8fe3b0;background:rgba(143,227,176,.06);border:1px solid rgba(143,227,176,.18)}.notice.err{color:#ff9d9d;background:rgba(255,157,157,.06);border-color:rgba(255,157,157,.18)}.links{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}@media(max-width:760px){.cfg-body{padding:76px 18px 60px}.grid{grid-template-columns:1fr}.card.wide{grid-column:auto}.row{align-items:flex-start;flex-direction:column}.h1{font-size:25px}}`}</style>
    <div className="cfg-body"><div className="ey">CONFIGURAÇÕES</div><h1 className="h1">Conta e preferências</h1><p className="sub">Segurança, notificações, sessões e informações operacionais da sua conta.</p>
      <div className="grid">
        <section className="card"><div className="card-head"><div><h2 className="title">Conta</h2><p className="desc">Informações usadas para autenticação no Fotura.</p></div><div className="icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3"/><path d="M5 20c.6-4.2 2.9-6.3 7-6.3s6.4 2.1 7 6.3"/></svg></div></div><div className="account"><div className="avatar" aria-hidden="true">{(email||"F")[0].toUpperCase()}</div><div><div className="label">E-mail da conta</div><div className="value">{email||"Não informado"}</div></div></div><div className="row"><div><div className="label">Identidade do estúdio</div><div className="value">Nome, logo e cor agora ficam separados das configurações da conta.</div></div><button className="btn" onClick={()=>router.push("/perfil")}>Abrir Perfil</button></div></section>
        <section className="card"><div className="card-head"><div><h2 className="title">Notificações</h2><p className="desc">Receba avisos de seleções finalizadas e eventos importantes.</p></div><div className="icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 9a6 6 0 0 1 12 0v4l2 3H4l2-3V9Z"/><path d="M10 19h4"/></svg></div></div><div className="row"><div><div className="label">Notificações push</div><div className="value">{statusPush}</div></div><button className="btn primary" disabled={ativandoPush||permissao==="granted"||permissao==="unsupported"} onClick={()=>void ativarNotificacoes()}>{ativandoPush?"Ativando…":permissao==="granted"?"Ativadas":"Ativar"}</button></div></section>
        <section className="card"><div className="card-head"><div><h2 className="title">Segurança e sessões</h2><p className="desc">Revise acessos e encerre sessões que não estejam neste dispositivo.</p></div><div className="icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/></svg></div></div><div className="row"><div><div className="label">Outras sessões</div><div className="value">Encerra acessos ativos em outros navegadores e dispositivos.</div></div><button className="btn danger" disabled={encerrando} onClick={()=>void encerrarOutrasSessoes()}>{encerrando?"Encerrando…":"Encerrar outras"}</button></div></section>
        <section className="card"><div className="card-head"><div><h2 className="title">Atividade</h2><p className="desc">Consulte ações importantes da conta, galerias, clientes e seleções.</p></div><div className="icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 18V9M10 18V5M16 18v-7M22 18V3"/></svg></div></div><div className="row"><div><div className="label">Histórico de atividades</div><div className="value">Ajuda a acompanhar alterações e eventos relevantes.</div></div><button className="btn" onClick={()=>router.push("/dashboard/atividade")}>Ver histórico</button></div></section>
        <section className="card wide"><div className="card-head"><div><h2 className="title">Privacidade e documentos</h2><p className="desc">Acesso rápido aos documentos que regem o uso do Fotura e o tratamento de dados.</p></div><div className="icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/></svg></div></div><div className="links"><button className="btn" onClick={()=>router.push("/termos")}>Termos de Uso</button><button className="btn" onClick={()=>router.push("/privacidade")}>Política de Privacidade</button></div></section>
      </div>{mensagem&&<div role={erro?"alert":"status"} className={"notice"+(erro?" err":"")}>{mensagem}</div>}
    </div></main>;
}
