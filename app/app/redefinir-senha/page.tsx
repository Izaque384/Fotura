"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../lib/supabase-client";
import { useI18n } from "../components/I18nProvider";
import AuthFrame from "../components/AuthFrame";
import { withLocalePath } from "../../lib/i18n";

function senhaValida(senha: string) {
  return senha.length >= 8 && senha.length <= 128;
}

const RESET_COPY = {
  pt: {
    eyebrow: "SEGURANÇA DA CONTA",
    title: "Defina sua nova senha.",
    intro: "Escolha uma nova senha para proteger sua conta e continuar suas entregas.",
    checkingTitle: "Verificando seu link.",
    checkingIntro: "Estamos confirmando o acesso para redefinir sua senha.",
    invalidTitle: "Este link expirou.",
    invalidIntro: "O link de recuperação é inválido, expirou ou já foi utilizado. Você pode solicitar outro.",
    successTitle: "Senha atualizada.",
    successIntro: "Sua senha foi alterada com sucesso.",
  },
  en: {
    eyebrow: "ACCOUNT SECURITY",
    title: "Set your new password.",
    intro: "Choose a new password to secure your account and continue delivering.",
    checkingTitle: "Verifying your link.",
    checkingIntro: "We are confirming your password reset access.",
    invalidTitle: "This link has expired.",
    invalidIntro: "The recovery link is invalid, expired, or has already been used. You can request another one.",
    successTitle: "Password updated.",
    successIntro: "Your password has been changed successfully.",
  },
  es: {
    eyebrow: "SEGURIDAD DE LA CUENTA",
    title: "Define tu nueva contraseña.",
    intro: "Elige una nueva contraseña para proteger tu cuenta y continuar tus entregas.",
    checkingTitle: "Verificando tu enlace.",
    checkingIntro: "Estamos confirmando tu acceso para restablecer la contraseña.",
    invalidTitle: "Este enlace ha caducado.",
    invalidIntro: "El enlace es inválido, ha caducado o ya se ha utilizado. Puedes solicitar otro.",
    successTitle: "Contraseña actualizada.",
    successIntro: "Tu contraseña se ha cambiado correctamente.",
  },
} as const;

function ResetPasswordInput({
  id, value, onChange, locale,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  locale: string;
}) {
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible
    ? (locale === "en" ? "Hide password" : locale === "es" ? "Ocultar contraseña" : "Ocultar senha")
    : (locale === "en" ? "Show password" : locale === "es" ? "Mostrar contraseña" : "Mostrar senha");

  return (
    <div className="ft-auth-password-wrap" style={{ marginBottom: 18 }}>
      <input
        className="ft-auth-input ft-auth-password-input"
        id={id} type={visible ? "text" : "password"}
        autoComplete="new-password" maxLength={128} required
        value={value} onChange={(event) => onChange(event.target.value)}
        placeholder="••••••••"
      />
      <button
        className="ft-auth-reveal" type="button" aria-label={toggleLabel}
        title={toggleLabel} aria-pressed={visible} onClick={() => setVisible(!visible)}
      >
        {visible ? (
          <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c5 0 8.5 4.1 10 7a13.9 13.9 0 0 1-4 4.8"/><path d="M6.4 6.4A14.5 14.5 0 0 0 2 12c1.5 2.9 5 7 10 7a10.8 10.8 0 0 0 4.1-.8"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M3 3l18 18"/>
          </svg>
        ) : (
          <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>
    </div>
  );
}

export default function RedefinirSenhaPage() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const supabase = createClient();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [sessaoOk, setSessaoOk] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const copy = RESET_COPY[locale === "en" ? "en" : locale === "es" ? "es" : "pt"];

  useEffect(() => {
    let fluxoRecuperacao = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        fluxoRecuperacao = true;
        setSessaoOk(true);
        setVerificando(false);
      }
    });

    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (fluxoRecuperacao && session) setSessaoOk(true);
      setVerificando(false);
    }, 1500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRedefinir() {
    if (carregando || !sessaoOk) return;
    setErro("");
    setMensagem("");

    if (!senhaValida(novaSenha)) {
      setErro("Use pelo menos 8 caracteres.");
      return;
    }
    if (novaSenha !== confirmar) {
      setErro("As senhas não coincidem.");
      return;
    }

    setCarregando(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) {
      setErro("Não foi possível redefinir a senha. Solicite um novo link e tente novamente.");
      setCarregando(false);
      return;
    }

    await supabase.auth.signOut({ scope: "others" });
    setMensagem("Senha redefinida com sucesso!");
    setCarregando(false);
    setTimeout(() => router.replace(withLocalePath("/dashboard", locale)), 1500);
  }

  const title = verificando
    ? copy.checkingTitle
    : !sessaoOk ? copy.invalidTitle : mensagem ? copy.successTitle : copy.title;
  const intro = verificando
    ? copy.checkingIntro
    : !sessaoOk ? copy.invalidIntro : mensagem ? copy.successIntro : copy.intro;

  return (
    <AuthFrame eyebrow={copy.eyebrow} title={title} intro={intro}>
      {verificando ? (
        <p className="ft-auth-message" role="status" aria-live="polite">
          {t("Verificando link de recuperação…")}
        </p>
      ) : !sessaoOk ? (
        <>
          <p className="ft-auth-message error" role="alert">{t("Link inválido ou expirado.")}</p>
          <p className="ft-auth-switch">
            <Link href={withLocalePath("/esqueci-senha", locale)} className="ft-auth-link">{t("Solicitar novo link")}</Link>
          </p>
        </>
      ) : mensagem ? (
        <p className="ft-auth-message" role="status" aria-live="polite">
          {t(mensagem)} {t("Redirecionando…")}
        </p>
      ) : (
        <form className="ft-auth-form" onSubmit={(event) => { event.preventDefault(); void handleRedefinir(); }} noValidate>
          <label className="ft-auth-label" htmlFor="reset-password">{t("Nova senha")}</label>
          <ResetPasswordInput id="reset-password" value={novaSenha} onChange={setNovaSenha} locale={locale} />
          <p className="ft-auth-hint" style={{ marginTop: -7, marginBottom: 20 }}>{t("Mínimo de 8 caracteres.")}</p>

          <label className="ft-auth-label" htmlFor="reset-confirm">{t("Confirmar nova senha")}</label>
          <ResetPasswordInput id="reset-confirm" value={confirmar} onChange={setConfirmar} locale={locale} />

          <button className="ft-auth-submit" type="submit" disabled={carregando} aria-busy={carregando}>
            {carregando ? t("Salvando...") : t("Redefinir senha")}
          </button>
          {erro && <p className="ft-auth-message error" role="alert" aria-live="assertive">{t(erro)}</p>}
        </form>
      )}
    </AuthFrame>
  );
}
