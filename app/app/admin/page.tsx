"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-client";

type Resumo = {
  papel: string;
  contas: number;
  assinantes: number;
  mrrCentavos: number;
  galerias: number;
  clientes: number;
  porPlano: Record<string, number>;
  porStatus: Record<string, number>;
};

type Conta = {
  id: string;
  email: string;
  criadoEm: string | null;
  confirmadoEm: string | null;
  ultimoLoginEm: string | null;
  nomeEstudio: string;
  plano: string;
  status: string;
  provedor: string | null;
  temAssinatura: boolean;
  periodoFim: string | null;
  cancelarNoFim: boolean;
  galerias: number;
  clientes: number;
};

export default function AdminPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [contas, setContas] = useState<Conta[]>([]);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) { router.replace("/login"); return; }
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [resumoRes, contasRes] = await Promise.all([
        fetch("/api/admin/resumo", { headers, cache: "no-store" }),
        fetch("/api/admin/contas", { headers, cache: "no-store" }),
      ]);
      if (!ativo) return;
      if (resumoRes.status === 403 || contasRes.status === 403) { setErro("Esta conta não possui acesso administrativo."); return; }
      if (!resumoRes.ok || !contasRes.ok) { setErro("Não foi possível carregar o painel administrativo."); return; }
      const [r, c] = await Promise.all([resumoRes.json(), contasRes.json()]);
      if (!ativo) return;
      setResumo(r as Resumo);
      setContas((c as { contas: Conta[] }).contas ?? []);
    })();
    return () => { ativo = false; };
  }, [router, supabase]);

  const dinheiro = (centavos: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);
  const data = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
  const contasFiltradas = contas.filter(c => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    return [c.email, c.nomeEstudio, c.plano, c.status].some(v => String(v).toLowerCase().includes(termo));
  });

  return <main className="adm"><style>{`.adm{min-height:100vh;background:linear-gradient(180deg,#090917,#0e0e20);color:#f0f0f5;padding:52px 6vw 80px;font-family:Sora,sans-serif}.wrap{max-width:1180px;margin:auto}.ey{font-size:11px;letter-spacing:2px;color:#6f76a0;text-transform:uppercase}.adm h1{font-size:32px;margin:8px 0}.sub{color:#7a7f9a;font-size:13px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-top:28px}.card{background:linear-gradient(180deg,#14142b,#101023);border:1px solid #23233c;border-radius:16px;padding:20px}.val{font-size:28px;font-weight:800}.lab{font-size:11px;color:#7f859f;margin-top:7px}.wide{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.rows{display:grid;gap:10px;margin-top:14px}.row{display:flex;justify-content:space-between;color:#aeb3c8;font-size:12px;padding-bottom:9px;border-bottom:1px solid #202238}.err{margin-top:24px;color:#ff9d9d}.accounts{margin-top:18px}.accounts-head{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:14px}.accounts-head h2{margin:0;font-size:18px}.search{width:min(360px,100%);background:#0e0e1c;border:1px solid #2a2d40;border-radius:10px;color:#f0f0f5;padding:10px 12px;font:12px inherit;box-sizing:border-box}.table-wrap{overflow:auto;border:1px solid #23233c;border-radius:14px}.table{width:100%;border-collapse:collapse;min-width:880px;background:#111124}.table th,.table td{text-align:left;padding:12px 13px;border-bottom:1px solid #202238;font-size:11px}.table th{color:#727995;font-weight:600;background:#14142b;position:sticky;top:0}.table td{color:#b8bdd1}.email{color:#f0f0f5;font-weight:600}.muted{color:#707791}.pill{display:inline-block;padding:4px 7px;border-radius:999px;background:#17172d;border:1px solid #2b2f45;color:#bec4dc;font-size:10px}.pill.good{color:#8fe3b0;border-color:rgba(143,227,176,.2);background:rgba(143,227,176,.06)}.pill.warn{color:#f6c445;border-color:rgba(246,196,69,.2);background:rgba(246,196,69,.06)}@media(max-width:950px){.grid{grid-template-columns:1fr 1fr}.wide{grid-template-columns:1fr}.accounts-head{align-items:flex-start;flex-direction:column}}@media(max-width:600px){.adm{padding:36px 18px}.grid{grid-template-columns:1fr}}`}</style><div className="wrap"><div className="ey">Fotura interno</div><h1>Administração</h1><p className="sub">Visão operacional de contas, assinaturas e uso da plataforma.</p>{erro && <div className="err">{erro}</div>}{resumo && <><section className="grid"><div className="card"><div className="val">{resumo.contas}</div><div className="lab">Contas</div></div><div className="card"><div className="val">{resumo.assinantes}</div><div className="lab">Assinantes pagos</div></div><div className="card"><div className="val">{dinheiro(resumo.mrrCentavos)}</div><div className="lab">MRR nominal</div></div><div className="card"><div className="val">{resumo.galerias}</div><div className="lab">Galerias</div></div><div className="card"><div className="val">{resumo.clientes}</div><div className="lab">Clientes</div></div></section><section className="wide"><div className="card"><strong>Distribuição por plano</strong><div className="rows">{Object.entries(resumo.porPlano).map(([k,v])=><div className="row" key={k}><span>{k.replace("_"," ")}</span><strong>{v}</strong></div>)}</div></div><div className="card"><strong>Status das assinaturas</strong><div className="rows">{Object.entries(resumo.porStatus).map(([k,v])=><div className="row" key={k}><span>{k}</span><strong>{v}</strong></div>)}</div></div></section><section className="accounts"><div className="accounts-head"><div><h2>Contas</h2><p className="sub">Consulta operacional somente leitura.</p></div><input className="search" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por e-mail, estúdio, plano ou status"/></div><div className="table-wrap"><table className="table"><thead><tr><th>Conta</th><th>Plano</th><th>Status</th><th>Galerias</th><th>Clientes</th><th>Cadastro</th><th>Último login</th></tr></thead><tbody>{contasFiltradas.map(c=><tr key={c.id}><td><div className="email">{c.email || "Sem e-mail"}</div><div className="muted">{c.nomeEstudio || "Estúdio não configurado"}</div></td><td><span className="pill">{c.plano.replace("_"," ")}</span></td><td><span className={`pill ${["active","trialing"].includes(c.status)?"good":c.status==="past_due"?"warn":""}`}>{c.status}</span>{c.cancelarNoFim && <div className="muted">Cancela no fim</div>}</td><td>{c.galerias}</td><td>{c.clientes}</td><td>{data(c.criadoEm)}</td><td>{data(c.ultimoLoginEm)}</td></tr>)}</tbody></table></div></section></>}</div></main>;
}
