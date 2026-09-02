"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase-client";
import AdminActions from "./AdminActions";
import AdminClosure from "./AdminClosure";

type ContaDetalhe = {
  id: string;
  email: string;
  criadoEm: string | null;
  confirmadoEm: string | null;
  ultimoLoginEm: string | null;
  telefone: string | null;
  perfil: { nome_estudio?: string | null; logo_url?: string | null; hero_galeria_ativo?: boolean; hero_galeria_estilo?: string } | null;
  assinatura: { plano_codigo?: string; status?: string; provedor?: string | null; provedor_cliente_id?: string | null; provedor_assinatura_id?: string | null; periodo_inicio?: string | null; periodo_fim?: string | null; cancelar_no_fim?: boolean } | null;
  suspensao: { ativa?: boolean; motivo?: string | null; suspenso_por?: string | null; suspenso_em?: string | null; reativado_por?: string | null; reativado_em?: string | null } | null;
  takedownPublico: { ativo?: boolean; motivo?: string | null; criado_por?: string | null; criado_em?: string | null; atualizado_por?: string | null; atualizado_em?: string | null; removido_por?: string | null; removido_em?: string | null } | null;
  encerramento: { status?: "pendente" | "confirmado" | "cancelado" | "executado"; motivo?: string | null; solicitado_por?: string | null; solicitado_em?: string | null; elegivel_em?: string | null; cancelado_por?: string | null; cancelado_em?: string | null; confirmado_por?: string | null; confirmado_em?: string | null; executado_por?: string | null; executado_em?: string | null } | null;
  uso: { galeriasAtivas: number; clientes: number; armazenamentoBytes: number; armazenamentoGb: number };
  limites: {
    galeriasAtivas: { usado: number; limite: number | null; excedido: boolean };
    clientes: { usado: number; limite: number | null; excedido: boolean };
    armazenamento: { usadoBytes: number; usadoGb: number; limiteGb: number | null; excedido: boolean };
  };
  planoEfetivo: { codigo: string; nome: string };
  planoPersistido: { codigo: string; nome: string };
  galerias: Array<{ id: string; titulo: string; etapa: string; prova: boolean; criado_em: string; link_ate: string | null; storage_limpo: boolean | null }>;
  clientes: Array<{ id: string; nome: string; email: string | null; telefone: string | null; criado_em: string }>;
  auditoria: Array<{ id: number; admin_user_id: string; admin_papel: string; acao: string; entidade: string; entidade_id: string | null; detalhes: Record<string, unknown>; criado_em: string }>;
};

function data(v?: string | null) {
  if (!v) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(v));
}

function numero(v: number) { return new Intl.NumberFormat("pt-BR").format(v); }

