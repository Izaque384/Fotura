"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MenuFotografo from "../../MenuFotografo";
import { PLANOS_FOTURA, type PlanoCodigo } from "../../../lib/billing-plans";
import { createClient } from "../../../lib/supabase-client";

type StatusBilling = {
  plano: { codigo: PlanoCodigo; nome: string; descricao: string };
  status: string;
  provedor: string | null;
  periodoInicio: string | null;
  periodoFim: string | null;
  cancelarNoFim: boolean;
};

type UsageBilling = {
  uso: { galeriasAtivas: number; clientes: number; armazenamentoBytes: number; armazenamentoGb: number };
  limites: {
    galeriasAtivas: { usado: number; limite: number | null; excedido: boolean };
    clientes: { usado: number; limite: number | null; excedido: boolean };
    armazenamento: { usadoBytes: number; usadoGb: number; limiteGb: number | null; excedido: boolean };
  };
};

const comerciais: PlanoCodigo[] = ["essencial", "profissional", "studio"];

function dinheiro(centavos: number | null) {
  if (centavos === null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);
}

function limite(valor: number | null, sufixo = "") {
  return valor === null ? "Ilimitado" : `${valor.toLocaleString("pt-BR")}${sufixo}`;
}

function percentual(usado: number, maximo: number | null) {
  if (maximo === null || maximo <= 0) return 0;
  return Math.min(100, Math.round((usado / maximo) * 100));
}

function statusLabel(status: string) {
  const mapa: Record<string, string> = {
    active: "Ativa",
    trialing: "Período de teste",
    past_due: "Pagamento pendente",
    canceled: "Cancelada",
    unpaid: "Não paga",
    incomplete: "Incompleta",
    incomplete_expired: "Expirada",
    paused: "Pausada",
  };
  return mapa[status] ?? status;
}

