"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useI18n } from "./I18nProvider";
import { withLocalePath } from "../../lib/i18n";

const AUTH_STYLES = `
  .ft-auth-page{display:grid;grid-template-columns:minmax(0,43%) minmax(0,57%);min-height:100vh;min-height:100svh;width:100%;background:#F9F7F3;color:#222338}
  .ft-auth-panel{display:flex;flex-direction:column;min-width:0;min-height:100svh;padding:clamp(28px,4.2vw,66px) clamp(26px,5vw,88px) 30px;box-sizing:border-box}
  .ft-auth-brand{display:inline-flex;align-items:center;gap:13px;align-self:flex-start;color:#26273B;text-decoration:none}
  .ft-auth-brand-symbol{display:block;width:45px;height:45px;flex:none;background:url("/favicon.svg") center/contain no-repeat}
  .ft-auth-brand-name{font-size:24px;font-weight:700;letter-spacing:0.12em}
  .ft-auth-main{width:100%;max-width:490px;margin:auto;display:flex;flex-direction:column;justify-content:center;padding:42px 0 28px}
  .ft-auth-eyebrow{color:#585587;font-size:11px;font-weight:700;letter-spacing:0.21em;text-transform:uppercase}
  .ft-auth-title{font-family:Georgia,"Times New Roman",serif!important;font-size:clamp(43px,4.05vw,68px);font-weight:400;letter-spacing:-0.058em;line-height:1.02;margin:16px 0 16px;color:#242336}
  .ft-auth-intro{color:#787485;font-size:14px;line-height:1.85;max-width:410px;margin:0 0 30px}
  .ft-auth-form{width:100%}
  .ft-auth-label{display:block;color:#3A3B4D;font-size:12px;font-weight:700;margin:0 0 9px}
  .ft-auth-input{display:block;width:100%;height:56px;padding:0 16px;box-sizing:border-box;border:1px solid #DDD7E3;border-radius:12px;background:#FFFEFC;color:#25263E;font-size:14px;outline:0;transition:border-color .18s,box-shadow .18s}
  .ft-auth-input::placeholder{color:#9B97A4}
  .ft-auth-input:focus{border-color:#7564CD;box-shadow:0 0 0 3px rgba(101,84,193,.12)}
  .ft-auth-input[aria-invalid="true"]{border-color:#B85C65}
  .ft-auth-email{margin-bottom:22px}
  .ft-auth-password-wrap{position:relative}
  .ft-auth-password-input{padding-right:58px}
  .ft-auth-reveal{position:absolute;right:5px;top:5px;display:flex;align-items:center;justify-content:center;width:46px;height:46px;cursor:pointer;border:0;border-radius:9px;background:transparent;color:#66637B;transition:background .18s}
  .ft-auth-reveal:hover{background:#EEEAF5;color:#3F3984}
  .ft-auth-hint{color:#777487;font-size:12px;margin:9px 0 20px}
  .ft-auth-forgot{display:flex;justify-content:flex-end;margin:13px 0 25px}
  .ft-auth-link{color:#4D4A98;font-size:12px;font-weight:650;text-decoration:none}
  .ft-auth-link:hover{text-decoration:underline}
  .ft-auth-terms{display:flex;align-items:flex-start;gap:11px;margin:19px 0 25px;cursor:pointer}
  .ft-auth-checkbox{width:18px;height:18px;min-width:18px;margin-top:3px;accent-color:#5652A7}
  .ft-auth-terms-copy{font-size:12px;line-height:1.7;color:#6A687C}
  .ft-auth-terms-copy a{color:#4D4A98;text-decoration:underline;text-underline-offset:2px}
  .ft-auth-submit{width:100%;min-height:55px;padding:13px 24px;border:0;border-radius:12px;background:#292743;color:#fff;font-size:14px;font-weight:700;cursor:pointer;transition:background .18s,transform .18s;box-shadow:0 10px 22px rgba(31,27,72,.12)}
  .ft-auth-submit:hover:not(:disabled){background:#453A83;transform:translateY(-1px)}
  .ft-auth-submit:disabled{opacity:.58;cursor:wait}
  .ft-auth-message{font-size:13px;line-height:1.6;margin:17px 0 0;padding:12px 14px;border-radius:10px;background:#EDF6EF;color:#2F694B}
  .ft-auth-message.error{background:#FFF0EF;color:#A23F48}
  .ft-auth-switch{display:flex;justify-content:center;align-items:baseline;gap:5px;flex-wrap:wrap;margin:26px 0 0;color:#777487;font-size:13px}
  .ft-auth-switch button{color:#34316F;text-decoration:underline;text-underline-offset:3px;border:0;background:none;padding:4px;cursor:pointer;font:inherit;font-weight:700}
  .ft-auth-footer{margin-top:18px;color:#A19AAB;font-size:11px;line-height:1.5}
  .ft-auth-story{position:relative;isolation:isolate;display:flex;align-items:center;justify-content:center;min-width:0;min-height:100vh;min-height:100svh;padding:72px clamp(36px,6.6vw,112px);box-sizing:border-box;overflow:hidden;text-align:center;color:#FAF8FF;background:radial-gradient(ellipse at 72% 42%,rgba(123,109,183,.25),transparent 54%),linear-gradient(145deg,#17192F 0%,#252440 55%,#20283F 100%)}
  .ft-auth-story::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.025),transparent 35%),radial-gradient(ellipse at 80% 95%,rgba(95,133,196,.15),transparent 45%);z-index:0;pointer-events:none}
  .ft-auth-story-emblem{position:absolute;right:-13%;bottom:-28%;width:min(60vw,820px);height:min(60vw,820px);z-index:0;pointer-events:none;background:linear-gradient(135deg,#C7BFFF,#B6D1FF);-webkit-mask:url("/favicon.svg") center/contain no-repeat;mask:url("/favicon.svg") center/contain no-repeat;opacity:.115}
  .ft-auth-story-content{width:100%;max-width:690px;position:relative;z-index:1;text-align:left}
  .ft-auth-story-kicker{display:flex;align-items:center;gap:12px;color:#CFCAE5;text-transform:uppercase;letter-spacing:.16em;font-size:11px;font-weight:800;line-height:1.6}
  .ft-auth-story-kicker::before{content:"";display:block;width:24px;height:1px;flex:none;background:#A8A3C6}
  .ft-auth-story-title{font-family:inherit!important;font-size:clamp(48px,5.15vw,86px);font-weight:750;letter-spacing:-.064em;line-height:.97;margin:25px 0 25px;max-width:690px;text-wrap:balance}
  .ft-auth-story-highlight{display:inline-block;font-family:Georgia,"Times New Roman",serif;font-style:italic;font-weight:500;letter-spacing:-.055em;padding:0 .08em .12em 0;margin:0 -.08em -.12em 0;background:linear-gradient(95deg,#1998FF 0%,#4771FF 44%,#7941FF 100%);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent}
  .ft-auth-story-description{color:#D0CCDF;font-size:14px;line-height:1.8;max-width:500px;margin:0}
  .ft-auth-story-signature{display:block;color:#AAA4CA;font-size:10px;letter-spacing:.17em;font-weight:700;margin-top:clamp(36px,8vh,80px)}
  @media(max-width:1100px){
    .ft-auth-page{grid-template-columns:minmax(0,46%) minmax(0,54%)}
    .ft-auth-panel{padding-inline:clamp(26px,4.1vw,52px)}
    .ft-auth-story{padding-inline:38px}
    .ft-auth-story-title{font-size:clamp(43px,5.1vw,70px)}
    .ft-auth-story-emblem{right:-20%;bottom:-18%;width:min(64vw,700px);height:min(64vw,700px)}
  }
  @media(max-width:880px){
    .ft-auth-page{display:block}
    .ft-auth-panel{min-height:100svh;max-width:640px;margin:0 auto;padding:32px clamp(24px,7vw,70px) 28px}
    .ft-auth-main{max-width:475px;padding:54px 0 38px}
    .ft-auth-title{font-size:clamp(45px,8vw,64px)}
    .ft-auth-story{display:none}
  }
  @media(max-width:480px){
    .ft-auth-panel{padding:25px 24px 24px}
    .ft-auth-brand-name{font-size:21px}
    .ft-auth-brand-symbol{width:38px;height:38px}
    .ft-auth-main{padding:44px 0 30px}
    .ft-auth-title{font-size:48px;margin:13px 0}
    .ft-auth-intro{font-size:13px;margin-bottom:25px}
    .ft-auth-input{height:54px}
    .ft-auth-footer{text-align:center}
  }
`;