export default function AdminContaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [conta, setConta] = useState<ContaDetalhe | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data: sessao } = await supabase.auth.getSession();
      if (!sessao.session) { router.replace("/login"); return; }
      const resposta = await fetch(`/api/admin/contas/${params.id}`, {
        headers: { Authorization: `Bearer ${sessao.session.access_token}` },
        cache: "no-store",
      });
      if (!ativo) return;
      if (resposta.status === 403) { setErro("Esta conta não possui acesso administrativo."); setCarregando(false); return; }
      if (!resposta.ok) { setErro("Não foi possível carregar os detalhes desta conta."); setCarregando(false); return; }
      const payload = await resposta.json() as { conta: ContaDetalhe };
      setConta(payload.conta);
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [params.id, router, supabase]);

  return <main className="ac"><style>{`
    .ac{min-height:100vh;background:linear-gradient(180deg,#090917,#0e0e20);color:#f0f0f5;padding:42px 5vw 80px;font-family:Sora,sans-serif}.wrap{max-width:1180px;margin:auto}.top{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.back{border:1px solid #262841;background:#111126;color:#c8cbe0;border-radius:10px;padding:9px 12px;cursor:pointer}.ey{font-size:11px;letter-spacing:2px;color:#6f76a0;text-transform:uppercase}.ac h1{font-size:30px;margin:7px 0 4px}.sub{color:#7a7f9a;font-size:13px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:24px}.card{background:linear-gradient(180deg,#14142b,#101023);border:1px solid #23233c;border-radius:16px;padding:18px}.val{font-size:23px;font-weight:800}.lab{font-size:11px;color:#7f859f;margin-top:6px}.sections{display:grid;grid-template-columns:1.15fr .85fr;gap:14px;margin-top:14px}.title{font-size:14px;font-weight:700;margin-bottom:13px}.rows{display:grid;gap:10px}.row{display:flex;justify-content:space-between;gap:18px;padding-bottom:9px;border-bottom:1px solid #202238;font-size:12px}.row span:first-child{color:#7f859f}.status{display:inline-flex;padding:4px 8px;border-radius:999px;border:1px solid #2b2e4a;background:#13152b;font-size:10px}.alert{margin-top:14px;border-radius:14px;padding:14px 16px}.alert strong{display:block}.alert p{color:#b6bbcf;font-size:11px;line-height:1.6;margin:7px 0 0}.susp{border:1px solid rgba(255,157,157,.28);background:rgba(255,157,157,.06)}.susp strong{color:#ffb1b1}.take{border:1px solid rgba(246,196,69,.28);background:rgba(246,196,69,.06)}.take strong{color:#f6d36a}.closing{border:1px solid rgba(255,157,157,.4);background:rgba(110,24,40,.13)}.closing strong{color:#ffc1c1}.tablecard{margin-top:14px}.tablewrap{overflow:auto}.table{width:100%;border-collapse:collapse;min-width:760px}.table th,.table td{text-align:left;padding:11px 9px;border-bottom:1px solid #202238;font-size:11px}.table th{color:#777e9d;font-weight:600}.table td{color:#c8cbe0}.audit{display:grid;gap:9px}.auditItem{border:1px solid #202238;border-radius:11px;padding:11px 12px}.auditTop{display:flex;justify-content:space-between;gap:12px;font-size:11px}.auditMeta{font-size:10px;color:#707793;margin-top:5px}.empty{color:#707793;font-size:12px;padding:12px 0}.err{margin-top:22px;color:#ff9d9d}.warn{color:#f6c445}.ok{color:#8fe3b0}@media(max-width:900px){.grid{grid-template-columns:1fr 1fr}.sections{grid-template-columns:1fr}}@media(max-width:560px){.ac{padding:28px 16px 60px}.grid{grid-template-columns:1fr}.top{flex-direction:column-reverse}}
  `}</style><div className="wrap">
    <div className="top"><div><div className="ey">Fotura interno · Conta</div><h1>{conta?.perfil?.nome_estudio?.trim() || conta?.email || "Detalhes da conta"}</h1><div className="sub">{conta?.email || "Carregando informações operacionais…"}</div></div><button className="back" onClick={() => router.push("/admin")}>← Voltar ao admin</button></div>

    {carregando && <div className="sub" style={{marginTop:24}}>Carregando conta…</div>}
    {erro && <div className="err">{erro}</div>}
    {conta && <>
      {conta.encerramento?.status === "pendente" && <section className="alert closing"><strong>Encerramento administrativo pendente</strong><p>{conta.encerramento.motivo || "Sem motivo informado."} · confirmação disponível em {data(conta.encerramento.elegivel_em)}</p></section>}
      {(conta.encerramento?.status === "confirmado" || conta.encerramento?.status === "executado") && <section className="alert closing"><strong>Encerramento administrativo confirmado</strong><p>Conta operacionalmente encerrada. Dados ainda preservados até uma etapa explícita de exclusão definitiva.</p></section>}
      {conta.suspensao?.ativa && <section className="alert susp"><strong>Conta suspensa administrativamente</strong><p>{conta.suspensao.motivo || "Sem motivo informado."} · desde {data(conta.suspensao.suspenso_em)}</p></section>}
      {conta.takedownPublico?.ativo && <section className="alert take"><strong>Galerias públicas bloqueadas temporariamente</strong><p>{conta.takedownPublico.motivo || "Sem motivo informado."} · desde {data(conta.takedownPublico.atualizado_em || conta.takedownPublico.criado_em)}</p></section>}
      <section className="grid">
        <div className="card"><div className="val">{conta.planoEfetivo.nome}</div><div className="lab">Plano efetivo</div></div>
        <div className="card"><div className="val">{numero(conta.uso.galeriasAtivas)}</div><div className="lab">Galerias ativas{conta.limites.galeriasAtivas.limite!==null?` / ${conta.limites.galeriasAtivas.limite}`:""}</div></div>
        <div className="card"><div className="val">{numero(conta.uso.clientes)}</div><div className="lab">Clientes{conta.limites.clientes.limite!==null?` / ${conta.limites.clientes.limite}`:""}</div></div>
        <div className="card"><div className="val">{conta.uso.armazenamentoGb.toFixed(2)} GB</div><div className="lab">Armazenamento{conta.limites.armazenamento.limiteGb!==null?` / ${conta.limites.armazenamento.limiteGb} GB`:""}</div></div>
      </section>

      <section className="sections">
        <div className="card"><div className="title">Conta e assinatura</div><div className="rows">
          <div className="row"><span>Status</span><strong className="status">{conta.assinatura?.status ?? "sem assinatura"}</strong></div>
          <div className="row"><span>Encerramento</span><strong className={conta.encerramento?.status === "pendente" || conta.encerramento?.status === "confirmado" ? "warn" : "ok"}>{conta.encerramento?.status ?? "nenhum"}</strong></div>
          <div className="row"><span>Acesso administrativo</span><strong className={conta.suspensao?.ativa?"warn":"ok"}>{conta.suspensao?.ativa ? "Suspenso" : "Normal"}</strong></div>
          <div className="row"><span>Conteúdo público</span><strong className={conta.takedownPublico?.ativo?"warn":"ok"}>{conta.takedownPublico?.ativo ? "Bloqueado" : "Disponível"}</strong></div>
          <div className="row"><span>Plano persistido</span><strong>{conta.planoPersistido.nome}</strong></div>
          <div className="row"><span>Criada em</span><strong>{data(conta.criadoEm)}</strong></div>
          <div className="row"><span>E-mail confirmado</span><strong>{conta.confirmadoEm ? data(conta.confirmadoEm) : "Não"}</strong></div>
          <div className="row"><span>Último login</span><strong>{data(conta.ultimoLoginEm)}</strong></div>
          <div className="row"><span>Período atual</span><strong>{data(conta.assinatura?.periodo_inicio)} → {data(conta.assinatura?.periodo_fim)}</strong></div>
          <div className="row"><span>Cancelamento no fim</span><strong className={conta.assinatura?.cancelar_no_fim?"warn":"ok"}>{conta.assinatura?.cancelar_no_fim ? "Sim" : "Não"}</strong></div>
          <div className="row"><span>Stripe customer</span><strong>{conta.assinatura?.provedor_cliente_id ?? "—"}</strong></div>
          <div className="row"><span>Stripe subscription</span><strong>{conta.assinatura?.provedor_assinatura_id ?? "—"}</strong></div>
        </div></div>
        <div className="card"><div className="title">Perfil do estúdio</div><div className="rows">
          <div className="row"><span>Nome</span><strong>{conta.perfil?.nome_estudio || "—"}</strong></div>
          <div className="row"><span>Hero personalizado</span><strong>{conta.perfil?.hero_galeria_ativo ? "Ativo" : "Desativado"}</strong></div>
          <div className="row"><span>Estilo do hero</span><strong>{conta.perfil?.hero_galeria_estilo || "—"}</strong></div>
          <div className="row"><span>ID da conta</span><strong style={{fontSize:10}}>{conta.id}</strong></div>
        </div></div>
      </section>

      <AdminActions userId={conta.id} temStripe={Boolean(conta.assinatura?.provedor === "stripe" && conta.assinatura?.provedor_assinatura_id)} suspenso={Boolean(conta.suspensao?.ativa)} takedownPublico={Boolean(conta.takedownPublico?.ativo)} />
      <AdminClosure userId={conta.id} encerramento={conta.encerramento} />

      <section className="card tablecard"><div className="title">Galerias recentes</div><div className="tablewrap"><table className="table"><thead><tr><th>Título</th><th>Etapa</th><th>Tipo</th><th>Criada em</th><th>Link até</th><th>Storage limpo</th></tr></thead><tbody>{conta.galerias.map(g=><tr key={g.id}><td>{g.titulo || "Sem título"}</td><td>{g.etapa}</td><td>{g.prova?"Prova":"Entrega"}</td><td>{data(g.criado_em)}</td><td>{g.link_ate || "—"}</td><td>{g.storage_limpo?"Sim":"Não"}</td></tr>)}</tbody></table>{!conta.galerias.length&&<div className="empty">Nenhuma galeria.</div>}</div></section>

      <section className="card tablecard"><div className="title">Clientes recentes</div><div className="tablewrap"><table className="table"><thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Criado em</th></tr></thead><tbody>{conta.clientes.map(c=><tr key={c.id}><td>{c.nome}</td><td>{c.email || "—"}</td><td>{c.telefone || "—"}</td><td>{data(c.criado_em)}</td></tr>)}</tbody></table>{!conta.clientes.length&&<div className="empty">Nenhum cliente.</div>}</div></section>

      <section className="card tablecard"><div className="title">Auditoria administrativa desta conta</div><div className="audit">{conta.auditoria.map(a=><div className="auditItem" key={a.id}><div className="auditTop"><strong>{a.acao}</strong><span>{data(a.criado_em)}</span></div><div className="auditMeta">Papel: {a.admin_papel} · Entidade: {a.entidade}{a.entidade_id?` · ${a.entidade_id}`:""}</div></div>)}{!conta.auditoria.length&&<div className="empty">Nenhuma ação administrativa anterior registrada.</div>}</div></section>
    </>}
  </div></main>;
}
