"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthFrame, { AUTH_COPY } from "../components/AuthFrame";
import { createClient } from "../../lib/supabase-client";
import { useI18n } from "../components/I18nProvider";
import { normalizeLocale, withLocalePath } from "../../lib/i18n";

const ORIGEM_PRODUCAO = "https://foturax.com.br";

function senhaCadastroValida(senha: string) {
  return senha.length >= 8 && senha.length <= 128;
}

export default function LoginPage() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [modo, setModo] = useState<"login" | "cadastro">("login");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (searchParams.get("encerrada") === "1") {
      setModo("login");
      setMensagem("Conta encerrada com segurança. O conteúdo público foi bloqueado.");
      return;
    }
    if (searchParams.get("suspensa") === "1") {
      setModo("login");
      setMensagem("Erro: Esta conta está suspensa. Entre em contato com o suporte se precisar de ajuda.");
      return;
    }
    if (searchParams.get("confirmado") === "1") {
      setModo("login");
      setMensagem("E-mail confirmado. Entre para continuar.");
      return;
    }
    if (searchParams.get("modo") === "cadastro") setModo("cadastro");
  }, [searchParams]);

  async function handleSubmit() {
    if (carregando) return;
    const emailNormalizado = email.trim().toLowerCase();
    if (!emailNormalizado || !senha) {
      setMensagem("Erro: Preencha e-mail e senha.");
      return;
    }

    setCarregando(true);
    setMensagem("");

    if (modo === "cadastro") {
      if (!aceitouTermos) {
        setMensagem("Erro: Você precisa aceitar os Termos de Uso e a Política de Privacidade.");
        setCarregando(false);
        return;
      }
      if (!senhaCadastroValida(senha)) {
        setMensagem("Erro: Use uma senha com pelo menos 8 caracteres.");
        setCarregando(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: emailNormalizado,
        password: senha,
        options: {
          emailRedirectTo: `${ORIGEM_PRODUCAO}${withLocalePath("/login?confirmado=1", locale)}`,
          data: { aceitou_termos_em: new Date().toISOString(), language: locale },
        },
      });
      if (error) {
        setMensagem("Erro: Não foi possível criar a conta. Verifique os dados ou tente entrar.");
      } else {
        setMensagem("Conta criada! Verifique seu e-mail para confirmar.");
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email: emailNormalizado, password: senha });
      if (error || !data.user) {
        setMensagem("Erro: E-mail ou senha inválidos.");
      } else {
        const token=data.session?.access_token;
        if(token){
          try{
            const status=await fetch("/api/billing/status",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
            if(status.ok){
              const body=await status.json() as {suspensao?:{ativa?:boolean}};
              if(body.suspensao?.ativa){
                await supabase.auth.signOut();
                setMensagem("Erro: Esta conta está suspensa. Entre em contato com o suporte se precisar de ajuda.");
                setCarregando(false);
                return;
              }
            }
          }catch{}
        }
        const [perfilRes, galeriasRes] = await Promise.all([
          supabase.from("perfis").select("nome_estudio,configs").eq("id", data.user.id).maybeSingle(),
          supabase.from("galerias").select("id", { count: "exact", head: true }).eq("user_id", data.user.id),
        ]);
        const perfilConfigurado = Boolean((perfilRes.data?.nome_estudio as string | null)?.trim());
        const temGaleria = (galeriasRes.count ?? 0) > 0;
        const configs = perfilRes.data?.configs && typeof perfilRes.data.configs === "object" && !Array.isArray(perfilRes.data.configs)
          ? perfilRes.data.configs as Record<string, unknown>
          : {};
        const idiomaConta = normalizeLocale(configs.idioma ?? data.user.user_metadata?.language ?? locale);
        if (!configs.idioma || !data.user.user_metadata?.language) {
          void Promise.allSettled([
            supabase.auth.updateUser({ data: { language: idiomaConta } }),
            supabase.from("perfis").upsert({
              id: data.user.id,
              configs: { ...configs, idioma: idiomaConta },
              atualizado_em: new Date().toISOString(),
            }),
          ]);
        }
        router.push(withLocalePath(!perfilConfigurado && !temGaleria ? "/dashboard/onboarding" : "/dashboard", idiomaConta));
      }
    }

    setCarregando(false);
  }

  const mensagemErro = mensagem.startsWith("Erro");
  const textoVisibilidade = senhaVisivel
    ? (locale === "en" ? "Hide password" : locale === "es" ? "Ocultar contraseña" : "Ocultar senha")
    : (locale === "en" ? "Show password" : locale === "es" ? "Mostrar contraseña" : "Mostrar senha");


  const authCopy = AUTH_COPY[locale === "en" ? "en" : locale === "es" ? "es" : "pt"];

  return (
    <AuthFrame
      eyebrow={modo === "login" ? authCopy.loginKicker : authCopy.signupKicker}
      title={modo === "login" ? authCopy.loginTitle : authCopy.signupTitle}
      singleLineTitle={modo === "cadastro"}
      intro={modo === "login" ? authCopy.loginIntro : authCopy.signupIntro}
    >
          <form className="ft-auth-form" onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }} noValidate>
            <label htmlFor="login-email" className="ft-auth-label">{t("E-mail")}</label>
            <input
              id="login-email" name="email" className="ft-auth-input ft-auth-email"
              type="email" autoComplete="email" inputMode="email" value={email}
              onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com"
              aria-invalid={mensagemErro && !email.trim() ? true : undefined}
              required
            />

            <label htmlFor="login-senha" className="ft-auth-label">{t("Senha")}</label>
            <div className="ft-auth-password-wrap">
              <input
                id="login-senha" name="senha" className="ft-auth-input ft-auth-password-input"
                type={senhaVisivel ? "text" : "password"}
                autoComplete={modo === "login" ? "current-password" : "new-password"}
                value={senha} onChange={(event) => setSenha(event.target.value)}
                placeholder="••••••••" maxLength={128}
                aria-describedby={modo === "cadastro" ? "senha-ajuda" : undefined}
                aria-invalid={mensagemErro && !senha ? true : undefined}
                required
              />
              <button
                className="ft-auth-reveal" type="button"
                onClick={() => setSenhaVisivel((atual) => !atual)}
                aria-label={textoVisibilidade} title={textoVisibilidade} aria-pressed={senhaVisivel}
              >
                {senhaVisivel ? (
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
            {modo === "cadastro" && <p id="senha-ajuda" className="ft-auth-hint">{t("Mínimo de 8 caracteres.")}</p>}

            {modo === "login" && (
              <div className="ft-auth-forgot">
                <Link href={withLocalePath("/esqueci-senha", locale)} className="ft-auth-link">{t("Esqueci minha senha")}</Link>
              </div>
            )}

            {modo === "cadastro" && (
              <label className="ft-auth-terms">
                <input
                  className="ft-auth-checkbox" type="checkbox"
                  checked={aceitouTermos} onChange={(event) => setAceitouTermos(event.target.checked)}
                />
                <span className="ft-auth-terms-copy">
                  {t("Li e aceito os")}{" "}
                  <Link href={withLocalePath("/termos", locale)} target="_blank" rel="noopener noreferrer">{t("Termos de Uso")}</Link>
                  {" "}{locale === "en" ? "and the" : locale === "es" ? "y la" : "e a"}{" "}
                  <Link href={withLocalePath("/privacidade", locale)} target="_blank" rel="noopener noreferrer">{t("Política de Privacidade")}</Link>.
                </span>
              </label>
            )}

            <button className="ft-auth-submit" type="submit" disabled={carregando} aria-busy={carregando}>
              {carregando ? t("Aguarde...") : modo === "login" ? t("Entrar") : t("Criar conta")}
            </button>
          </form>

          {mensagem && (
            <p role={mensagemErro ? "alert" : "status"} aria-live={mensagemErro ? "assertive" : "polite"} className={mensagemErro ? "ft-auth-message error" : "ft-auth-message"}>
              {t(mensagem)}
            </p>
          )}

          <p className="ft-auth-switch">
            <span>{modo === "login" ? t("Não tem conta?") : t("Já tem conta?")}</span>
            <button
              type="button"
              onClick={() => { setModo(modo === "login" ? "cadastro" : "login"); setMensagem(""); setSenha(""); setSenhaVisivel(false); }}
            >
              {modo === "login" ? t("Cadastre-se") : t("Fazer login")}
            </button>
          </p>
    </AuthFrame>
  );
}