export const AUTH_COPY = {
  pt: {
    loginKicker:"ACESSO AO ESTÚDIO",
    signupKicker:"NOVO ESTÚDIO",
    loginTitle:"Bem-vindo de volta.",
    signupTitle:"Seu espaço começa aqui.",
    loginIntro:"Entre para organizar suas galerias e continuar suas entregas com tranquilidade.",
    signupIntro:"Crie sua conta e apresente seu trabalho com o cuidado que cada fotografia merece.",
    storyDescription:"Transforme cada entrega em uma experiência memorável, com galerias que valorizam seu trabalho e encantam seus clientes.",
    storySignature:"FOTURA — CADA HISTÓRIA MERECE SER BEM ENTREGUE.",
    footer:"Feito para valorizar o trabalho de quem fotografa.",
  },
  en: {
    loginKicker:"YOUR STUDIO",
    signupKicker:"NEW STUDIO",
    loginTitle:"Welcome back.",
    signupTitle:"Your space starts here.",
    loginIntro:"Sign in to organize your galleries and keep delivering with confidence.",
    signupIntro:"Create an account and present your work with the care every photograph deserves.",
    storyDescription:"Turn every delivery into a memorable experience, with galleries that showcase your work and delight your clients.",
    storySignature:"FOTURA — EVERY STORY DESERVES A BEAUTIFUL DELIVERY.",
    footer:"Made to celebrate the work of photographers.",
  },
  es: {
    loginKicker:"TU ESTUDIO",
    signupKicker:"NUEVO ESTUDIO",
    loginTitle:"Qué bueno verte de nuevo.",
    signupTitle:"Tu espacio empieza aquí.",
    loginIntro:"Accede para organizar tus galerías y continuar tus entregas con tranquilidad.",
    signupIntro:"Crea tu cuenta y presenta tu trabajo con el cuidado que cada fotografía merece.",
    storyDescription:"Convierte cada entrega en una experiencia memorable, con galerías que destacan tu trabajo y cautivan a tus clientes.",
    storySignature:"FOTURA — CADA HISTORIA MERECE UNA ENTREGA ESPECIAL.",
    footer:"Creado para valorar el trabajo de quienes fotografían.",
  },
} as const;

