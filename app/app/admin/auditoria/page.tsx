"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase-client";

type Evento = {
  id: number;
  admin_user_id: string;
  admin_email: string;
  admin_papel: string;
  acao: string;
  alvo_user_id: string | null;
  alvo_email: string;
  entidade: string;
  entidade_id: string | null;
  detalhes: Record<string, unknown>;
  criado_em: string;
};

function data(v: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(v));
}

export default function AdminAuditoriaPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data: sessao } = await supabase.auth.getSession();
      if (!sessao.session) { router.replace("/login"); return; }
      const resposta = await fetch("/api/admin/auditoria", { headers: { Authorization: `Bearer ${sessao.session.access_token}` }, cache: "no-store" });
      if (!ativo) return;
      if (resposta.status === 403) { setErro("Esta conta não possui acesso administrativo."); return; }
      if (!resposta.ok) { setErro("Não foi possível carregar a auditoria administrativa."); return; }
      const payload = await resposta.json() as { eventos: Evento[] };
      setEventos(payload.eventos ?? []);
    })();
    return () => { ativo = false; };
  }, [router, supabase]);

  const termo = busca.trim().toLowerCase();
  const filtrados = eventos.filter(e => !termo || [e.acao,e.admin_email,e.alvo_email,e.entidade,e.admin_papel].some(v => String(v ?? "").toLowerCase().includes(termo)));

  return <main className="aa"><style>{`
    .aa{min-height:100vh;background:linear-gradient(180deg,#090917,#0e0e20);color:#f0f0f5;padding:42px 5vw 80px;font-family:Sora,sans-serif}.wrap{max-width:1180px;margin:auto}.top{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.ey{font-size:11px;letter-spacing:2px;color:#6f76a0;text-transform:uppercase}.aa h1{font-size:30px;margin:7px 0 4px}.sub{color:#7a7f9a;font-size:13px}.back{border:1px solid #262841;background:#111126;color:#c8cbe0;border-radius:10px;padding:9px 12px;cursor:pointer}.toolbar{display:flex;justify-content:flex-end;margin:22px 0 12px}.search{width:min(420px,100%);background:#0e0e1c;border:1px solid #2a2d40;border-radius:10px;color:#f0f0f5;padding:10px 12px;font:12px inherit}.card{background:linear-gradient(180deg,#14142b,#101023);border:1px solid #23233c;border-radius:16px;padding:14px}.tablewrap{overflow:auto}.table{width:100%;border-collapse:collapse;min-width:950px}.table th,.table td{text-align:left;padding:11px 10px;border-bottom:1px solid #202238;font-size:11px;vertical-align:top}.table th{color:#777e9d;font-weight:600}.table td{color:#c8cbe0}.muted{color:#707793;font-size:10px;margin-top:3px}.action{font-weight:700;color:#f0f0f5}.pill{display:inline-flex;padding:4px 7px;border-radius:999px;background:#17172d;border:1px solid #2b2f45;font-size:10px}.err{margin-top:22px;color:#ff9d9d}.empty{color:#707793;padding:20px;font-size:12px}@media(max-width:600px){.aa{padding:28px 16px 60px}.top{flex-direction:column-reverse}.toolbar{justify-content:stretch}.search{width:100%;box-sizing:border-box}}
  `}</style><div className="wrap"><div className="top"><div><div className="ey">Fotura interno</div><h1>Auditoria administrativa</h1><div className="sub">Histórico interno de acessos e futuras ações administrativas controladas.</div></div><button className="back" onClick={()=>router.push("/admin")}>← Voltar ao admin</button></div>{erro&&<div className="err">{erro}</div>}<div className="toolbar"><input className="search" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por ação, administrador, conta ou entidade"/></div><section className="card"><div className="tablewrap"><table className="table"><thead><tr><th>Data</th><th>Ação</th><th>Administrador</th><th>Conta alvo</th><th>Entidade</th></tr></thead><tbody>{filtrados.map(e=><tr key={e.id}><td>{data(e.criado_em)}</td><td><div className="action">{e.acao}</div><div className="muted">#{e.id}</div></td><td><div>{e.admin_email || e.admin_user_id}</div><div className="muted">{e.admin_papel}</div></td><td>{e.alvo_user_id?<><div>{e.alvo_email || e.alvo_user_id}</div><div className="muted">{e.alvo_user_id}</div></>:"—"}</td><td><span className="pill">{e.entidade}</span>{e.entidade_id&&<div className="muted">{e.entidade_id}</div>}</td></tr>)}</tbody></table>{!filtrados.length&&<div className="empty">Nenhum evento encontrado.</div>}</div></section></div></main>;
}
