"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../lib/supabase-client";
import { useI18n } from "../components/I18nProvider";
import { withLocalePath } from "../../lib/i18n";

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
        void Promise.allSettled([
          supabase.auth.updateUser({ data: { language: locale } }),
          supabase.from("perfis").upsert({
            id: data.user.id,
            configs: { ...configs, idioma: locale },
            atualizado_em: new Date().toISOString(),
          }),
        ]);
        router.push(withLocalePath(!perfilConfigurado && !temGaleria ? "/dashboard/onboarding" : "/dashboard", locale));
      }
    }

    setCarregando(false);
  }

  const mensagemErro = mensagem.startsWith("Erro");

  return (
    <main className="auth-shell" style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(180deg,#F5F3FB 0%,#EEEAF8 100%)",fontFamily:"sans-serif",padding:24 }}>
      <section className="auth-card" aria-labelledby="login-title" style={{ background:"#FAF8FD",borderRadius:16,padding:"clamp(24px, 7vw, 40px)",width:"100%",maxWidth:400,border:"1px solid #D7D0E7",boxSizing:"border-box" }}>
        <div aria-hidden="true" style={{ fontSize:28,fontWeight:700,letterSpacing:4,color:"#21253A",textAlign:"center",marginBottom:8 }}>FOTURA</div>
        <h1 id="login-title" style={{ fontSize:14,fontWeight:400,color:"#73758D",textAlign:"center",margin:"0 0 32px" }}>{modo === "login" ? t("Entre na sua conta") : t("Crie sua conta")}</h1>

        <form onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }} noValidate>
          <label htmlFor="login-email" style={{ fontSize:13,color:"#5F657D",display:"block",marginBottom:6 }}>{t("E-mail")}</label>
          <input id="login-email" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="seu@email.com" aria-invalid={mensagemErro && !email.trim() ? true : undefined} style={{ width:"100%",padding:"12px 14px",fontSize:14,border:"1.5px solid #D7D0E7",borderRadius:10,background:"#F3EFF9",color:"#21253A",outline:"none",marginBottom:20,boxSizing:"border-box" }} />

          <label htmlFor="login-senha" style={{ fontSize:13,color:"#5F657D",display:"block",marginBottom:6 }}>{t("Senha")}</label>
          <input id="login-senha" name="senha" type="password" autoComplete={modo === "login" ? "current-password" : "new-password"} value={senha} onChange={(e)=>setSenha(e.target.value)} placeholder="••••••••" maxLength={128} aria-describedby={modo === "cadastro" ? "senha-ajuda" : undefined} aria-invalid={mensagemErro && !senha ? true : undefined} style={{ width:"100%",padding:"12px 14px",fontSize:14,border:"1.5px solid #D7D0E7",borderRadius:10,background:"#F3EFF9",color:"#21253A",outline:"none",marginBottom:12,boxSizing:"border-box" }} />
          {modo === "cadastro" && <p id="senha-ajuda" style={{fontSize:11,color:"#8A8CA1",margin:"0 0 18px"}}>{t("Mínimo de 8 caracteres.")}</p>}

          {modo === "login" && <div style={{textAlign:"right",marginBottom:24}}><Link href={withLocalePath("/esqueci-senha", locale)} style={{fontSize:12,color:"#4a6cf7",textDecoration:"none"}}>{t("Esqueci minha senha")}</Link></div>}

          {modo === "cadastro" && (
            <label style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:24,cursor:"pointer"}}>
              <input type="checkbox" checked={aceitouTermos} onChange={(e)=>setAceitouTermos(e.target.checked)} style={{marginTop:2,accentColor:"#4a6cf7",minWidth:18,minHeight:18}} />
              <span style={{fontSize:12,color:"#5F657D",lineHeight:1.6}}>{t("Li e aceito os")} <Link href={withLocalePath("/termos", locale)} target="_blank" rel="noopener noreferrer" style={{color:"#4a6cf7",textDecoration:"underline"}}>{t("Termos de Uso")}</Link> {locale === "en" ? "and the" : locale === "es" ? "y la" : "e a"} <Link href={withLocalePath("/privacidade", locale)} target="_blank" rel="noopener noreferrer" style={{color:"#4a6cf7",textDecoration:"underline"}}>{t("Política de Privacidade")}</Link>.</span>
            </label>
          )}

          <button type="submit" disabled={carregando} aria-busy={carregando} style={{width:"100%",minHeight:44,padding:"13px",fontSize:14,fontWeight:600,color:"#fff",background:carregando?"#7D83C8":"linear-gradient(90deg,#1196fc,#5d0dfa)",border:"none",borderRadius:10,cursor:carregando?"default":"pointer"}}>{carregando ? t("Aguarde...") : modo === "login" ? t("Entrar") : t("Criar conta")}</button>
        </form>

        {mensagem && <p role={mensagemErro ? "alert" : "status"} aria-live={mensagemErro ? "assertive" : "polite"} style={{fontSize:13,textAlign:"center",marginTop:16,color:mensagemErro?"#ef4444":"#22c55e"}}>{t(mensagem)}</p>}

        <p style={{fontSize:13,color:"#73758D",textAlign:"center",marginTop:24}}>{modo === "login" ? t("Não tem conta?") : t("Já tem conta?")} <button type="button" onClick={()=>{setModo(modo === "login" ? "cadastro" : "login");setMensagem("");setSenha("");}} style={{background:"none",border:"none",cursor:"pointer",color:"#4a6cf7",fontSize:"inherit",fontFamily:"inherit",padding:4,textDecoration:"underline"}}>{modo === "login" ? t("Cadastre-se") : t("Fazer login")}</button></p>
      </section>
    </main>
  );
}
