"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase-client";

type Check = { id: string; nome: string; status: "ok" | "warn" | "error"; detalhe: string };
type Payload = {
  geral: "ok" | "warn" | "error";
  checks: Check[];
  resumo: { erros: number; avisos: number; saudaveis: number; total: number };
  verificadoEm: string;
};

export default function AdminSaudePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [dados, setDados] = useState<Payload | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true); setErro("");
    const { data } = await supabase.auth.getSession();
    if (!data.session) { router.replace("/login"); return; }
    const resposta = await fetch("/api/admin/saude", {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      cache: "no-store",
    });
    if (resposta.status === 403) { setErro("Esta conta não possui acesso administrativo."); setCarregando(false); return; }
    const payload = await resposta.json().catch(() => ({})) as Payload & { error?: string };
    if (!resposta.ok) { setErro(payload.error || "Não foi possível verificar a saúde do sistema."); setCarregando(false); return; }
    setDados(payload); setCarregando(false);
  }

  useEffect(() => { void carregar(); }, []);

  const titulo = dados?.geral === "ok" ? "Sistema saudável" : dados?.geral === "warn" ? "Sistema requer atenção" : "Ação necessária";
  const hora = dados?.verificadoEm ? new Date(dados.verificadoEm).toLocaleString("pt-BR") : "—";

  return <main className="hs"><style>{`
    .hs{min-height:100vh;background:linear-gradient(180deg,#090917,#0e0e20);color:#f0f0f5;padding:46px 6vw 80px;font-family:Sora,sans-serif}.wrap{max-width:1080px;margin:auto}.top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.ey{font-size:11px;letter-spacing:2px;color:#6f76a0;text-transform:uppercase}.hs h1{font-size:30px;margin:7px 0}.sub{font-size:12px;color:#7a7f9a}.actions{display:flex;gap:8px}.btn{border:1px solid #303552;background:#15172d;color:#d8dcf2;border-radius:10px;padding:9px 12px;font:11px inherit;cursor:pointer}.hero{margin-top:24px;border:1px solid #23233c;background:linear-gradient(180deg,#14142b,#101023);border-radius:16px;padding:20px}.state{font-size:24px;font-weight:800}.ok{color:#8fe3b0}.warn{color:#f6c445}.error{color:#ff9d9d}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:14px}.metric{border:1px solid #242740;border-radius:12px;padding:14px;background:#111124}.metric b{display:block;font-size:22px}.metric span{font-size:10px;color:#7f859f}.checks{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.check{border:1px solid #23233c;background:#111124;border-radius:14px;padding:16px}.ch{display:flex;align-items:center;justify-content:space-between;gap:12px}.name{font-size:13px;font-weight:700}.pill{padding:4px 8px;border-radius:999px;border:1px solid #303552;font-size:9px;text-transform:uppercase;letter-spacing:.6px}.pill.ok{border-color:rgba(143,227,176,.25);background:rgba(143,227,176,.06)}.pill.warn{border-color:rgba(246,196,69,.25);background:rgba(246,196,69,.06)}.pill.error{border-color:rgba(255,157,157,.3);background:rgba(255,157,157,.06)}.detail{margin-top:9px;color:#9197af;font-size:11px;line-height:1.55}.err{margin-top:20px;color:#ff9d9d}.loading{margin-top:24px;color:#7a7f9a}@media(max-width:760px){.checks{grid-template-columns:1fr}.metrics{grid-template-columns:1fr 1fr}.top{flex-direction:column}.actions{width:100%}.btn{flex:1}}`}</style><div className="wrap">
      <div className="top"><div><div className="ey">Fotura interno · Operação</div><h1>Saúde do sistema</h1><div className="sub">Verificações server-side das dependências críticas e filas operacionais.</div></div><div className="actions"><button className="btn" onClick={()=>router.push("/admin")}>← Administração</button><button className="btn" onClick={()=>void carregar()} disabled={carregando}>Atualizar</button></div></div>
      {carregando && !dados && <div className="loading">Executando verificações…</div>}
      {erro && <div className="err">{erro}</div>}
      {dados && <><section className="hero"><div className={`state ${dados.geral}`}>{titulo}</div><div className="sub" style={{marginTop:6}}>Última verificação: {hora}</div><div className="metrics"><div className="metric"><b>{dados.resumo.saudaveis}</b><span>saudáveis</span></div><div className="metric"><b className="warn">{dados.resumo.avisos}</b><span>avisos</span></div><div className="metric"><b className="error">{dados.resumo.erros}</b><span>erros</span></div><div className="metric"><b>{dados.resumo.total}</b><span>checks</span></div></div></section><section className="checks">{dados.checks.map(c=><article className="check" key={c.id}><div className="ch"><div className="name">{c.nome}</div><span className={`pill ${c.status}`}>{c.status === "ok" ? "OK" : c.status === "warn" ? "Atenção" : "Erro"}</span></div><div className="detail">{c.detalhe}</div></article>)}</section></>}
    </div></main>;
}
