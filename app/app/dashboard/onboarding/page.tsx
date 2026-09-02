"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MenuFotografo from "../../MenuFotografo";
import { createClient } from "../../../lib/supabase-client";

type Estado = {
  plano: string;
  planoNome: string;
  perfilConfigurado: boolean;
  galerias: number;
};

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) { router.replace("/login"); return; }
      try {
        const [billingRes, perfilRes, galeriasRes] = await Promise.all([
          fetch("/api/billing/status", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" }),
          supabase.from("perfis").select("nome_estudio").eq("id", session.user.id).maybeSingle(),
          supabase.from("galerias").select("id", { count: "exact", head: true }).eq("user_id", session.user.id),
        ]);
        if (!billingRes.ok) throw new Error("billing");
        const billing = await billingRes.json() as { plano?: { codigo?: string; nome?: string } };
        if (!ativo) return;
        setEstado({
          plano: billing.plano?.codigo ?? "sem_plano",
          planoNome: billing.plano?.nome ?? "Sem plano",
          perfilConfigurado: Boolean((perfilRes.data?.nome_estudio as string | null)?.trim()),
          galerias: galeriasRes.count ?? 0,
        });
      } catch {
        if (ativo) setErro("Não foi possível carregar seu progresso agora.");
      }
    })();
    return () => { ativo = false; };
  }, [router, supabase]);

  const planoOk = Boolean(estado && estado.plano !== "sem_plano");
  const perfilOk = Boolean(estado?.perfilConfigurado);
  const galeriaOk = Boolean(estado && estado.galerias > 0);
  const concluidas = [planoOk, perfilOk, galeriaOk].filter(Boolean).length;

  return <main className="onb mf-shift">
    <MenuFotografo/>
    <style>{`
      .onb{min-height:100vh;box-sizing:border-box;background:linear-gradient(180deg,#090917,#0e0e20);color:#f0f0f5;padding:48px 5vw 80px}.onb-wrap{max-width:1040px;margin:0 auto}.ey{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6f76a0}.onb h1{font-size:32px;margin:8px 0 8px;letter-spacing:-.8px}.sub{font-size:13px;color:#7a7f9a;line-height:1.65;max-width:680px}.progress{margin:28px 0 22px;padding:18px 20px;border:1px solid #23233c;border-radius:14px;background:linear-gradient(180deg,#14142b,#101023)}.prog-top{display:flex;justify-content:space-between;gap:16px;font-size:12px;color:#aeb3c8;margin-bottom:10px}.track{height:8px;border-radius:999px;background:#090917;overflow:hidden}.fill{height:100%;background:linear-gradient(90deg,#1196fc,#5d0dfa);transition:width .25s ease}.steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.step{position:relative;padding:22px;border:1px solid #23233c;border-radius:16px;background:linear-gradient(180deg,#14142b,#101023);min-height:250px;display:flex;flex-direction:column}.num{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;background:#1b1c34;color:#8ea7ff;font-weight:800;font-size:12px;margin-bottom:18px}.step.done .num{background:rgba(143,227,176,.1);color:#8fe3b0}.step h2{font-size:17px;margin:0 0 8px}.step p{font-size:11px;line-height:1.6;color:#777e98;margin:0}.state{margin-top:13px;font-size:10px;font-weight:700;color:#8ea7ff}.step.done .state{color:#8fe3b0}.cta{margin-top:auto;padding-top:20px}.btn{display:inline-flex;justify-content:center;align-items:center;width:100%;box-sizing:border-box;border:1px solid #323650;border-radius:10px;background:#17172d;color:#e3e6f3;padding:11px 13px;font:650 12px inherit;cursor:pointer}.btn.primary{border:0;background:linear-gradient(90deg,#1196fc,#5d0dfa);color:white}.done-note{margin-top:20px;padding:14px 16px;border-radius:12px;border:1px solid rgba(143,227,176,.18);background:rgba(143,227,176,.05);color:#a7d9ba;font-size:12px}.err{margin-top:20px;color:#ff9d9d;font-size:12px}@media(max-width:900px){.steps{grid-template-columns:1fr}.step{min-height:0}}@media(max-width:640px){.onb{padding:88px 18px 60px}.onb h1{font-size:27px}}
    `}</style>
    <div className="onb-wrap">
      <div className="ey">Primeiros passos</div>
      <h1>Prepare seu Fotura</h1>
      <p className="sub">Em poucos passos sua conta fica pronta para criar galerias, compartilhar provas e entregar fotos aos seus clientes.</p>
      {erro && <div className="err">{erro}</div>}
      <div className="progress"><div className="prog-top"><span>Progresso da configuração</span><strong>{estado ? `${concluidas}/3` : "…"}</strong></div><div className="track"><div className="fill" style={{width:`${estado ? (concluidas / 3) * 100 : 0}%`}}/></div></div>
      <section className="steps">
        <article className={`step ${planoOk ? "done" : ""}`}><div className="num">{planoOk ? "✓" : "1"}</div><h2>Escolha seu plano</h2><p>Selecione o plano que melhor acompanha seu volume de galerias, clientes e armazenamento.</p><div className="state">{planoOk ? `Plano ${estado?.planoNome} ativo` : "Assinatura necessária"}</div><div className="cta"><button className={`btn ${!planoOk ? "primary" : ""}`} onClick={()=>router.push("/dashboard/assinatura")}>{planoOk ? "Ver assinatura" : "Escolher plano"}</button></div></article>
        <article className={`step ${perfilOk ? "done" : ""}`}><div className="num">{perfilOk ? "✓" : "2"}</div><h2>Configure seu estúdio</h2><p>Defina o nome do estúdio, identidade visual e informações que aparecem para seus clientes.</p><div className="state">{perfilOk ? "Identidade configurada" : "Configuração recomendada"}</div><div className="cta"><button className="btn" onClick={()=>router.push("/configuracoes")}>{perfilOk ? "Revisar configurações" : "Configurar estúdio"}</button></div></article>
        <article className={`step ${galeriaOk ? "done" : ""}`}><div className="num">{galeriaOk ? "✓" : "3"}</div><h2>Crie sua primeira galeria</h2><p>Envie suas primeiras fotos e experimente o fluxo completo que seus clientes vão receber.</p><div className="state">{galeriaOk ? `${estado?.galerias} galeria${estado?.galerias === 1 ? "" : "s"} criada${estado?.galerias === 1 ? "" : "s"}` : planoOk ? "Pronto para começar" : "Disponível após escolher um plano"}</div><div className="cta"><button className={`btn ${planoOk && !galeriaOk ? "primary" : ""}`} disabled={!planoOk} onClick={()=>router.push("/upload")}>{galeriaOk ? "Criar outra galeria" : "Criar primeira galeria"}</button></div></article>
      </section>
      {concluidas === 3 && <div className="done-note">Configuração concluída. Sua conta já está pronta para usar o Fotura no dia a dia. <button style={{marginLeft:8,border:0,background:"transparent",color:"#8ea7ff",cursor:"pointer",fontWeight:700}} onClick={()=>router.push("/dashboard")}>Ir para o painel →</button></div>}
    </div>
  </main>;
}
