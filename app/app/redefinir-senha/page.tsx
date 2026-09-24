"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../lib/supabase-client";

function senhaValida(senha: string) {
  return senha.length >= 6 && senha.length <= 128;
}

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [sessaoOk, setSessaoOk] = useState(false);
  const [verificando, setVerificando] = useState(true);

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
      setErro("Use pelo menos 6 caracteres.");
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
    setTimeout(() => router.replace("/dashboard"), 1500);
  }

  const container: React.CSSProperties = { minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(180deg,#F5F3FB 0%,#EEEAF8 100%)",fontFamily:"sans-serif",padding:24 };
  const card: React.CSSProperties = { background:"#FAF8FD",borderRadius:16,padding:40,width:"100%",maxWidth:400,border:"1px solid #D7D0E7" };
  const inputStyle: React.CSSProperties = { width:"100%",padding:"12px 14px",fontSize:14,border:"1.5px solid #D7D0E7",borderRadius:10,background:"#F3EFF9",color:"#21253A",outline:"none",marginBottom:20,boxSizing:"border-box" };

  if (verificando) return <div className="auth-shell" style={container}><div className="auth-card" style={card}><div style={{fontSize:28,fontWeight:700,letterSpacing:4,color:"#21253A",textAlign:"center",marginBottom:8}}>FOTURA</div><p style={{fontSize:14,color:"#73758D",textAlign:"center"}}>Verificando link de recuperação…</p></div></div>;

  if (!sessaoOk) return <div className="auth-shell" style={container}><div className="auth-card" style={card}><div style={{fontSize:28,fontWeight:700,letterSpacing:4,color:"#21253A",textAlign:"center",marginBottom:8}}>FOTURA</div><p style={{fontSize:14,color:"#ef4444",textAlign:"center",marginBottom:24}}>Link inválido ou expirado.</p><Link href="/esqueci-senha" style={{display:"block",textAlign:"center",fontSize:13,color:"#4a6cf7",textDecoration:"underline"}}>Solicitar novo link</Link></div></div>;

  return (
    <div style={container}>
      <div style={card}>
        <div style={{fontSize:28,fontWeight:700,letterSpacing:4,color:"#21253A",textAlign:"center",marginBottom:8}}>FOTURA</div>
        <p style={{fontSize:14,color:"#73758D",textAlign:"center",marginBottom:32}}>Defina sua nova senha</p>
        {mensagem ? (
          <div style={{background:"#EAF5EF",border:"1px solid #22c55e44",borderRadius:10,padding:"16px 18px"}}><p style={{fontSize:14,color:"#47735B",margin:0,lineHeight:1.6}}>{mensagem} Redirecionando…</p></div>
        ) : (
          <>
            <label style={{fontSize:13,color:"#5F657D",display:"block",marginBottom:6}}>Nova senha</label>
            <input type="password" autoComplete="new-password" maxLength={128} value={novaSenha} onChange={(e)=>setNovaSenha(e.target.value)} placeholder="••••••••" style={inputStyle} />
            <p style={{fontSize:11,color:"#8A8CA1",margin:"-10px 0 18px"}}>Mínimo de 6 caracteres.</p>
            <label style={{fontSize:13,color:"#5F657D",display:"block",marginBottom:6}}>Confirmar nova senha</label>
            <input type="password" autoComplete="new-password" maxLength={128} value={confirmar} onChange={(e)=>setConfirmar(e.target.value)} onKeyDown={(e)=>e.key === "Enter" && handleRedefinir()} placeholder="••••••••" style={{...inputStyle,marginBottom:24}} />
            <button onClick={handleRedefinir} disabled={carregando} style={{width:"100%",padding:"13px",fontSize:14,fontWeight:600,color:"#fff",background:carregando?"#7D83C8":"linear-gradient(90deg,#1196fc,#5d0dfa)",border:"none",borderRadius:10,cursor:carregando?"default":"pointer"}}>{carregando?"Salvando...":"Redefinir senha"}</button>
            {erro && <p style={{fontSize:13,textAlign:"center",marginTop:16,color:"#ef4444"}}>{erro}</p>}
          </>
        )}
      </div>
    </div>
  );
}
