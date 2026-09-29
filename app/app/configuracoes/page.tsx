"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-client";
import { desinscreverPush, definirPreferenciaPush, inscreverPush, notificacoesPushAtivadas } from "../../lib/push-client";
import MenuFotografo from "../MenuFotografo";

type Permissao = "granted" | "denied" | "default" | "unsupported";

function GoogleLogo(){return <svg className="google-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.04H12v3.86h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.35Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.42l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.9A6 6 0 0 1 6.08 12c0-.66.11-1.3.31-1.9V7.51H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.49l3.35-2.59Z"/><path fill="#EA4335" d="M12 5.97c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.51l3.35 2.59C7.18 7.73 9.39 5.97 12 5.97Z"/></svg>}

export default function ConfiguracoesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [carregando, setCarregando] = useState(true);
  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [avatarConta,setAvatarConta]=useState<string|null>(null);
  const [permissao, setPermissao] = useState<Permissao>("default");
  const [pushAtivo,setPushAtivo]=useState(false);
  const [alterandoPush, setAlterandoPush] = useState(false);
  const [googleConectado,setGoogleConectado]=useState(false);
  const [googleEmail,setGoogleEmail]=useState<string|null>(null);
  const [alterandoGoogle,setAlterandoGoogle]=useState(false);
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
      const metadataAvatar=(data.user.user_metadata?.avatar_url||data.user.user_metadata?.picture) as string|undefined;
      setAvatarConta(metadataAvatar||null);
      const p=typeof Notification === "undefined" ? "unsupported" : Notification.permission;
      setPermissao(p);
      setPushAtivo(p==="granted"&&notificacoesPushAtivadas());
      const {data:{session}}=await supabase.auth.getSession();
      if(session?.access_token){try{const r=await fetch("/api/google/integration",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});if(r.ok){const g=await r.json() as {conectado?:boolean;email?:string|null;avatar?:string|null};if(ativo){setGoogleConectado(Boolean(g.conectado));setGoogleEmail(g.email??null);if(g.avatar)setAvatarConta(g.avatar)}}}catch{}}
      const param=new URLSearchParams(window.location.search).get("google");
      if(param==="conectado"){setErro(false);setMensagem("Google Contacts conectado. As fotos disponíveis nos seus contatos poderão aparecer nos cards de clientes.");}
      else if(param==="erro"){setErro(true);setMensagem("Não foi possível concluir a conexão com o Google.");}
      else if(param==="config"){setErro(true);setMensagem("A integração Google ainda precisa das credenciais OAuth do projeto.");}
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [router, supabase]);

  async function alternarNotificacoes() {
    if (!uid || alterandoPush || permissao==="unsupported") return;
    setAlterandoPush(true);setMensagem("");setErro(false);
    if(pushAtivo){const ok=await desinscreverPush(uid);setAlterandoPush(false);if(ok){setPushAtivo(false);setMensagem("Notificações desativadas neste navegador.");}else{setErro(true);setMensagem("Não foi possível desativar as notificações neste navegador.");}return;}
    definirPreferenciaPush(true);
    const ok=await inscreverPush(uid);
    const atual=typeof Notification === "undefined" ? "unsupported" : Notification.permission;
    setPermissao(atual);setAlterandoPush(false);
    if(ok){setPushAtivo(true);setMensagem("Notificações ativadas neste navegador.");}
    else{definirPreferenciaPush(false);setPushAtivo(false);setErro(true);setMensagem(atual === "denied" ? "As notificações estão bloqueadas nas permissões do navegador." : "Não foi possível ativar as notificações neste navegador.");}
  }

  async function conectarGoogle(){
    if(alterandoGoogle)return;setAlterandoGoogle(true);setMensagem("");setErro(false);
    const {data:{session}}=await supabase.auth.getSession();
    if(!session?.access_token){setAlterandoGoogle(false);setErro(true);setMensagem("Sua sessão expirou. Entre novamente para conectar o Google.");return}
    const r=await fetch("/api/google/connect",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`}});
    const d=await r.json().catch(()=>({error:"Não foi possível iniciar a conexão."}));
    if(!r.ok||!d.url){setAlterandoGoogle(false);setErro(true);setMensagem(d.error||"Não foi possível iniciar a conexão com o Google.");return}
    window.location.href=d.url as string;
  }

  async function desconectarGoogle(){
    if(alterandoGoogle)return;setAlterandoGoogle(true);setMensagem("");setErro(false);
    const {data:{session}}=await supabase.auth.getSession();
    if(!session?.access_token){setAlterandoGoogle(false);setErro(true);setMensagem("Sua sessão expirou.");return}
    const r=await fetch("/api/google/integration",{method:"DELETE",headers:{Authorization:`Bearer ${session.access_token}`}});
    setAlterandoGoogle(false);
    if(!r.ok){setErro(true);setMensagem("Não foi possível desconectar o Google.");return}
    setGoogleConectado(false);setGoogleEmail(null);setMensagem("Google Contacts desconectado.");
  }

  async function encerrarOutrasSessoes() {
    if (encerrando) return;
    setEncerrando(true); setMensagem(""); setErro(false);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setEncerrando(false);
    if (error) { setErro(true); setMensagem("Não foi possível encerrar as outras sessões."); return; }
    setMensagem("Outras sessões da sua conta foram encerradas.");
  }

  const statusPush = permissao === "unsupported" ? "Não suportadas neste navegador" : permissao === "denied" ? "Bloqueadas pelo navegador" : pushAtivo ? "Ativas neste navegador" : "Desativadas neste navegador";

  if (carregando) return <div className="cfg-loading">Carregando configurações…<style>{`.cfg-loading{min-height:100vh;display:grid;place-items:center;background:linear-gradient(180deg,#F0EDF7,#ECE8F4);color:#7a7f9a}`}</style></div>;

  return <main className="cfg mf-shift">
    <MenuFotografo/>
    <style>{`
      .cfg{min-height:100vh;background:linear-gradient(180deg,#F0EDF7 0%,#ECE8F4 100%);color:#21253A;box-sizing:border-box}
      .cfg-body{max-width:1120px;margin:0 auto;padding:46px 5vw 80px}
      .cfg-head{margin-bottom:22px}.ey{font-size:10px;font-weight:800;letter-spacing:1.8px;color:#6B5BAE}.h1{font-size:29px;letter-spacing:-.6px;margin:6px 0 5px}.sub{font-size:12.5px;color:#73758D;line-height:1.55;margin:0;max-width:680px}
      .section-label{font-size:9px;font-weight:800;letter-spacing:1.35px;text-transform:uppercase;color:#777D93;margin:0 0 9px 2px}
      .account-card,.setting-card{background:rgba(250,248,253,.95);border:1px solid #DCD6EE;box-shadow:0 8px 24px rgba(65,52,111,.045)}
      .account-card{border-radius:16px;padding:17px 18px;margin-bottom:21px;display:flex;align-items:center;justify-content:space-between;gap:18px}
      .account-main{display:flex;align-items:center;gap:13px;min-width:0}.avatar{width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#1196FC,#5D0DFA);display:grid;place-items:center;font-size:13px;font-weight:800;color:#fff;overflow:hidden;flex:none}.avatar img{width:100%;height:100%;display:block;object-fit:cover}
      .account-copy{min-width:0}.account-title{font-size:13.5px;font-weight:800;color:#292E45}.account-email{font-size:10.5px;color:#777D93;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.account-note{font-size:9.5px;color:#8A8FA3;margin-top:5px}
      .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:20px}
      .setting-card{border-radius:15px;padding:16px;display:flex;flex-direction:column;min-height:178px}
      .setting-top{display:flex;align-items:flex-start;gap:11px}.icon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#EEE8FA;border:1px solid #DAD2E9;color:#655C90;flex:none}.icon svg{width:17px;height:17px}.icon .google-logo{width:19px;height:19px}
      .setting-copy{min-width:0}.title{font-size:13px;font-weight:800;margin:1px 0 0;color:#2A2F46}.desc{font-size:10.5px;color:#777D93;line-height:1.5;margin:4px 0 0}
      .setting-bottom{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:auto;padding-top:14px;border-top:1px solid #E7E2EE}.setting-info{min-width:0}.label{font-size:10px;font-weight:750;color:#555D75}.value{font-size:9.5px;color:#85899B;margin-top:3px;line-height:1.45}
      .status-pill{display:inline-flex;align-items:center;gap:5px;margin-top:5px;padding:4px 7px;border-radius:999px;background:#F2EEF7;border:1px solid #E0DAEB;color:#6A7085;font-size:8.5px;font-weight:750}.status-dot{width:6px;height:6px;border-radius:50%;background:#8D93A6}.status-pill.on{background:#E9F5EF;border-color:#CBE4D6;color:#3F7C5B}.status-pill.on .status-dot{background:#4F9A71}.status-pill.warn{background:#FAF2E5;border-color:#E8D7B8;color:#94703C}.status-pill.warn .status-dot{background:#C89245}
      .btn{height:34px;border:1px solid #D7D0E7;border-radius:9px;padding:0 11px;background:#FAF8FD;color:#596079;font-family:inherit;font-size:10.5px;font-weight:750;cursor:pointer;white-space:nowrap}.btn:hover:not(:disabled){background:#F0EBF7;border-color:#C8BEE0}.btn.primary{border:0;color:#fff;background:linear-gradient(90deg,#1196FC,#5D0DFA)}.btn.danger{color:#B95C66;border-color:#E7C7CC;background:#FAF0F2}.btn:disabled{opacity:.5;cursor:default}
      .wide-card{grid-column:1/-1;min-height:0}.links{display:flex;gap:7px;flex-wrap:wrap;margin-top:14px}
      .notice{margin-top:4px;padding:10px 12px;border-radius:10px;font-size:10.5px;color:#3F7C5B;background:#EAF5EF;border:1px solid #CBE4D6}.notice.err{color:#A6535E;background:#FAF0F2;border-color:#E7C7CC}
      @media(max-width:900px){.cfg-body{padding:46px 32px 70px}.grid{grid-template-columns:1fr}.wide-card{grid-column:auto}}
      @media(max-width:640px){.cfg-body{padding:76px 16px 60px}.h1{font-size:25px}.account-card{align-items:flex-start;flex-direction:column}.setting-bottom{align-items:flex-start;flex-direction:column}.btn{width:100%}.links{width:100%}.links .btn{width:auto}}
    `}</style>

    <div className="cfg-body">
      <header className="cfg-head">
        <div className="ey">CONFIGURAÇÕES</div>
        <h1 className="h1">Conta e preferências</h1>
        <p className="sub">Gerencie sua conta, notificações, integrações e segurança em um só lugar.</p>
      </header>

      <div className="section-label">Conta</div>
      <section className="account-card">
        <div className="account-main">
          <div className="avatar" aria-hidden="true">{avatarConta?<img src={avatarConta} alt=""/>:(email||"F")[0].toUpperCase()}</div>
          <div className="account-copy">
            <div className="account-title">Sua conta Fotura</div>
            <div className="account-email">{email||"E-mail não informado"}</div>
            <div className="account-note">Nome, logo e identidade visual do estúdio são gerenciados no perfil.</div>
          </div>
        </div>
        <button className="btn" onClick={()=>router.push("/perfil")}>Abrir perfil</button>
      </section>

      <div className="section-label">Preferências e integrações</div>
      <div className="grid">
        <section className="setting-card">
          <div className="setting-top">
            <div className="icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 9a6 6 0 0 1 12 0v4l2 3H4l2-3V9Z"/><path d="M10 19h4"/></svg></div>
            <div className="setting-copy"><h2 className="title">Notificações</h2><p className="desc">Receba avisos de seleções finalizadas e eventos importantes no navegador.</p></div>
          </div>
          <div className="setting-bottom">
            <div className="setting-info">
              <div className="label">Notificações push</div>
              <div className={"status-pill"+(pushAtivo?" on":permissao==="denied"?" warn":"")}><span className="status-dot"/>{statusPush}</div>
            </div>
            <button className={"btn"+(!pushAtivo?" primary":"")} disabled={alterandoPush||permissao==="unsupported"} onClick={()=>void alternarNotificacoes()}>{alterandoPush?"Salvando…":pushAtivo?"Desativar":"Ativar"}</button>
          </div>
        </section>

        <section className="setting-card">
          <div className="setting-top">
            <div className="icon" aria-hidden="true"><GoogleLogo/></div>
            <div className="setting-copy"><h2 className="title">Google Contacts</h2><p className="desc">Use fotos dos seus contatos Google nos cards de clientes quando o e-mail corresponder.</p></div>
          </div>
          <div className="setting-bottom">
            <div className="setting-info">
              <div className="label">Conta Google</div>
              <div className={"status-pill"+(googleConectado?" on":"")}><span className="status-dot"/>{googleConectado?(googleEmail?googleEmail:"Conectada"):"Não conectada"}</div>
            </div>
            <button className={"btn"+(!googleConectado?" primary":"")} disabled={alterandoGoogle} onClick={()=>void (googleConectado?desconectarGoogle():conectarGoogle())}>{alterandoGoogle?"Processando…":googleConectado?"Desconectar":"Conectar Google"}</button>
          </div>
        </section>
      </div>

      <div className="section-label">Segurança e conta</div>
      <div className="grid">
        <section className="setting-card">
          <div className="setting-top">
            <div className="icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/></svg></div>
            <div className="setting-copy"><h2 className="title">Segurança e sessões</h2><p className="desc">Encerre acessos ativos em outros navegadores e dispositivos sem sair deste.</p></div>
          </div>
          <div className="setting-bottom">
            <div className="setting-info"><div className="label">Outras sessões</div><div className="value">Mantém apenas este dispositivo conectado.</div></div>
            <button className="btn danger" disabled={encerrando} onClick={()=>void encerrarOutrasSessoes()}>{encerrando?"Encerrando…":"Encerrar outras"}</button>
          </div>
        </section>

        <section className="setting-card">
          <div className="setting-top">
            <div className="icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 18V9M10 18V5M16 18v-7M22 18V3"/></svg></div>
            <div className="setting-copy"><h2 className="title">Atividade da conta</h2><p className="desc">Consulte ações e eventos importantes relacionados à conta, galerias, clientes e seleções.</p></div>
          </div>
          <div className="setting-bottom">
            <div className="setting-info"><div className="label">Histórico de atividades</div><div className="value">Acompanhe alterações e eventos relevantes.</div></div>
            <button className="btn" onClick={()=>router.push("/dashboard/atividade")}>Ver histórico</button>
          </div>
        </section>

        <section className="setting-card wide-card">
          <div className="setting-top">
            <div className="icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/></svg></div>
            <div className="setting-copy"><h2 className="title">Privacidade e documentos</h2><p className="desc">Consulte os documentos que regem o uso do Fotura e o tratamento dos dados da plataforma.</p></div>
          </div>
          <div className="links">
            <button className="btn" onClick={()=>router.push("/termos")}>Termos de Uso</button>
            <button className="btn" onClick={()=>router.push("/privacidade")}>Política de Privacidade</button>
          </div>
        </section>
      </div>

      {mensagem&&<div role={erro?"alert":"status"} className={"notice"+(erro?" err":"")}>{mensagem}</div>}
    </div>
  </main>;
}
