"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase-client";

type Check = { id: string; nome: string; status: "ok" | "warn" | "error"; detalhe: string };
type Health = { geral: "ok" | "warn" | "error"; checks: Check[]; verificadoEm: string };

type Item = { titulo: string; status: "ok" | "manual" | "bloqueio"; detalhe: string };

export default function AdminLancamentoPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [health, setHealth] = useState<Health | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.replace("/login"); return; }
      const resposta = await fetch("/api/admin/saude", { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store" });
      if (!ativo) return;
      if (!resposta.ok) { setErro("Não foi possível carregar os sinais operacionais."); return; }
      setHealth(await resposta.json() as Health);
    })();
    return () => { ativo = false; };
  }, [router, supabase]);

  const infraOk = health?.geral === "ok";
  const itens: Item[] = [
    { titulo: "Infraestrutura de produção", status: infraOk ? "ok" : health ? "bloqueio" : "manual", detalhe: health ? (infraOk ? "Supabase, Auth, Storage e configuração crítica passaram no health check." : "Há avisos ou erros no painel de saúde que devem ser revisados.") : "Aguardando health check." },
    { titulo: "Domínio e deploy", status: "ok", detalhe: "Aplicação opera pelo domínio oficial e deploy automático da branch principal." },
    { titulo: "Segurança e isolamento", status: "ok", detalhe: "RLS, APIs protegidas, limites de billing e controles administrativos foram endurecidos." },
    { titulo: "Cobrança Stripe", status: "ok", detalhe: "Checkout, portal, webhook, planos e recuperação de receita estão configurados em produção." },
    { titulo: "Teste financeiro real ponta a ponta", status: "manual", detalhe: "Ainda é necessário executar uma cobrança real controlada: checkout → pagamento → webhook → assinatura no Fotura → portal → cancelamento/recuperação." },
    { titulo: "Onboarding", status: "ok", detalhe: "Novas contas sem plano passam pelo fluxo guiado até configuração e primeira galeria." },
    { titulo: "Administração e auditoria", status: "ok", detalhe: "Detalhe de contas, auditoria, moderação, suspensão, takedown e encerramento protegido estão disponíveis." },
    { titulo: "Exclusão definitiva", status: "ok", detalhe: "Purge possui múltiplas barreiras, inventário, períodos de segurança, checkpoints e confirmação forte." },
    { titulo: "Regressão crítica", status: "manual", detalhe: "Antes de abrir para usuários externos, executar uma rodada final dos fluxos: cadastro, login, upload, galeria pública, seleção, comentários, download e billing." },
    { titulo: "Suporte inicial", status: "manual", detalhe: "Definir canal e rotina de resposta para os primeiros usuários do lançamento controlado." },
  ];
  const bloqueios = itens.filter(i => i.status === "bloqueio").length;
  const manuais = itens.filter(i => i.status === "manual").length;
  const prontos = itens.filter(i => i.status === "ok").length;

  return <main className="lr"><style>{`
    .lr{min-height:100vh;background:linear-gradient(180deg,#090917,#0e0e20);color:#f0f0f5;padding:46px 6vw 90px;font-family:Sora,sans-serif}.wrap{max-width:1050px;margin:auto}.top{display:flex;justify-content:space-between;gap:16px}.ey{font-size:11px;letter-spacing:2px;color:#6f76a0;text-transform:uppercase}.lr h1{font-size:30px;margin:7px 0}.sub{font-size:12px;color:#7a7f9a;line-height:1.6}.btn{border:1px solid #303552;background:#15172d;color:#d8dcf2;border-radius:10px;padding:9px 12px;font:11px inherit;cursor:pointer}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:24px}.card{background:linear-gradient(180deg,#14142b,#101023);border:1px solid #23233c;border-radius:15px;padding:17px}.card b{font-size:25px;display:block}.card span{font-size:10px;color:#7f859f}.ok{color:#8fe3b0}.manual{color:#f6c445}.bloqueio{color:#ff9d9d}.items{display:grid;gap:10px;margin-top:14px}.item{background:#111124;border:1px solid #23233c;border-radius:13px;padding:15px}.itemHead{display:flex;justify-content:space-between;gap:12px;align-items:center}.itemTitle{font-size:13px;font-weight:700}.pill{font-size:9px;padding:4px 8px;border-radius:999px;border:1px solid #303552;text-transform:uppercase}.pill.ok{border-color:rgba(143,227,176,.25);background:rgba(143,227,176,.06)}.pill.manual{border-color:rgba(246,196,69,.25);background:rgba(246,196,69,.06)}.pill.bloqueio{border-color:rgba(255,157,157,.3);background:rgba(255,157,157,.06)}.detail{font-size:11px;color:#9298af;line-height:1.55;margin-top:8px}.note{margin-top:16px;border:1px solid rgba(246,196,69,.22);background:rgba(246,196,69,.04);border-radius:13px;padding:14px;color:#c8c29d;font-size:11px;line-height:1.6}.err{color:#ff9d9d;margin-top:18px}@media(max-width:650px){.top{flex-direction:column}.summary{grid-template-columns:1fr}.itemHead{align-items:flex-start}}
  `}</style><div className="wrap"><div className="top"><div><div className="ey">Fotura interno · Pré-lançamento</div><h1>Prontidão para lançamento</h1><div className="sub">Checklist operacional para liberar o Fotura primeiro a um grupo pequeno de usuários reais.</div></div><button className="btn" onClick={()=>router.push("/admin")}>← Administração</button></div>{erro&&<div className="err">{erro}</div>}<section className="summary"><div className="card"><b className="ok">{prontos}</b><span>itens prontos</span></div><div className="card"><b className="manual">{manuais}</b><span>validações manuais</span></div><div className="card"><b className="bloqueio">{bloqueios}</b><span>bloqueios técnicos</span></div></section><section className="items">{itens.map(i=><article className="item" key={i.titulo}><div className="itemHead"><div className="itemTitle">{i.titulo}</div><span className={`pill ${i.status}`}>{i.status==="ok"?"Pronto":i.status==="manual"?"Validar":"Bloqueio"}</span></div><div className="detail">{i.detalhe}</div></article>)}</section><div className="note">Critério sugerido para o lançamento controlado: zero bloqueios técnicos, health check sem erros e conclusão das duas validações manuais críticas — pagamento real ponta a ponta e regressão final dos fluxos principais.</div></div></main>;
}
