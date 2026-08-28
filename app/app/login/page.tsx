"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../lib/supabase-client";

const ORIGEM_PRODUCAO = "https://fotura.vercel.app";

function senhaCadastroValida(senha: string) {
  return senha.length >= 6 && senha.length <= 128;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"login" | "cadastro">("login");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const supabase = createClient();

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
        setMensagem("Erro: Use uma senha com pelo menos 6 caracteres.");
        setCarregando(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: emailNormalizado,
        password: senha,
        options: {
          emailRedirectTo: ORIGEM_PRODUCAO,
          data: { aceitou_termos_em: new Date().toISOString() },
        },
      });
      if (error) {
        setMensagem("Erro: Não foi possível criar a conta. Verifique os dados ou tente entrar.");
      } else {
        setMensagem("Conta criada! Verifique seu e-mail para confirmar.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: emailNormalizado, password: senha });
      if (error) {
        setMensagem("Erro: E-mail ou senha inválidos.");
      } else {
        setMensagem("Login feito com sucesso!");
        router.push("/dashboard");
      }
    }

    setCarregando(false);
  }

  return (
    <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(180deg, #0b0b1a 0%, #111126 100%)",fontFamily:"sans-serif",padding:24 }}>
      <div style={{ background:"#16162a",borderRadius:16,padding:40,width:"100%",maxWidth:400,border:"1px solid #2a2d40" }}>
        <div style={{ fontSize:28,fontWeight:700,letterSpacing:4,color:"#f0f0f5",textAlign:"center",marginBottom:8 }}>FOTURA</div>
        <p style={{ fontSize:14,color:"#7a7f9a",textAlign:"center",marginBottom:32 }}>{modo === "login" ? "Entre na sua conta" : "Crie sua conta"}</p>

        <label style={{ fontSize:13,color:"#a0a4b8",display:"block",marginBottom:6 }}>E-mail</label>
        <input type="email" autoComplete="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="seu@email.com" style={{ width:"100%",padding:"12px 14px",fontSize:14,border:"1.5px solid #2a2d40",borderRadius:10,background:"#0f0f1a",color:"#f0f0f5",outline:"none",marginBottom:20,boxSizing:"border-box" }} />

        <label style={{ fontSize:13,color:"#a0a4b8",display:"block",marginBottom:6 }}>Senha</label>
        <input type="password" autoComplete={modo === "login" ? "current-password" : "new-password"} value={senha} onChange={(e)=>setSenha(e.target.value)} onKeyDown={(e)=>e.key === "Enter" && handleSubmit()} placeholder="••••••••" maxLength={128} style={{ width:"100%",padding:"12px 14px",fontSize:14,border:"1.5px solid #2a2d40",borderRadius:10,background:"#0f0f1a",color:"#f0f0f5",outline:"none",marginBottom:12,boxSizing:"border-box" }} />
        {modo === "cadastro" && <p style={{fontSize:11,color:"#6f76a0",margin:"0 0 18px"}}>Mínimo de 6 caracteres.</p>}

        {modo === "login" && <div style={{textAlign:"right",marginBottom:24}}><Link href="/esqueci-senha" style={{fontSize:12,color:"#4a6cf7",textDecoration:"none"}}>Esqueci minha senha</Link></div>}

        {modo === "cadastro" && (
          <label style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:24,cursor:"pointer"}}>
            <input type="checkbox" checked={aceitouTermos} onChange={(e)=>setAceitouTermos(e.target.checked)} style={{marginTop:2,accentColor:"#4a6cf7"}} />
            <span style={{fontSize:12,color:"#a0a4b8",lineHeight:1.6}}>Li e aceito os <Link href="/termos" target="_blank" rel="noopener noreferrer" style={{color:"#4a6cf7",textDecoration:"underline"}}>Termos de Uso</Link> e a <Link href="/privacidade" target="_blank" rel="noopener noreferrer" style={{color:"#4a6cf7",textDecoration:"underline"}}>Política de Privacidade</Link>.</span>
          </label>
        )}

        <button onClick={handleSubmit} disabled={carregando} style={{width:"100%",padding:"13px",fontSize:14,fontWeight:600,color:"#fff",background:carregando?"#3b5de0":"#4a6cf7",border:"none",borderRadius:10,cursor:carregando?"default":"pointer"}}>{carregando ? "Aguarde..." : modo === "login" ? "Entrar" : "Criar conta"}</button>

        {mensagem && <p style={{fontSize:13,textAlign:"center",marginTop:16,color:mensagem.startsWith("Erro")?"#ef4444":"#22c55e"}}>{mensagem}</p>}

        <p style={{fontSize:13,color:"#7a7f9a",textAlign:"center",marginTop:24}}>{modo === "login" ? "Não tem conta?" : "Já tem conta?"} <button type="button" onClick={()=>{setModo(modo === "login" ? "cadastro" : "login");setMensagem("");setSenha("");}} style={{background:"none",border:"none",cursor:"pointer",color:"#4a6cf7",fontSize:"inherit",fontFamily:"inherit",padding:0,textDecoration:"underline"}}>{modo === "login" ? "Cadastre-se" : "Fazer login"}</button></p>
      </div>
    </div>
  );
}
