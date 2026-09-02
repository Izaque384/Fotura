"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../../lib/supabase-client";

type Encerramento = {
  status?: "pendente" | "confirmado" | "cancelado" | "executado";
  motivo?: string | null;
  solicitado_em?: string | null;
  elegivel_em?: string | null;
  cancelado_em?: string | null;
  confirmado_em?: string | null;
} | null;

type Purge = {
  status?: "nao_agendado" | "agendado" | "cancelado" | "executado";
  motivo?: string | null;
  agendado_em?: string | null;
  elegivel_em?: string | null;
  cancelado_em?: string | null;
  executado_em?: string | null;
  execucao_etapa?: "nao_iniciada" | "storage" | "banco" | "auth" | "concluido" | "falhou";
  execucao_erro?: string | null;
} | null;

type Preview = {
  auth_usuario?: number; galerias?: number; clientes?: number; selecoes?: number; senhas?: number;
  push_subscriptions?: number; perfil?: number; assinatura?: number; admin_suspensao?: number;
  admin_takedown?: number; admin_encerramento?: number; admin_purge?: number;
  storage_fotos_objetos?: number; storage_fotos_bytes?: number; storage_marca_objetos?: number;
  storage_marca_bytes?: number; admin_auditoria_preservada?: boolean;
};

type PurgePayload = {
  purge: Purge;
  preview: Preview | null;
  alvoEmail?: string | null;
  podeCancelar?: boolean;
  podeExecutar?: boolean;
  exclusaoFisicaHabilitada: boolean;
  prazoDias: number;
};

