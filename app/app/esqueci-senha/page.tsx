"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "../components/I18nProvider";
import AuthFrame from "../components/AuthFrame";
import { withLocalePath } from "../../lib/i18n";

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
  const [erroEnvio, setErroEnvio] = useState("");
  const copy = RECOVERY_COPY[locale === "en" ? "en" : locale === "es" ? "es" : "pt"];

  async function handleSubmit() {
    const emailNormalizado = email.trim().toLowerCase();
    if (!emailNormalizado || carregando) return;
    setCarregando(true);

    setErroEnvio("");
    try {
      const response = await fetch("/api/auth/password-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailNormalizado, locale }),
        cache: "no-store",
      });
      if (!response.ok) {
        setErroEnvio(response.status === 429
          ? (locale === "en" ? "Too many requests. Try again later." : locale === "es" ? "Demasiadas solicitudes. Inténtalo más tarde." : "Muitas solicitações. Aguarde antes de tentar novamente.")
          : (locale === "en" ? "We could not process your request now. Please try again later." : locale === "es" ? "No pudimos procesar tu solicitud. Inténtalo de nuevo más tarde." : "Não foi possível processar a solicitação agora. Tente novamente mais tarde."));
      } else {
        // Mensagem neutra: não revela se existe uma conta.
        setEnviado(true);
      }
    } catch {
      setErroEnvio(locale === "en" ? "Connection failed. Check your internet and try again." : locale === "es" ? "Falló la conexión. Comprueba tu internet y vuelve a intentarlo." : "Falha de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setCarregando(false);
    }
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
          {erroEnvio && <p role="alert" className="ft-auth-message error" style={{ marginBottom: 18 }}>{erroEnvio}</p>}
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
