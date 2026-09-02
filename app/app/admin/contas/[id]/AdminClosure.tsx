"use client";

import { useMemo, useState } from "react";
import { createClient } from "../../../../lib/supabase-client";

type Encerramento = {
  status?: "pendente" | "confirmado" | "cancelado" | "executado";
  motivo?: string | null;
  solicitado_em?: string | null;
  elegivel_em?: string | null;
  cancelado_em?: string | null;
  confirmado_em?: string | null;
} | null;

function data(v?: string | null) {
  if (!v) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(v));
}

export default function AdminClosure({ userId, encerramento }: { userId: string; encerramento: Encerramento }) {
  const supabase = useMemo(() => createClient(), []);
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const pendente = encerramento?.status === "pendente";
  const confirmado = encerramento?.status === "confirmado" || encerramento?.status === "executado";
  const elegivel = Boolean(pendente && encerramento?.elegivel_em && Date.now() >= new Date(encerramento.elegivel_em).getTime());

  async function executar(acao: "solicitar" | "cancelar" | "confirmar") {
    setMensagem("");
    setErro("");
    if (motivo.trim().length < 8) {
      setErro("Informe um motivo com pelo menos 8 caracteres.");
      return;
    }
    if (acao === "confirmar" && confirmacao.trim().toUpperCase() !== "ENCERRAR") {
      setErro("Digite ENCERRAR para confirmar esta etapa.");
      return;
    }

    setOcupado(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setErro("Sessão expirada.");
        return;
      }
      const resposta = await fetch(`/api/admin/contas/${userId}/encerramento`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ acao, motivo: motivo.trim(), confirmacao: confirmacao.trim() }),
      });
      const payload = await resposta.json().catch(() => ({})) as { error?: string; mensagem?: string };
      if (!resposta.ok) {
        setErro(payload.error || "Não foi possível concluir a ação.");
        return;
      }
      setMensagem(payload.mensagem || "Ação concluída.");
      window.setTimeout(() => window.location.reload(), 800);
    } catch {
      setErro("Falha de rede ao executar a ação.");
    } finally {
      setOcupado(false);
    }
  }

  return <section className="cl-card">
    <style>{`.cl-card{margin-top:14px;background:linear-gradient(180deg,#171222,#100f1d);border:1px solid rgba(255,157,157,.2);border-radius:16px;padding:18px}.cl-title{font-size:14px;font-weight:800;color:#f0f0f5}.cl-sub{font-size:11px;color:#8f95ad;line-height:1.6;margin:6px 0 14px}.cl-state{padding:11px 12px;border:1px solid #30253a;border-radius:11px;background:#120f1d;font-size:11px;color:#c8cbe0;margin-bottom:13px}.cl-state strong{color:#ffb1b1}.cl-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cl-field{display:grid;gap:6px}.cl-field label{font-size:10px;color:#8f95ad}.cl-field textarea,.cl-field input{width:100%;box-sizing:border-box;background:#0d0c17;border:1px solid #34243d;border-radius:10px;color:#f0f0f5;padding:10px;font:12px inherit}.cl-field textarea{min-height:78px;resize:vertical}.cl-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px}.cl-btn{border:1px solid #4c3042;background:#1b111a;color:#ffb8b8;border-radius:9px;padding:9px 12px;font:11px inherit;cursor:pointer}.cl-btn.cancel{border-color:#39415e;background:#17192a;color:#d6dbf1}.cl-btn.confirm{background:#4a171f;border-color:#76303a;color:#fff}.cl-btn:disabled{opacity:.45;cursor:not-allowed}.cl-note{font-size:10px;color:#8f95ad;margin-top:10px;line-height:1.55}.cl-ok{font-size:11px;color:#8fe3b0;margin-top:10px}.cl-err{font-size:11px;color:#ff9d9d;margin-top:10px}@media(max-width:720px){.cl-grid{grid-template-columns:1fr}}`}</style>
    <div className="cl-title">Encerramento administrativo</div>
    <div className="cl-sub">Fluxo protegido em duas etapas. Marcar para encerramento não apaga nada. A confirmação final só fica disponível após 7 dias.</div>

    <div className="cl-state">
      {!encerramento || encerramento.status === "cancelado" ? <><strong>Nenhum encerramento pendente.</strong></> : null}
      {pendente ? <><strong>Encerramento pendente.</strong> Solicitado em {data(encerramento?.solicitado_em)} · confirmação disponível em {data(encerramento?.elegivel_em)}.</> : null}
      {confirmado ? <><strong>Encerramento confirmado.</strong> Conta suspensa e conteúdo público bloqueado. Dados ainda preservados.</> : null}
    </div>

    <div className="cl-grid">
      <div className="cl-field"><label>Motivo obrigatório</label><textarea value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Ex.: solicitação formal do titular, encerramento por política interna..." /></div>
      <div className="cl-field"><label>Confirmação da etapa final</label><input value={confirmacao} onChange={e=>setConfirmacao(e.target.value)} placeholder="Digite ENCERRAR quando habilitado" disabled={!elegivel || confirmado} /></div>
    </div>

    <div className="cl-actions">
      {!pendente && !confirmado && <button className="cl-btn" disabled={ocupado} onClick={()=>void executar("solicitar")}>Marcar para encerramento</button>}
      {pendente && <button className="cl-btn cancel" disabled={ocupado} onClick={()=>void executar("cancelar")}>Cancelar encerramento</button>}
      {pendente && <button className="cl-btn confirm" disabled={ocupado || !elegivel} onClick={()=>void executar("confirmar")}>Confirmar encerramento</button>}
    </div>

    <div className="cl-note">A confirmação final não exclui banco, Storage nem usuário Auth. Ela apenas fecha o acesso operacional e público. A exclusão física será um terceiro estágio separado.</div>
    <div className="cl-note">Se existir assinatura Stripe ativa, a confirmação é recusada até a cobrança estar encerrada.</div>
    {mensagem && <div className="cl-ok">{mensagem}</div>}
    {erro && <div className="cl-err">{erro}</div>}
  </section>;
}
