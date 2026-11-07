"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-client";
import AdminAccountsPanel from "./AdminAccountsPanel";

type Resumo = {
  papel: string; contas: number; assinantes: number; mrrCentavos: number;
  galerias: number; clientes: number;
  porPlano: Record<string,number>; porStatus: Record<string,number>;
};
const LABEL_STATUS: Record<string,string> = {
  active: "Ativa", trialing: "Em teste", past_due: "Pagamento pendente",
  canceled: "Cancelada", incomplete: "Incompleta", unpaid: "Não paga"
};
const NOMES: Record<string,string> = {
  sem_plano: "Sem plano", gratis: "Grátis", legacy: "Acesso legado",
  essencial: "Essencial", profissional: "Profissional", studio: "Studio"
};

export default function AdminPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) { router.replace("/login"); return; }
        const res = await fetch("/api/admin/resumo", {
          headers: { Authorization: "Bearer " + data.session.access_token }, cache: "no-store"
        });
        if (!ativo) return;
        if (res.status === 403) { setErro("Esta conta não possui acesso administrativo."); return; }
        if (!res.ok) throw new Error("Não foi possível carregar a visão geral.");
        const dados = await res.json() as Resumo;
        if (ativo) setResumo(dados);
      } catch {
        if (ativo) setErro("Não foi possível carregar a visão geral administrativa.");
      }
    })();
    return () => { ativo = false; };
  }, [router, supabase]);

  const moeda = (centavos: number) => new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL"
  }).format(centavos / 100);

  return (
    <main className="adm admin-overview">
      <div className="admin-overview-inner">
        <header className="admin-overview-heading">
          <div>
            <div className="admin-overview-eyebrow">CENTRAL DE CONTROLE</div>
            <h1>Administração</h1>
            <p className="admin-overview-description">
              Acompanhe os indicadores da plataforma, os comunicados e as contas cadastradas
              em uma única visão administrativa.
            </p>
          </div>
          <div className="admin-heading-badge">Acesso restrito · Fotura interno</div>
        </header>
        {erro && <div className="admin-error" role="alert">{erro}</div>}
        {!resumo && !erro && <div className="admin-loading" role="status">Carregando visão geral…</div>}
        {resumo && <>
          <section aria-label="Indicadores gerais da plataforma">
            <div className="admin-section-head">
              <div>
                <div className="admin-section-kicker">PLATAFORMA</div>
                <h2>Visão geral</h2>
                <p>Indicadores consolidados de usuários, assinaturas e atividade.</p>
              </div>
            </div>
            <div className="admin-metrics">
              <div className="admin-metric"><strong className="admin-metric-value">{resumo.contas}</strong><span className="admin-metric-label">Usuários registrados</span></div>
              <div className="admin-metric"><strong className="admin-metric-value">{resumo.assinantes}</strong><span className="admin-metric-label">Assinantes pagos</span></div>
              <div className="admin-metric"><strong className="admin-metric-value">{moeda(resumo.mrrCentavos)}</strong><span className="admin-metric-label">MRR nominal</span><span className="admin-metric-note">Estimativa mensal</span></div>
              <div className="admin-metric"><strong className="admin-metric-value">{resumo.galerias}</strong><span className="admin-metric-label">Galerias criadas</span></div>
              <div className="admin-metric"><strong className="admin-metric-value">{resumo.clientes}</strong><span className="admin-metric-label">Clientes cadastrados</span></div>
            </div>
          </section>
          <section className="admin-workspace" aria-label="Comunicação e assinaturas">
            <div className="admin-panel">
              <div className="admin-section-kicker">COMUNICAÇÃO</div>
              <h3>Avisos do Fotura</h3>
              <p>Crie comunicados personalizados e mostre novidades, orientações e avisos importantes aos fotógrafos.</p>
              <div className="admin-shortcuts">
                <button className="admin-shortcut" type="button" onClick={() => router.push("/admin/avisos")}>Criar um aviso</button>
                <button className="admin-shortcut" type="button" onClick={() => router.push("/admin/saude")}>Saúde da plataforma</button>
                <button className="admin-shortcut" type="button" onClick={() => router.push("/admin/feedback")}>Ver feedback</button>
              </div>
              <div className="admin-summary-grid">
                <div className="admin-mini-stat"><strong>{resumo.assinantes}</strong><span>Assinaturas remuneradas</span></div>
                <div className="admin-mini-stat"><strong>{resumo.galerias}</strong><span>Galerias cadastradas</span></div>
              </div>
            </div>
            <div className="admin-panel">
              <div className="admin-section-kicker">ASSINATURAS</div>
              <h3>Distribuição por planos</h3>
              <p>Panorama agregado sem exibir dados particulares dos usuários.</p>
              <div className="admin-split-list">
                {Object.entries(resumo.porPlano).map(([codigo,numero]) => (
                  <div className="admin-split-row" key={codigo}><span>{NOMES[codigo] || codigo.replaceAll("_"," ")}</span><strong>{numero}</strong></div>
                ))}
              </div>
              <div className="admin-section-kicker" style={{ marginTop: 20 }}>SITUAÇÃO DAS ASSINATURAS</div>
              <div className="admin-split-list">
                {Object.entries(resumo.porStatus).map(([codigo,numero]) => (
                  <div className="admin-split-row" key={codigo}><span>{LABEL_STATUS[codigo] || codigo.replaceAll("_"," ")}</span><strong>{numero}</strong></div>
                ))}
              </div>
            </div>
          </section>
          <AdminAccountsPanel />
        </>}
      </div>
    </main>
  );
}
