"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase-client";
import { useI18n } from "../components/I18nProvider";
import AuthFrame from "../components/AuthFrame";
import { withLocalePath } from "../../lib/i18n";

const ORIGEM_PRODUCAO = "https://foturax.com.br";

function origemRecuperacao() {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return window.location.origin;
  }
  return ORIGEM_PRODUCAO;
}

const RECOVERY_COPY = {
  pt: {
    eyebrow: "SEGURANÇA DA CONTA",
    title: "Recupere seu acesso.",
    intro: "Informe o e-mail da sua conta para receber um link e definir uma nova senha.",
    sentTitle: "Verifique seu e-mail.",
    sentIntro: "Se o endereço informado estiver cadastrado, você receberá as instruções de recuperação.",
  },
  en: {
    eyebrow: "ACCOUNT SECURITY",
    title: "Recover your access.",
    intro: "Enter your account email to receive a link to set a new password.",
    sentTitle: "Check your email.",
    sentIntro: "If the address is registered, you will receive password recovery instructions.",
  },
  es: {
    eyebrow: "SEGURIDAD DE LA CUENTA",
    title: "Recupera tu acceso.",
    intro: "Introduce el correo de tu cuenta para recibir un enlace y crear una nueva contraseña.",
    sentTitle: "Revisa tu correo.",
    sentIntro: "Si el correo está registrado, recibirás instrucciones para recuperar tu contraseña.",
  },
} as const;

export default function EsqueciSenhaPage() {
  const { locale, t } = useI18n();
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const supabase = createClient();
  const copy = RECOVERY_COPY[locale === "en" ? "en" : locale === "es" ? "es" : "pt"];

  async function handleSubmit() {
    const emailNormalizado = email.trim().toLowerCase();
    if (!emailNormalizado || carregando) return;
    setCarregando(true);

    await supabase.auth.resetPasswordForEmail(emailNormalizado, {
      redirectTo: `${origemRecuperacao()}${withLocalePath("/redefinir-senha", locale)}`,
    });

    // Resposta deliberadamente genérica para não revelar se o e-mail possui conta.
    setEnviado(true);
    setCarregando(false);
  }

  return (
    <AuthFrame
      eyebrow={copy.eyebrow}
      title={enviado ? copy.sentTitle : copy.title}
      intro={enviado ? copy.sentIntro : copy.intro}
    >
      {enviado ? (
        <p className="ft-auth-message" role="status" aria-live="polite">
          {t("Se existir uma conta com esse e-mail, enviaremos um link de recuperação. Verifique também a caixa de spam.")}
        </p>
      ) : (
        <form className="ft-auth-form" onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }}>
          <label className="ft-auth-label" htmlFor="recovery-email">{t("E-mail da sua conta")}</label>
          <input
            id="recovery-email" className="ft-auth-input ft-auth-email"
            type="email" name="email" autoComplete="email" inputMode="email"
            value={email} onChange={(event) => setEmail(event.target.value)}
            placeholder="seu@email.com" required
          />
          <button className="ft-auth-submit" type="submit" disabled={carregando} aria-busy={carregando}>
            {carregando ? t("Enviando...") : t("Enviar link de recuperação")}
          </button>
        </form>
      )}

      <p className="ft-auth-switch">
        <Link href={withLocalePath("/login", locale)} className="ft-auth-link">{t("Voltar ao login")}</Link>
      </p>
    </AuthFrame>
  );
}