type AuthFrameProps = {
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
};

export default function AuthFrame({ eyebrow, title, intro, children }: AuthFrameProps) {
  const { locale, t } = useI18n();
  const authCopy = AUTH_COPY[locale === "en" ? "en" : locale === "es" ? "es" : "pt"];

  return (
    <main className="ft-auth-page">
      <style>{AUTH_STYLES}</style>
      <section className="ft-auth-panel" aria-labelledby="login-title">
        <Link href={withLocalePath("/", locale)} className="ft-auth-brand" aria-label="Fotura — início">
          <span className="ft-auth-brand-symbol" aria-hidden="true" />
          <span className="ft-auth-brand-name">FOTURA</span>
        </Link>

        <div className="ft-auth-main">
          <span className="ft-auth-eyebrow">{eyebrow}</span>
          <h1 id="login-title" className="ft-auth-title">{title}</h1>
          {intro && <p className="ft-auth-intro">{intro}</p>}
          {children}
        </div>

        <p className="ft-auth-footer">{authCopy.footer}</p>
      </section>

      <aside className="ft-auth-story">
        <span className="ft-auth-story-emblem" aria-hidden="true" />
        <div className="ft-auth-story-content">
          <span className="ft-auth-story-kicker">{t("Galerias de entrega e prova online")}</span>
          <h2 className="ft-auth-story-title">
            {t("Sua fotografia merece uma")}{" "}
            <span className="ft-auth-story-highlight">{t("entrega")}</span>{" "}
            {t("à altura.")}
          </h2>
          <p className="ft-auth-story-description">{authCopy.storyDescription}</p>
          <span className="ft-auth-story-signature">{authCopy.storySignature}</span>
        </div>
      </aside>
    </main>
  );
}