export default function AssinaturaPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<StatusBilling | null>(null);
  const [usage, setUsage] = useState<UsageBilling | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [processando, setProcessando] = useState<PlanoCodigo | "portal" | null>(null);

  useEffect(() => {
    const retorno = new URLSearchParams(window.location.search).get("checkout");
    if (retorno === "success") setAviso("Pagamento concluído. A assinatura será atualizada assim que a Stripe confirmar o evento.");
    if (retorno === "cancel") setAviso("Contratação cancelada. Nenhuma alteração foi feita no seu plano.");
  }, []);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data: auth } = await supabase.auth.getSession();
      const session = auth.session;
      if (!session) { router.replace("/login"); return; }
      try {
        const headers = { Authorization: `Bearer ${session.access_token}` };
        const [rStatus, rUsage] = await Promise.all([
          fetch("/api/billing/status", { headers, cache: "no-store" }),
          fetch("/api/billing/usage", { headers, cache: "no-store" }),
        ]);
        if (!rStatus.ok || !rUsage.ok) throw new Error("billing_load_failed");
        const [s, u] = await Promise.all([rStatus.json(), rUsage.json()]);
        if (!ativo) return;
        setStatus(s as StatusBilling);
        setUsage(u as UsageBilling);
      } catch {
        if (ativo) setErro("Não foi possível carregar os dados da assinatura agora.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [router, supabase]);

  async function accessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function escolher(plano: PlanoCodigo) {
    if (processando) return;
    setErro(""); setAviso(""); setProcessando(plano);
    try {
      const token = await accessToken();
      if (!token) { router.replace("/login"); return; }
      const resposta = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plano }),
      });
      const dados = await resposta.json().catch(() => ({})) as { url?: string; error?: string };
      if (!resposta.ok || !dados.url) throw new Error(dados.error || "Não foi possível iniciar o checkout.");
      window.location.assign(dados.url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível iniciar o checkout.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      setProcessando(null);
    }
  }

  async function gerenciar() {
    if (processando) return;
    setErro(""); setAviso(""); setProcessando("portal");
    try {
      const token = await accessToken();
      if (!token) { router.replace("/login"); return; }
      const resposta = await fetch("/api/billing/portal", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const dados = await resposta.json().catch(() => ({})) as { url?: string; error?: string };
      if (!resposta.ok || !dados.url) throw new Error(dados.error || "Não foi possível abrir o gerenciamento da assinatura.");
      window.location.assign(dados.url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível abrir o gerenciamento da assinatura.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      setProcessando(null);
    }
  }

  const atual = status?.plano.codigo ?? "legacy";
  const planoAtual = PLANOS_FOTURA[atual];
  const armazenamentoUsado = usage?.uso.armazenamentoGb ?? 0;
  const gerenciadaStripe = status?.provedor === "stripe";

  return <main className="bill-page mf-shift">
    <MenuFotografo/>
    <style>{`
      .bill-page{min-height:100vh;box-sizing:border-box;background:linear-gradient(180deg,#090917 0%,#0e0e20 100%);color:#f0f0f5;padding-top:46px;padding-right:5vw;padding-bottom:80px}.bill-wrap{width:100%;max-width:1220px;margin:0 auto;box-sizing:border-box;padding-left:clamp(28px,4vw,64px)}.bill-top{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:22px}.bill-ey{font-size:11px;letter-spacing:2px;color:#6f76a0;text-transform:uppercase}.bill-h1{font-size:30px;letter-spacing:-.7px;margin:7px 0 5px}.bill-sub{margin:0;color:#7a7f9a;font-size:13px;line-height:1.6;max-width:650px}.bill-notice{margin:0 0 18px;padding:12px 14px;border-radius:11px;border:1px solid rgba(126,162,255,.24);background:rgba(74,108,247,.08);color:#cbd4ff;font-size:12px}.bill-notice.err{border-color:rgba(255,157,157,.2);background:rgba(255,157,157,.06);color:#ffb1b1}.current{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(340px,.92fr);gap:18px;margin-bottom:28px}.card{background:linear-gradient(180deg,#14142b,#101023);border:1px solid #23233c;border-radius:16px;min-width:0}.current-main{padding:22px}.current-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.current-name{font-size:24px;font-weight:750}.tag{border-radius:999px;padding:6px 9px;font-size:10px;font-weight:700;background:rgba(143,227,176,.08);border:1px solid rgba(143,227,176,.2);color:#8fe3b0}.legacy{margin-top:13px;padding:11px 12px;border-radius:10px;background:rgba(246,196,69,.06);border:1px solid rgba(246,196,69,.17);color:#c9b46f;font-size:11px;line-height:1.55}.manage-btn{margin-top:15px;border:1px solid #323650;border-radius:10px;background:#17172d;color:#dfe2f3;padding:9px 12px;font:650 11px inherit;cursor:pointer}.manage-btn:disabled{opacity:.5;cursor:default}.usage{padding:22px}.usage-title{font-size:12px;font-weight:700;margin-bottom:16px}.meter{margin:0 0 14px}.meter:last-child{margin-bottom:0}.meter-head{display:flex;justify-content:space-between;gap:12px;font-size:11px;color:#969cb6;margin-bottom:7px}.track{height:7px;border-radius:999px;background:#0b0b18;overflow:hidden}.fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,#1196fc,#5d0dfa)}.plans-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin:0 0 14px}.plans-head h2{font-size:21px;margin:0}.plans-head p{font-size:11px;color:#717892;margin:0}.plans{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.plan{position:relative;padding:22px;display:flex;flex-direction:column;min-height:410px}.plan.featured{border-color:rgba(74,108,247,.62);box-shadow:0 14px 45px rgba(25,35,100,.18),inset 0 1px 0 rgba(255,255,255,.025)}.recommended{position:absolute;right:16px;top:15px;border-radius:999px;background:linear-gradient(90deg,#1196fc,#5d0dfa);font-size:9px;font-weight:750;padding:6px 9px}.plan-name{font-size:19px;font-weight:750}.plan-desc{font-size:11px;line-height:1.55;color:#777e98;margin:8px 0 18px;min-height:52px}.price{font-size:31px;font-weight:800;letter-spacing:-1px}.month{font-size:11px;color:#707791;margin-left:4px}.features{display:grid;gap:9px;margin:19px 0 22px;padding:0;list-style:none}.features li{font-size:11px;color:#adb2c8;display:flex;gap:8px;line-height:1.4}.features li:before{content:'✓';color:#8fe3b0;font-weight:800}.plan-btn{margin-top:auto;width:100%;border:1px solid #323650;border-radius:11px;background:#16172c;color:#dfe2f3;padding:12px 14px;font:650 12px inherit;cursor:pointer}.plan-btn.primary{border:0;background:linear-gradient(90deg,#1196fc,#5d0dfa);color:white}.plan-btn:disabled{opacity:.48;cursor:default}.fine{font-size:10px;color:#5f657f;text-align:center;margin-top:16px;line-height:1.5}.loading{min-height:45vh;display:grid;place-items:center;color:#747b97}@media(max-width:1100px){.plans{grid-template-columns:1fr 1fr}.plan:last-child{grid-column:1/-1}}@media(max-width:900px){.bill-wrap{padding-left:clamp(24px,4vw,42px)}.current{grid-template-columns:1fr}.plans{grid-template-columns:1fr}.plan:last-child{grid-column:auto}.plan{min-height:0}}@media(max-width:640px){.bill-page{padding-top:82px;padding-right:18px;padding-bottom:60px}.bill-wrap{padding-left:18px}.bill-top,.plans-head{align-items:flex-start;flex-direction:column}.bill-h1{font-size:27px}.current-main,.usage,.plan{padding:18px}.meter-head{font-size:10.5px}}
    `}</style>
    <div className="bill-wrap">
      <div className="bill-top"><div><div className="bill-ey">Conta e cobrança</div><h1 className="bill-h1">Plano e assinatura</h1><p className="bill-sub">Acompanhe seu consumo, compare os planos do Fotura e gerencie sua cobrança recorrente.</p></div></div>
      {aviso && <div className="bill-notice">{aviso}</div>}
      {erro && <div className="bill-notice err">{erro}</div>}
      {carregando ? <div className="loading">Carregando assinatura…</div> : <>
        <section className="current">
          <div className="card current-main">
            <div className="current-head"><div><div className="bill-ey">Plano atual</div><div className="current-name">{planoAtual.nome}</div></div><span className="tag">{statusLabel(status?.status ?? "active")}</span></div>
            <p className="bill-sub" style={{marginTop:10}}>{planoAtual.descricao}</p>
            {atual === "legacy" && <div className="legacy">Sua conta atual mantém acesso integral enquanto o Fotura conclui a transição para os planos comerciais. Nenhum recurso foi removido da sua conta.</div>}
            {gerenciadaStripe && <button className="manage-btn" disabled={Boolean(processando)} onClick={()=>void gerenciar()}>{processando==="portal"?"Abrindo…":"Gerenciar assinatura"}</button>}
          </div>
          <div className="card usage">
            <div className="usage-title">Uso da conta</div>
            <div className="meter"><div className="meter-head"><span>Galerias ativas</span><span>{usage?.uso.galeriasAtivas ?? 0} / {limite(planoAtual.limites.galeriasAtivas)}</span></div><div className="track"><div className="fill" style={{width:`${percentual(usage?.uso.galeriasAtivas ?? 0, planoAtual.limites.galeriasAtivas)}%`}}/></div></div>
            <div className="meter"><div className="meter-head"><span>Clientes</span><span>{usage?.uso.clientes ?? 0} / {limite(planoAtual.limites.clientes)}</span></div><div className="track"><div className="fill" style={{width:`${percentual(usage?.uso.clientes ?? 0, planoAtual.limites.clientes)}%`}}/></div></div>
            <div className="meter"><div className="meter-head"><span>Armazenamento</span><span>{armazenamentoUsado.toLocaleString("pt-BR",{maximumFractionDigits:2})} GB / {limite(planoAtual.limites.armazenamentoGb," GB")}</span></div><div className="track"><div className="fill" style={{width:`${percentual(armazenamentoUsado, planoAtual.limites.armazenamentoGb)}%`}}/></div></div>
          </div>
        </section>

        <div className="plans-head"><div><div className="bill-ey">Planos comerciais</div><h2>Escolha o nível certo para sua operação</h2></div><p>Valores mensais em reais.</p></div>
        <section className="plans">
          {comerciais.map((codigo) => { const p=PLANOS_FOTURA[codigo]; const ehAtual=atual===codigo; const ocupado=Boolean(processando); return <article key={codigo} className={`card plan${codigo==="profissional"?" featured":""}`}>
            {codigo==="profissional" && <span className="recommended">MAIS ESCOLHIDO</span>}
            <div className="plan-name">{p.nome}</div><div className="plan-desc">{p.descricao}</div>
            <div><span className="price">{dinheiro(p.precoMensalCentavos)}</span><span className="month">/mês</span></div>
            <ul className="features">
              <li>{limite(p.limites.armazenamentoGb," GB")} de armazenamento</li>
              <li>{limite(p.limites.galeriasAtivas)} galerias ativas</li>
              <li>{limite(p.limites.fotosPorGaleria)} fotos por galeria</li>
              <li>{limite(p.limites.clientes)} clientes</li>
              <li>Prova, comentários, senha e entrega final</li>
              <li>{p.recursos.heroPremiumTech?"Heroes Premium e Tech":"Hero do estúdio"}</li>
            </ul>
            <button disabled={ehAtual||ocupado} className={`plan-btn${codigo==="profissional"?" primary":""}`} onClick={()=>void escolher(codigo)}>{ehAtual?"Plano atual":processando===codigo?"Abrindo checkout…":"Escolher plano"}</button>
          </article>; })}
        </section>
        <p className="fine">A contratação é processada com segurança pela Stripe. O Fotura só altera o plano depois da confirmação recebida pelo webhook de cobrança.</p>
      </>}
    </div>
  </main>;
}
