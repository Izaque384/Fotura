"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MenuFotografo from "../../MenuFotografo";
import { PLANOS_FOTURA, type PlanoCodigo } from "../../../lib/billing-plans";
import { createClient } from "../../../lib/supabase-client";
import { registrarEventoProduto } from "../../../lib/product-analytics";

type StatusBilling = {
  plano: { codigo: PlanoCodigo; nome: string; descricao: string };
  status: string;
  provedor: string | null;
  temAssinatura: boolean;
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

function dataPlano(valor: string | null) {
  if (!valor) return null;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(valor));
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
        const statusCarregado = s as StatusBilling;
        const usageCarregado = u as UsageBilling;
        setStatus(statusCarregado);
        setUsage(usageCarregado);
        const limiteGb = usageCarregado.limites?.armazenamento?.limiteGb ?? null;
        const usoGb = usageCarregado.uso?.armazenamentoGb ?? 0;
        registrarEventoProduto("plan_page_view", {
          token: session.access_token,
          rota: "/dashboard/assinatura",
          detalhes: {
            plano: statusCarregado.plano.codigo,
            armazenamento_percentual: limiteGb && limiteGb > 0 ? Math.min(100, Math.round((usoGb / limiteGb) * 100)) : 0,
          },
        });
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
      registrarEventoProduto("plan_checkout_started", {
        token,
        rota: "/dashboard/assinatura",
        detalhes: {
          plano,
          plano_atual: status?.plano.codigo ?? "sem_plano",
          origem: "pagina_plano",
        },
      });
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

  const atual = status?.plano.codigo ?? "sem_plano";
  const planoAtual = PLANOS_FOTURA[atual];
  const armazenamentoUsado = usage?.uso.armazenamentoGb ?? 0;
  const gerenciadaStripe = Boolean(status?.temAssinatura);
  const statusRestrito = status ? ["canceled", "unpaid", "paused", "incomplete", "incomplete_expired"].includes(status.status) : false;
  const rotuloStatusAtual = atual === "sem_plano" ? "Sem assinatura" : statusLabel(status?.status ?? "active");
  const dataPeriodoFim = dataPlano(status?.periodoFim ?? null);

  return <main className="bill-page mf-shift">
    <MenuFotografo/>
    <style>{`
      .bill-page{min-height:100vh;box-sizing:border-box;background:linear-gradient(180deg,#F0EDF7 0%,#ECE8F4 100%);color:#21253A;padding:48px 5vw 82px calc(236px + 5vw)}
      .bill-wrap{width:100%;max-width:1180px;margin:0 auto}.bill-top{margin-bottom:20px}.bill-ey{font-size:10px;font-weight:800;letter-spacing:1.8px;color:#6B5BAE;text-transform:uppercase}.bill-h1{font-size:29px;letter-spacing:-.65px;margin:6px 0 5px}.bill-sub{margin:0;color:#73758D;font-size:12.5px;line-height:1.55;max-width:680px}
      .bill-notice{margin:0 0 16px;padding:11px 13px;border-radius:10px;border:1px solid #CFC6E3;background:#F7F3FC;color:#5E5678;font-size:11px}.bill-notice.err{border-color:#E7C7CC;background:#FAF0F2;color:#A0525D}
      .overview{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(330px,.92fr);gap:14px;margin-bottom:24px}.bill-card{background:rgba(250,248,253,.94);border:1px solid #DCD6EE;border-radius:16px;box-shadow:0 10px 28px rgba(65,52,111,.05);min-width:0}
      .subscription{padding:20px}.subscription-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.subscription-plan{margin-top:4px;font-size:25px;font-weight:800;letter-spacing:-.45px;color:#252A41}.status-tag{flex:none;border-radius:999px;padding:6px 9px;font-size:9px;font-weight:800;background:#E9F5EF;border:1px solid #CBE4D6;color:#3F7C5B}.subscription-desc{margin:8px 0 0;color:#73758D;font-size:11.5px;line-height:1.55;max-width:620px}.subscription-meta{display:flex;gap:7px;flex-wrap:wrap;margin-top:15px}.meta-chip{padding:7px 9px;border:1px solid #E0DAEB;border-radius:9px;background:#F7F4FB;color:#686E86;font-size:9.5px;font-weight:650}.meta-chip strong{color:#343950;margin-right:4px}.subscription-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.manage-btn{height:35px;border:1px solid #CDC4E0;border-radius:9px;background:#F4F0F9;color:#57506E;padding:0 12px;font-family:inherit;font-size:10.5px;font-weight:750;cursor:pointer}.manage-btn:hover{background:#ECE6F4}.manage-btn:disabled{opacity:.5;cursor:default}
      .usage{padding:20px}.usage-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:16px}.usage-title{font-size:14px;font-weight:800;color:#292E45}.usage-caption{font-size:9.5px;color:#85899B}.meter{margin-bottom:15px}.meter:last-child{margin-bottom:0}.meter-head{display:flex;justify-content:space-between;gap:12px;font-size:10.5px;margin-bottom:7px}.meter-head span:first-child{color:#5F657B;font-weight:700}.meter-head span:last-child{color:#777D93;font-weight:650}.track{height:6px;border-radius:999px;background:#E7E2EE;overflow:hidden}.fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,#1196FC,#5D0DFA)}
      
      .plans-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:13px}.plans-head h2{font-size:20px;letter-spacing:-.25px;margin:4px 0 0}.plans-head p{font-size:10.5px;color:#777D93;margin:0}.plans{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.plan{position:relative;padding:18px;display:flex;flex-direction:column;min-height:390px;background:#FAF8FD;border:1px solid #DCD6EE;border-radius:15px;box-shadow:0 8px 24px rgba(65,52,111,.04)}.plan.featured{border-color:#BEB3DB;box-shadow:0 12px 30px rgba(65,52,111,.09)}.plan.current-plan{border-color:#A9CDB8;box-shadow:0 10px 28px rgba(63,124,91,.08)}.recommended,.current-plan-tag{position:absolute;right:14px;top:13px;border-radius:999px;font-size:8px;font-weight:800;padding:5px 8px}.recommended{background:linear-gradient(90deg,#1196FC,#5D0DFA);color:#fff}.current-plan-tag{background:#E9F5EF;border:1px solid #CBE4D6;color:#3F7C5B}.plan-name{font-size:17px;font-weight:800;color:#2A2F46}.plan-desc{font-size:10.5px;line-height:1.5;color:#777D93;margin:6px 0 15px;min-height:46px}.storage-size{display:flex;align-items:baseline;gap:5px;margin-bottom:9px}.storage-size strong{font-size:25px;letter-spacing:-.5px;color:#292E45}.storage-size span{font-size:9.5px;color:#85899B}.price-row{display:flex;align-items:baseline;margin-bottom:2px}.price{font-size:27px;font-weight:800;letter-spacing:-.8px;color:#30354B}.month{font-size:10px;color:#7B8094;margin-left:4px}.features{display:grid;gap:8px;margin:16px 0 18px;padding:14px 0 0;border-top:1px solid #E7E2EE;list-style:none}.features li{font-size:10px;color:#626981;display:flex;gap:7px;line-height:1.4}.features li:before{content:"✓";color:#3F7C5B;font-weight:850}.plan-btn{margin-top:auto;width:100%;height:38px;border:1px solid #D0C8E2;border-radius:9px;background:#F4F0F9;color:#57506E;font-family:inherit;font-size:10.5px;font-weight:800;cursor:pointer}.plan-btn:hover:not(:disabled){background:#ECE6F4}.plan-btn.primary{border:0;background:linear-gradient(90deg,#1196FC,#5D0DFA);color:#fff}.plan-btn.current{background:#E9F5EF;border-color:#CBE4D6;color:#3F7C5B}.plan-btn:disabled{opacity:.72;cursor:default}.fine{font-size:9.5px;color:#7B8095;text-align:center;margin-top:14px;line-height:1.5}.loading{min-height:45vh;display:grid;place-items:center;color:#747B97}
      @media(max-width:1100px){.plans{grid-template-columns:1fr 1fr}.plan:last-child{grid-column:1/-1}}
      @media(max-width:980px){.bill-page{padding-left:calc(72px + 5vw)}.overview{grid-template-columns:1fr}.plans{grid-template-columns:1fr}.plan:last-child{grid-column:auto}.plan{min-height:0}}
      @media(max-width:640px){.bill-page{padding:78px 16px 60px}.bill-h1{font-size:25px}.plans-head{align-items:flex-start;flex-direction:column}.subscription,.usage,.plan{padding:16px}.subscription-top{align-items:flex-start}.subscription-meta{gap:6px}.plan-desc{min-height:0}}
    `}</style>
    <div className="bill-wrap">
      <div className="bill-top"><div><div className="bill-ey">Conta e cobrança</div><h1 className="bill-h1">Plano e assinatura</h1><p className="bill-sub">Veja seu plano atual, acompanhe o uso da conta e compare as opções disponíveis de forma simples.</p></div></div>
      {aviso && <div className="bill-notice">{aviso}</div>}
      {erro && <div className="bill-notice err">{erro}</div>}
      {carregando ? <div className="loading">Carregando assinatura…</div> : <>
        <section className="overview">
          <div className="bill-card subscription">
            <div className="subscription-top"><div><div className="bill-ey">Sua assinatura</div><div className="subscription-plan">{planoAtual.nome}</div></div><span className="status-tag">{rotuloStatusAtual}</span></div>
            <p className="subscription-desc">{planoAtual.descricao}</p>
            <div className="subscription-meta">
              <span className="meta-chip"><strong>Armazenamento</strong>{limite(planoAtual.limites.armazenamentoGb," GB")}</span>
              {gerenciadaStripe && <span className="meta-chip"><strong>Cobrança</strong>Stripe</span>}
              {dataPeriodoFim && <span className="meta-chip"><strong>{status?.cancelarNoFim?"Encerra em":"Próximo ciclo"}</strong>{dataPeriodoFim}</span>}
            </div>
            {gerenciadaStripe && <div className="subscription-actions"><button className="manage-btn" disabled={Boolean(processando)} onClick={()=>void gerenciar()}>{processando==="portal"?"Abrindo…":"Gerenciar assinatura"}</button></div>}
          </div>
          <div className="bill-card usage">
            <div className="usage-head"><div className="usage-title">Uso da conta</div><div className="usage-caption">Atualizado com seu consumo real</div></div>
            <div className="meter"><div className="meter-head"><span>Galerias ativas</span><span>{usage?.uso.galeriasAtivas ?? 0} / {limite(planoAtual.limites.galeriasAtivas)}</span></div><div className="track"><div className="fill" style={{width:`${percentual(usage?.uso.galeriasAtivas ?? 0, planoAtual.limites.galeriasAtivas)}%`}}/></div></div>
            <div className="meter"><div className="meter-head"><span>Clientes</span><span>{usage?.uso.clientes ?? 0} / {limite(planoAtual.limites.clientes)}</span></div><div className="track"><div className="fill" style={{width:`${percentual(usage?.uso.clientes ?? 0, planoAtual.limites.clientes)}%`}}/></div></div>
            <div className="meter"><div className="meter-head"><span>Armazenamento</span><span>{armazenamentoUsado.toLocaleString("pt-BR",{maximumFractionDigits:2})} GB / {limite(planoAtual.limites.armazenamentoGb," GB")}</span></div><div className="track"><div className="fill" style={{width:`${percentual(armazenamentoUsado, planoAtual.limites.armazenamentoGb)}%`}}/></div></div>
          </div>
        </section>

        <div className="plans-head"><div><div className="bill-ey">Planos pagos</div><h2>Escolha o espaço que combina com seu volume de trabalho</h2></div><p>Todos incluem galerias, clientes e fotos por galeria ilimitados.</p></div>
        <section className="plans">
          {comerciais.map((codigo) => { const p=PLANOS_FOTURA[codigo]; const ehAtual=atual===codigo && !statusRestrito; const ocupado=Boolean(processando); return <article key={codigo} className={`plan${codigo==="profissional"?" featured":""}${ehAtual?" current-plan":""}`}>
            {ehAtual ? <span className="current-plan-tag">SEU PLANO</span> : codigo==="profissional" ? <span className="recommended">MAIS ESCOLHIDO</span> : null}
            <div className="plan-name">{p.nome}</div><div className="plan-desc">{p.descricao}</div>
            <div className="storage-size"><strong>{limite(p.limites.armazenamentoGb," GB")}</strong><span>de armazenamento</span></div>
            <div className="price-row"><span className="price">{dinheiro(p.precoMensalCentavos)}</span><span className="month">/mês</span></div>
            <ul className="features">
              <li>Galerias ativas ilimitadas</li>
              <li>Fotos por galeria ilimitadas</li>
              <li>Clientes ilimitados</li>
              <li>Prova, comentários, senha e entrega final</li>
              <li>{p.recursos.heroPremiumTech?"Heroes Premium e Tech":"Hero do estúdio"}</li>
            </ul>
            <button disabled={ehAtual||ocupado} className={`plan-btn${codigo==="profissional"&&!ehAtual?" primary":""}${ehAtual?" current":""}`} onClick={()=>void escolher(codigo)}>{ehAtual?"Plano atual":processando===codigo?"Abrindo checkout…":"Escolher plano"}</button>
          </article>; })}
        </section>
        <p className="fine">A contratação é processada com segurança pela Stripe. O Fotura só altera o plano depois da confirmação recebida pelo webhook de cobrança.</p>
      </>}
    </div>
  </main>;
}