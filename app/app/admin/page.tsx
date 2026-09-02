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

export default function AdminPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) { router.replace("/login"); return; }
      const resposta = await fetch("/api/admin/resumo", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      if (!ativo) return;
      if (resposta.status === 403) { setErro("Esta conta não possui acesso administrativo."); return; }
      if (!resposta.ok) { setErro("Não foi possível carregar o painel administrativo."); return; }
      setResumo(await resposta.json() as Resumo);
    })();
    return () => { ativo = false; };
  }, [router, supabase]);

  const dinheiro = (centavos: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);

  return <main className="adm"><style>{`.adm{min-height:100vh;background:linear-gradient(180deg,#090917,#0e0e20);color:#f0f0f5;padding:52px 6vw 80px;font-family:Sora,sans-serif}.wrap{max-width:1120px;margin:auto}.ey{font-size:11px;letter-spacing:2px;color:#6f76a0;text-transform:uppercase}.adm h1{font-size:32px;margin:8px 0}.sub{color:#7a7f9a;font-size:13px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-top:28px}.card{background:linear-gradient(180deg,#14142b,#101023);border:1px solid #23233c;border-radius:16px;padding:20px}.val{font-size:28px;font-weight:800}.lab{font-size:11px;color:#7f859f;margin-top:7px}.wide{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.rows{display:grid;gap:10px;margin-top:14px}.row{display:flex;justify-content:space-between;color:#aeb3c8;font-size:12px;padding-bottom:9px;border-bottom:1px solid #202238}.err{margin-top:24px;color:#ff9d9d}@media(max-width:950px){.grid{grid-template-columns:1fr 1fr}.wide{grid-template-columns:1fr}}@media(max-width:600px){.adm{padding:36px 18px}.grid{grid-template-columns:1fr}}`}</style><div className="wrap"><div className="ey">Fotura interno</div><h1>Administração</h1><p className="sub">Visão operacional de contas, assinaturas e uso da plataforma.</p>{erro && <div className="err">{erro}</div>}{resumo && <><section className="grid"><div className="card"><div className="val">{resumo.contas}</div><div className="lab">Contas</div></div><div className="card"><div className="val">{resumo.assinantes}</div><div className="lab">Assinantes pagos</div></div><div className="card"><div className="val">{dinheiro(resumo.mrrCentavos)}</div><div className="lab">MRR nominal</div></div><div className="card"><div className="val">{resumo.galerias}</div><div className="lab">Galerias</div></div><div className="card"><div className="val">{resumo.clientes}</div><div className="lab">Clientes</div></div></section><section className="wide"><div className="card"><strong>Distribuição por plano</strong><div className="rows">{Object.entries(resumo.porPlano).map(([k,v])=><div className="row" key={k}><span>{k.replace("_"," ")}</span><strong>{v}</strong></div>)}</div></div><div className="card"><strong>Status das assinaturas</strong><div className="rows">{Object.entries(resumo.porStatus).map(([k,v])=><div className="row" key={k}><span>{k}</span><strong>{v}</strong></div>)}</div></div></section></>}</div></main>;
}
