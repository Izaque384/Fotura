"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useI18n } from "./components/I18nProvider";
import { withLocalePath } from "../lib/i18n";

const COPY={
  pt:{ey:"ERRO INESPERADO",title:"Algo não carregou como deveria.",text:"Você pode tentar novamente sem perder sua conta. Se o problema continuar, volte ao painel e tente a ação de novo.",retry:"Tentar novamente",dashboard:"Voltar ao painel"},
  en:{ey:"UNEXPECTED ERROR",title:"Something did not load as expected.",text:"You can try again without losing your account. If the issue persists, return to the dashboard and retry the action.",retry:"Try again",dashboard:"Back to dashboard"},
  es:{ey:"ERROR INESPERADO",title:"Algo no cargó como debería.",text:"Puedes intentarlo de nuevo sin perder tu cuenta. Si el problema continúa, vuelve al panel e intenta la acción nuevamente.",retry:"Intentar de nuevo",dashboard:"Volver al panel"},
} as const;

export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  const{locale}=useI18n(),copy=COPY[locale];
  useEffect(()=>{console.error("fotura_ui_error",error)},[error]);
  return <main className="launch-state">
    <section className="launch-state-card" role="alert">
      <div className="launch-state-logo">FOTURA</div>
      <div className="launch-state-ey">{copy.ey}</div>
      <h1>{copy.title}</h1>
      <p>{copy.text}</p>
      <div className="launch-state-actions">
        <button className="launch-primary" type="button" onClick={reset}>{copy.retry}</button>
        <Link className="launch-secondary" href={withLocalePath("/dashboard",locale)}>{copy.dashboard}</Link>
      </div>
    </section>
    <style jsx>{`
      .launch-state{min-height:100vh;display:grid;place-items:center;padding:24px;background:var(--ft-app-bg);color:var(--ft-text)}
      .launch-state-card{width:min(560px,100%);box-sizing:border-box;padding:42px;border:1px solid var(--ft-border);border-radius:var(--ft-radius-panel);background:var(--ft-surface);box-shadow:var(--ft-shadow-modal);text-align:center}
      .launch-state-logo{margin-bottom:30px;font-size:18px;font-weight:800;letter-spacing:4px}
      .launch-state-ey{font-size:var(--ft-font-xs);font-weight:700;letter-spacing:1.8px;color:#6f76a0}
      h1{margin:10px 0 12px;font-size:clamp(26px,4vw,36px);line-height:1.12;letter-spacing:-.7px}
      p{max-width:450px;margin:0 auto;color:var(--ft-text-muted);font-size:var(--ft-font-md);line-height:1.65}
      .launch-state-actions{display:flex;justify-content:center;gap:9px;flex-wrap:wrap;margin-top:26px}
      .launch-state-actions :global(a),button{min-height:42px;display:inline-flex;align-items:center;justify-content:center;padding:0 15px;border-radius:var(--ft-radius-control);font:700 var(--ft-font-sm) inherit;text-decoration:none;cursor:pointer}
      .launch-primary{border:0;background:var(--ft-brand-gradient);color:#fff}
      .launch-secondary{border:1px solid var(--ft-border);background:var(--ft-surface-muted);color:var(--ft-accent-ink)}
      @media(max-width:560px){.launch-state-card{padding:32px 22px}.launch-state-actions{display:grid}.launch-state-actions :global(a),button{width:100%;box-sizing:border-box}}
    `}</style>
  </main>;
}
