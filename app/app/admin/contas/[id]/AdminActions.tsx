"use client";

import { useMemo, useState } from "react";
import { createClient } from "../../../../lib/supabase-client";

export default function AdminActions({ userId, temStripe }: { userId: string; temStripe: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [plano, setPlano] = useState("legacy");
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  async function executar(acao: "plano_manual" | "sincronizar_stripe") {
    setMensagem(""); setErro("");
    if (motivo.trim().length < 8) { setErro("Informe um motivo com pelo menos 8 caracteres."); return; }
    setOcupado(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { setErro("Sessão expirada."); return; }
      const resposta = await fetch(`/api/admin/contas/${userId}/acoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ acao, plano, motivo: motivo.trim() }),
      });
      const payload = await resposta.json().catch(() => ({})) as { error?: string; mensagem?: string };
      if (!resposta.ok) { setErro(payload.error || "Não foi possível concluir a ação."); return; }
      setMensagem(payload.mensagem || "Ação concluída.");
      window.setTimeout(() => window.location.reload(), 700);
    } catch { setErro("Falha de rede ao executar a ação."); }
    finally { setOcupado(false); }
  }

  return <section className="aa-card">
    <style>{`.aa-card{margin-top:14px;background:linear-gradient(180deg,#15152c,#101023);border:1px solid #2b2e49;border-radius:16px;padding:18px}.aa-title{font-size:14px;font-weight:700;margin-bottom:6px}.aa-sub{font-size:11px;color:#777e9d;margin-bottom:14px}.aa-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.aa-field{display:grid;gap:6px}.aa-field label{font-size:10px;color:#777e9d}.aa-field select,.aa-field textarea{width:100%;box-sizing:border-box;background:#0d0e1d;border:1px solid #2b2e49;border-radius:10px;color:#f0f0f5;padding:10px;font:12px inherit}.aa-field textarea{min-height:78px;resize:vertical}.aa-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:12px}.aa-btn{border:1px solid #3a4165;background:#17192f;color:#e4e6f2;border-radius:9px;padding:9px 12px;font:11px inherit;cursor:pointer}.aa-btn.primary{background:linear-gradient(90deg,#1196fc,#5d0dfa);border:0;color:#fff}.aa-btn:disabled{opacity:.45;cursor:not-allowed}.aa-note{font-size:10px;color:#8f95ad;margin-top:9px}.aa-ok{font-size:11px;color:#8fe3b0;margin-top:10px}.aa-err{font-size:11px;color:#ff9d9d;margin-top:10px}@media(max-width:720px){.aa-grid{grid-template-columns:1fr}}`}</style>
    <div className="aa-title">Ações administrativas controladas</div>
    <div className="aa-sub">Somente owner · motivo obrigatório · todas as ações são registradas na auditoria.</div>
    <div className="aa-grid">
      <div className="aa-field"><label>Plano manual</label><select value={plano} onChange={e=>setPlano(e.target.value)} disabled={temStripe || ocupado}><option value="sem_plano">Sem plano</option><option value="legacy">Legacy / interno</option><option value="essencial">Essencial manual</option><option value="profissional">Profissional manual</option><option value="studio">Studio manual</option></select></div>
      <div className="aa-field"><label>Motivo da ação</label><textarea value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Ex.: acesso interno para suporte, correção operacional..."/></div>
    </div>
    <div className="aa-actions">
      <button className="aa-btn primary" disabled={ocupado || temStripe} onClick={()=>void executar("plano_manual")}>Aplicar plano manual</button>
      <button className="aa-btn" disabled={ocupado || !temStripe} onClick={()=>void executar("sincronizar_stripe")}>Sincronizar com Stripe</button>
    </div>
    <div className="aa-note">Contas com assinatura Stripe não podem receber plano manual. Nelas, a Stripe continua sendo a fonte de verdade.</div>
    {mensagem&&<div className="aa-ok">{mensagem}</div>}{erro&&<div className="aa-err">{erro}</div>}
  </section>;
}