function data(v?: string | null) {
  if (!v) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(v));
}
function numero(v?: number) { return new Intl.NumberFormat("pt-BR").format(Number(v ?? 0)); }
function bytes(v?: number) {
  const n = Number(v ?? 0);
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function AdminClosure({ userId, encerramento }: { userId: string; encerramento: Encerramento }) {
  const supabase = useMemo(() => createClient(), []);
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [purge, setPurge] = useState<Purge>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [alvoEmail, setAlvoEmail] = useState("");
  const [podeCancelarPurge, setPodeCancelarPurge] = useState(false);
  const [podeExecutarPurge, setPodeExecutarPurge] = useState(false);
  const [purgeMotivo, setPurgeMotivo] = useState("");
  const [purgeConfirmacao, setPurgeConfirmacao] = useState("");
  const [purgeEmail, setPurgeEmail] = useState("");
  const [purgeErro, setPurgeErro] = useState("");
  const [purgeMensagem, setPurgeMensagem] = useState("");
  const [purgeCarregando, setPurgeCarregando] = useState(false);

  const pendente = encerramento?.status === "pendente";
  const confirmado = encerramento?.status === "confirmado" || encerramento?.status === "executado";
  const elegivel = Boolean(pendente && encerramento?.elegivel_em && Date.now() >= new Date(encerramento.elegivel_em).getTime());
  const purgeAgendado = purge?.status === "agendado";

  useEffect(() => {
    if (!confirmado) return;
    let ativo = true;
    void (async () => {
      setPurgeCarregando(true);
      const { data } = await supabase.auth.getSession();
      if (!data.session) { setPurgeCarregando(false); return; }
      const resposta = await fetch(`/api/admin/contas/${userId}/purge`, { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store" });
      if (!ativo) return;
      if (!resposta.ok) { setPurgeErro("Não foi possível carregar a prévia do purge."); setPurgeCarregando(false); return; }
      const payload = await resposta.json() as PurgePayload;
      setPurge(payload.purge);
      setPreview(payload.preview);
      setAlvoEmail(payload.alvoEmail ?? "");
      setPodeCancelarPurge(Boolean(payload.podeCancelar));
      setPodeExecutarPurge(Boolean(payload.podeExecutar));
      setPurgeCarregando(false);
    })();
    return () => { ativo = false; };
  }, [confirmado, supabase, userId]);

  async function executar(acao: "solicitar" | "cancelar" | "confirmar") {
    setMensagem(""); setErro("");
    if (motivo.trim().length < 8) { setErro("Informe um motivo com pelo menos 8 caracteres."); return; }
    if (acao === "confirmar" && confirmacao.trim().toUpperCase() !== "ENCERRAR") { setErro("Digite ENCERRAR para confirmar esta etapa."); return; }
    setOcupado(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { setErro("Sessão expirada."); return; }
      const resposta = await fetch(`/api/admin/contas/${userId}/encerramento`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ acao, motivo: motivo.trim(), confirmacao: confirmacao.trim() }) });
      const payload = await resposta.json().catch(() => ({})) as { error?: string; mensagem?: string };
      if (!resposta.ok) { setErro(payload.error || "Não foi possível concluir a ação."); return; }
      setMensagem(payload.mensagem || "Ação concluída.");
      window.setTimeout(() => window.location.reload(), 800);
    } catch { setErro("Falha de rede ao executar a ação."); }
    finally { setOcupado(false); }
  }

  async function executarPurge(acao: "agendar" | "cancelar" | "executar") {
    setPurgeMensagem(""); setPurgeErro("");
    if (purgeMotivo.trim().length < 8) { setPurgeErro("Informe um motivo com pelo menos 8 caracteres."); return; }
    if (acao === "agendar" && purgeConfirmacao.trim().toUpperCase() !== "PURGAR") { setPurgeErro("Digite PURGAR para armar a exclusão definitiva."); return; }
    if (acao === "executar") {
      if (purgeConfirmacao.trim().toUpperCase() !== "PURGAR DEFINITIVO") { setPurgeErro("Digite PURGAR DEFINITIVO para executar a exclusão física."); return; }
      if (!alvoEmail || purgeEmail.trim().toLowerCase() !== alvoEmail.trim().toLowerCase()) { setPurgeErro("Digite exatamente o e-mail da conta para confirmar."); return; }
    }
    setPurgeCarregando(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { setPurgeErro("Sessão expirada."); return; }
      const resposta = await fetch(`/api/admin/contas/${userId}/purge`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ acao, motivo: purgeMotivo.trim(), confirmacao: purgeConfirmacao.trim(), emailConfirmacao: purgeEmail.trim() }) });
      const payload = await resposta.json().catch(() => ({})) as { error?: string; mensagem?: string };
      if (!resposta.ok) { setPurgeErro(payload.error || "Não foi possível concluir a ação."); return; }
      setPurgeMensagem(payload.mensagem || "Ação concluída.");
      window.setTimeout(() => window.location.reload(), 1000);
    } catch { setPurgeErro("Falha de rede ao executar a ação."); }
    finally { setPurgeCarregando(false); }
  }

  return <>
    <section className="cl-card">
      <style>{`.cl-card,.pg-card{margin-top:14px;background:linear-gradient(180deg,#171222,#100f1d);border:1px solid rgba(255,157,157,.2);border-radius:16px;padding:18px}.cl-title,.pg-title{font-size:14px;font-weight:800;color:#f0f0f5}.cl-sub,.pg-sub{font-size:11px;color:#8f95ad;line-height:1.6;margin:6px 0 14px}.cl-state,.pg-state{padding:11px 12px;border:1px solid #30253a;border-radius:11px;background:#120f1d;font-size:11px;color:#c8cbe0;margin-bottom:13px}.cl-state strong,.pg-state strong{color:#ffb1b1}.cl-grid,.pg-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cl-field,.pg-field{display:grid;gap:6px}.cl-field label,.pg-field label{font-size:10px;color:#8f95ad}.cl-field textarea,.cl-field input,.pg-field textarea,.pg-field input{width:100%;box-sizing:border-box;background:#0d0c17;border:1px solid #34243d;border-radius:10px;color:#f0f0f5;padding:10px;font:12px inherit}.cl-field textarea,.pg-field textarea{min-height:78px;resize:vertical}.cl-actions,.pg-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px}.cl-btn,.pg-btn{border:1px solid #4c3042;background:#1b111a;color:#ffb8b8;border-radius:9px;padding:9px 12px;font:11px inherit;cursor:pointer}.cl-btn.cancel,.pg-btn.cancel{border-color:#39415e;background:#17192a;color:#d6dbf1}.cl-btn.confirm,.pg-btn.arm{background:#4a171f;border-color:#76303a;color:#fff}.pg-btn.execute{background:#7c1725;border-color:#b03b4e;color:#fff;font-weight:700}.cl-btn:disabled,.pg-btn:disabled{opacity:.45;cursor:not-allowed}.cl-note,.pg-note{font-size:10px;color:#8f95ad;margin-top:10px;line-height:1.55}.cl-ok,.pg-ok{font-size:11px;color:#8fe3b0;margin-top:10px}.cl-err,.pg-err{font-size:11px;color:#ff9d9d;margin-top:10px}.pg-card{border-color:rgba(255,105,120,.32);background:linear-gradient(180deg,#1a1019,#100d15)}.pg-title{color:#ffc2c7}.pg-preview{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.pg-metric{border:1px solid #322233;background:#100d16;border-radius:10px;padding:10px}.pg-metric b{display:block;font-size:16px}.pg-metric span{font-size:9px;color:#8f95ad}.pg-safe{padding:10px 12px;border:1px solid rgba(143,227,176,.2);background:rgba(143,227,176,.05);border-radius:10px;color:#9ceabb;font-size:10px;margin-top:10px}.pg-danger{padding:10px 12px;border:1px solid rgba(255,105,120,.35);background:rgba(255,105,120,.07);border-radius:10px;color:#ffc2c7;font-size:10px;margin-top:10px}@media(max-width:720px){.cl-grid,.pg-grid{grid-template-columns:1fr}.pg-preview{grid-template-columns:1fr 1fr}}`}</style>
      <div className="cl-title">Encerramento administrativo</div>
      <div className="cl-sub">Fluxo protegido em duas etapas. Marcar para encerramento não apaga nada. A confirmação final só fica disponível após 7 dias.</div>
      <div className="cl-state">{!encerramento || encerramento.status === "cancelado" ? <strong>Nenhum encerramento pendente.</strong> : null}{pendente ? <><strong>Encerramento pendente.</strong> Solicitado em {data(encerramento?.solicitado_em)} · confirmação disponível em {data(encerramento?.elegivel_em)}.</> : null}{confirmado ? <><strong>Encerramento confirmado.</strong> Conta suspensa e conteúdo público bloqueado.</> : null}</div>
      <div className="cl-grid"><div className="cl-field"><label>Motivo obrigatório</label><textarea value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Ex.: solicitação formal do titular, encerramento por política interna..." /></div><div className="cl-field"><label>Confirmação da etapa final</label><input value={confirmacao} onChange={e=>setConfirmacao(e.target.value)} placeholder="Digite ENCERRAR quando habilitado" disabled={!elegivel || confirmado} /></div></div>
      <div className="cl-actions">{!pendente && !confirmado && <button className="cl-btn" disabled={ocupado} onClick={()=>void executar("solicitar")}>Marcar para encerramento</button>}{pendente && <button className="cl-btn cancel" disabled={ocupado} onClick={()=>void executar("cancelar")}>Cancelar encerramento</button>}{pendente && <button className="cl-btn confirm" disabled={ocupado || !elegivel} onClick={()=>void executar("confirmar")}>Confirmar encerramento</button>}</div>
      <div className="cl-note">A confirmação fecha o acesso operacional e público, mas preserva os dados até o fluxo de purge.</div>
      {mensagem && <div className="cl-ok">{mensagem}</div>}{erro && <div className="cl-err">{erro}</div>}
    </section>

    {confirmado && <section className="pg-card">
      <div className="pg-title">Purge definitivo · terceira barreira</div>
      <div className="pg-sub">Inventário, período adicional de segurança e execução física com checkpoints recuperáveis.</div>
      {purgeCarregando && !preview && <div className="pg-state">Calculando inventário da conta…</div>}
      <div className="pg-state">{purge?.status === "executado" ? <><strong>Purge concluído.</strong> A conta já foi removida.</> : purgeAgendado ? <><strong>Purge agendado.</strong> Elegível em {data(purge?.elegivel_em)} · etapa: {purge?.execucao_etapa || "não iniciada"}.</> : <><strong>Purge não agendado.</strong> A conta permanece preservada.</>}</div>
      {purge?.execucao_etapa === "falhou" && purge.execucao_erro && <div className="pg-danger">Última execução falhou: {purge.execucao_erro}. O executor pode ser retomado a partir do checkpoint.</div>}
      {preview && <><div className="pg-preview"><div className="pg-metric"><b>{numero(preview.galerias)}</b><span>galerias</span></div><div className="pg-metric"><b>{numero(preview.clientes)}</b><span>clientes</span></div><div className="pg-metric"><b>{numero(preview.selecoes)}</b><span>seleções</span></div><div className="pg-metric"><b>{numero((preview.storage_fotos_objetos ?? 0) + (preview.storage_marca_objetos ?? 0))}</b><span>objetos Storage</span></div><div className="pg-metric"><b>{bytes((preview.storage_fotos_bytes ?? 0) + (preview.storage_marca_bytes ?? 0))}</b><span>dados Storage</span></div><div className="pg-metric"><b>{numero(preview.push_subscriptions)}</b><span>push subscriptions</span></div><div className="pg-metric"><b>{numero(preview.perfil)}</b><span>perfil</span></div><div className="pg-metric"><b>{numero(preview.assinatura)}</b><span>assinatura</span></div></div><div className="pg-safe">A auditoria administrativa e os registros históricos de encerramento/purge são preservados.</div></>}
      <div className="pg-grid" style={{marginTop:12}}><div className="pg-field"><label>Motivo do purge</label><textarea value={purgeMotivo} onChange={e=>setPurgeMotivo(e.target.value)} placeholder="Ex.: retenção concluída e solicitação formal validada..." /></div><div className="pg-field"><label>{podeExecutarPurge ? "Confirmação irreversível" : "Confirmação"}</label><input value={purgeConfirmacao} onChange={e=>setPurgeConfirmacao(e.target.value)} placeholder={podeExecutarPurge ? "Digite PURGAR DEFINITIVO" : "Digite PURGAR para armar"} disabled={purge?.status === "executado"} />{podeExecutarPurge && <input style={{marginTop:8}} value={purgeEmail} onChange={e=>setPurgeEmail(e.target.value)} placeholder={alvoEmail ? `Digite o e-mail: ${alvoEmail}` : "Digite o e-mail exato da conta"} />}</div></div>
      <div className="pg-actions">{!purgeAgendado && purge?.status !== "executado" && <button className="pg-btn arm" disabled={purgeCarregando} onClick={()=>void executarPurge("agendar")}>Armar purge definitivo</button>}{purgeAgendado && podeCancelarPurge && <button className="pg-btn cancel" disabled={purgeCarregando} onClick={()=>void executarPurge("cancelar")}>Cancelar purge</button>}{purgeAgendado && podeExecutarPurge && <button className="pg-btn execute" disabled={purgeCarregando} onClick={()=>void executarPurge("executar")}>Executar purge irreversível</button>}</div>
      <div className="pg-note">Ordem de execução: Storage → dados relacionais atômicos → Auth. Se houver falha, o checkpoint fica registrado para retomada segura.</div>
      <div className="pg-note">A execução é recusada se a assinatura Stripe estiver ativa ou se a conta alvo for administrativa.</div>
      {purgeMensagem && <div className="pg-ok">{purgeMensagem}</div>}{purgeErro && <div className="pg-err">{purgeErro}</div>}
    </section>}
  </>;
}
