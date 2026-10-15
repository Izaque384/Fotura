"use client";

import Link from "next/link";
import { useI18n } from "./components/I18nProvider";
import { withLocalePath } from "../lib/i18n";

const COPY={
  pt:{ey:"PÁGINA NÃO ENCONTRADA",title:"Este caminho não existe no Fotura.",text:"O link pode estar incompleto, ter expirado ou a página pode ter sido movida.",home:"Ir para o início",login:"Entrar no Fotura"},
  en:{ey:"PAGE NOT FOUND",title:"This path does not exist in Fotura.",text:"The link may be incomplete, expired, or the page may have moved.",home:"Go to home",login:"Sign in to Fotura"},
  es:{ey:"PÁGINA NO ENCONTRADA",title:"Esta ruta no existe en Fotura.",text:"El enlace puede estar incompleto, haber caducado o la página puede haberse movido.",home:"Ir al inicio",login:"Entrar en Fotura"},
} as const;

export default function NotFound(){
  const{locale}=useI18n(),copy=COPY[locale];
  return <main className="launch-state">
    <section className="launch-state-card">
      <div className="launch-state-logo">FOTURA</div>
      <div className="launch-state-ey">{copy.ey}</div>
      <h1>{copy.title}</h1>
      <p>{copy.text}</p>
      <div className="launch-state-actions">
        <Link className="launch-primary" href={withLocalePath("/",locale)}>{copy.home}</Link>
        <Link className="launch-secondary" href={withLocalePath("/login",locale)}>{copy.login}</Link>
      </div>
    </section>
    <style jsx>{`
      .launch-state{min-height:100vh;display:grid;place-items:center;padding:24px;background:var(--ft-app-bg);color:var(--ft-text)}
      .launch-state-card{width:min(560px,100%);box-sizing:border-box;padding:42px;border:1px solid var(--ft-border);border-radius:var(--ft-radius-panel);background:var(--ft-surface);box-shadow:var(--ft-shadow-modal);text-align:center}
      .launch-state-logo{margin-bottom:30px;font-size:18px;font-weight:800;letter-spacing:4px}
      .launch-state-ey{font-size:var(--ft-font-xs);font-weight:700;letter-spacing:1.8px;color:#6f76a0}
      h1{margin:10px 0 12px;font-size:clamp(26px,4vw,36px);line-height:1.12;letter-spacing:-.7px}
      p{max-width:440px;margin:0 auto;color:var(--ft-text-muted);font-size:var(--ft-font-md);line-height:1.65}
      .launch-state-actions{display:flex;justify-content:center;gap:9px;flex-wrap:wrap;margin-top:26px}
      .launch-state-actions a{min-height:42px;display:inline-flex;align-items:center;justify-content:center;padding:0 15px;border-radius:var(--ft-radius-control);font-size:var(--ft-font-sm);font-weight:700;text-decoration:none}
      .launch-primary{background:var(--ft-brand-gradient);color:#fff}
      .launch-secondary{border:1px solid var(--ft-border);background:var(--ft-surface-muted);color:var(--ft-accent-ink)}
      @media(max-width:560px){.launch-state-card{padding:32px 22px}.launch-state-actions{display:grid}.launch-state-actions a{width:100%;box-sizing:border-box}}
    `}</style>
  </main>;
}
