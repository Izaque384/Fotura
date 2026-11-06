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
  suspensa: boolean;
  suspensaoMotivo: string | null;
  suspensaEm: string | null;
  takedownPublico: boolean;
  takedownMotivo: string | null;
  takedownEm: string | null;
  encerramentoStatus: string | null;
  encerramentoMotivo: string | null;
  encerramentoElegivelEm: string | null;
  encerramentoConfirmadoEm: string | null;
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
  const [filtro, setFiltro] = useState<"todos" | "assinantes" | "atencao" | "encerramento">("todos");

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
  const suspensas = contas.filter(c => c.suspensa).length;
  const takedowns = contas.filter(c => c.takedownPublico).length;
  const encerramentos = contas.filter(c => c.encerramentoStatus === "pendente" || c.encerramentoStatus === "confirmado").length;
  const precisaAtencao = (c: Conta) =>
    c.suspensa || c.takedownPublico || c.encerramentoStatus === "pendente" ||
    c.encerramentoStatus === "confirmado" || c.status === "past_due";
  const emAtencao = contas.filter(precisaAtencao).length;
  const nomePlano = (valor: string) => valor.replace(/_/g, " ");
  const statusLegivel = (valor: string) => ({
    active: "Ativa", trialing: "Em teste", past_due: "Pagamento pendente",
    canceled: "Cancelada", incomplete: "Incompleta", unpaid: "Não paga"
  } as Record<string, string>)[valor] || valor.replace(/_/g, " ");
  const contasFiltradas = contas.filter(c => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const buscaOk = !termo || [
      c.email, c.nomeEstudio, c.plano, c.status,
      c.suspensaoMotivo || "", c.takedownMotivo || "",
      c.encerramentoStatus || "", c.encerramentoMotivo || ""
    ].some(v => String(v).toLocaleLowerCase("pt-BR").includes(termo));
    const filtroOk = filtro === "todos" ||
      (filtro === "assinantes" && c.temAssinatura) ||
      (filtro === "atencao" && precisaAtencao(c)) ||
      (filtro === "encerramento" &&
        (c.encerramentoStatus === "pendente" || c.encerramentoStatus === "confirmado"));
    return buscaOk && filtroOk;
  });

  return (
    <main className="adm admin-overview">
      <div className="admin-overview-inner">
        <header className="admin-overview-heading">
          <div>
            <div className="admin-overview-eyebrow">CENTRAL DE CONTROLE</div>
            <h1>Administração</h1>
            <p className="admin-overview-description">
              Contas, assinaturas, operação e saúde da plataforma. As ações de moderação
              e cobrança continuam protegidas em suas áreas específicas.
            </p>
          </div>
          <div className="admin-heading-badge">Acesso restrito · Fotura interno</div>
        </header>

        {erro && <div className="admin-error" role="alert">{erro}</div>}
        {!resumo && !erro && <div className="admin-loading" role="status">Carregando informações administrativas…</div>}

        {resumo && (
          <>
            <section aria-label="Indicadores da plataforma">
              <div className="admin-section-head">
                <div>
                  <div className="admin-section-kicker">PLATAFORMA</div>
                  <h2>Visão geral</h2>
                  <p>Principais números consolidados das contas e atividades.</p>
                </div>
              </div>
              <div className="admin-metrics">
                <div className="admin-metric"><strong className="admin-metric-value">{resumo.contas}</strong><span className="admin-metric-label">Contas cadastradas</span></div>
                <div className="admin-metric"><strong className="admin-metric-value">{resumo.assinantes}</strong><span className="admin-metric-label">Assinantes pagos</span></div>
                <div className="admin-metric"><strong className="admin-metric-value">{dinheiro(resumo.mrrCentavos)}</strong><span className="admin-metric-label">MRR nominal</span><span className="admin-metric-note">Receita mensal estimada</span></div>
                <div className="admin-metric"><strong className="admin-metric-value">{resumo.galerias}</strong><span className="admin-metric-label">Galerias criadas</span></div>
                <div className="admin-metric"><strong className="admin-metric-value">{resumo.clientes}</strong><span className="admin-metric-label">Clientes registrados</span></div>
              </div>
            </section>

            <section className="admin-workspace" aria-label="Operação e assinaturas">
              <div className="admin-panel">
                <div className="admin-section-kicker">OPERAÇÃO</div>
                <h3>Contas que exigem atenção</h3>
                <p>Identifique situações relevantes sem procurar em toda a listagem.</p>
                <div className="admin-summary-grid">
                  <div className="admin-mini-stat"><strong>{emAtencao}</strong><span>Contas com algum alerta</span></div>
                  <div className="admin-mini-stat danger"><strong>{suspensas}</strong><span>Contas suspensas</span></div>
                  <div className="admin-mini-stat warn"><strong>{takedowns}</strong><span>Conteúdo público bloqueado</span></div>
                  <div className="admin-mini-stat"><strong>{encerramentos}</strong><span>Em encerramento</span></div>
                </div>
                <div className="admin-shortcuts">
                  <button type="button" className="admin-shortcut" onClick={() => { setFiltro("atencao"); document.getElementById("contas")?.scrollIntoView({ behavior: "smooth" }); }}>Examinar alertas</button>
                  <button type="button" className="admin-shortcut" onClick={() => router.push("/admin/saude")}>Saúde do sistema</button>
                  <button type="button" className="admin-shortcut" onClick={() => router.push("/admin/feedback")}>Ajuda e feedback</button>
                </div>
              </div>
              <div className="admin-panel">
                <div className="admin-section-kicker">ASSINATURAS</div>
                <h3>Distribuição atual</h3>
                <p>Resumo dos planos e status retornados pelo sistema.</p>
                <div className="admin-split-list">
                  {Object.entries(resumo.porPlano).length
                    ? Object.entries(resumo.porPlano).map(([plano, quantidade]) => (
                        <div className="admin-split-row" key={"plano-" + plano}>
                          <span>{nomePlano(plano)}</span><strong>{quantidade}</strong>
                        </div>
                      ))
                    : <p>Nenhuma distribuição de planos disponível.</p>}
                </div>
                <div className="admin-section-kicker" style={{ marginTop: 24 }}>STATUS DE ASSINATURA</div>
                <div className="admin-split-list">
                  {Object.entries(resumo.porStatus).length
                    ? Object.entries(resumo.porStatus).map(([status, quantidade]) => (
                        <div className="admin-split-row" key={"status-" + status}>
                          <span>{statusLegivel(status)}</span><strong>{quantidade}</strong>
                        </div>
                      ))
                    : <p>Nenhum status disponível.</p>}
                </div>
              </div>
            </section>

            <section id="contas" className="admin-account-section" aria-label="Gerenciamento das contas">
              <div className="admin-section-head">
                <div>
                  <div className="admin-section-kicker">GERENCIAMENTO</div>
                  <h2>Contas do Fotura</h2>
                  <p>Consulte estúdios, planos e alertas. Abra cada ficha para detalhes e ações controladas.</p>
                </div>
                <span className="admin-account-count">{contasFiltradas.length} de {contas.length} contas</span>
              </div>
              <div className="admin-account-controls">
                <div className="admin-account-filters" role="group" aria-label="Filtrar contas">
                  {([
                    ["todos", "Todas"],
                    ["assinantes", "Assinantes"],
                    ["atencao", "Precisam de atenção"],
                    ["encerramento", "Encerramento"]
                  ] as const).map(([valor, rotulo]) => (
                    <button type="button" key={valor} className="admin-filter-btn"
                      aria-pressed={filtro === valor} onClick={() => setFiltro(valor)}>{rotulo}</button>
                  ))}
                </div>
                <input className="admin-account-search" type="search" value={busca}
                  onChange={event => setBusca(event.target.value)}
                  placeholder="Buscar por estúdio, e-mail, plano ou status"
                  aria-label="Buscar contas administrativas" />
              </div>

              <div className="admin-account-list">
                {contasFiltradas.length ? contasFiltradas.map(c => {
                  const emEncerramento = c.encerramentoStatus === "pendente" || c.encerramentoStatus === "confirmado";
                  const nome = c.nomeEstudio || c.email || "Estúdio sem nome";
                  return (
                    <article className="admin-account-row" key={c.id}>
                      <div className="admin-account-identity">
                        <div className="admin-account-avatar" aria-hidden="true">{nome.trim().charAt(0).toLocaleUpperCase("pt-BR") || "F"}</div>
                        <div className="admin-account-identity-info">
                          <div className="admin-account-name">{nome}</div>
                          <div className="admin-account-email">{c.email || "Sem e-mail cadastrado"}</div>
                          <div className="admin-account-flags">
                            {c.suspensa ? <span className="admin-status-pill danger">Suspensa</span>
                              : <span className={"admin-status-pill" + (["active", "trialing"].includes(c.status) ? " good" : c.status === "past_due" ? " warn" : "")}>{statusLegivel(c.status)}</span>}
                            {c.takedownPublico && <span className="admin-status-pill warn">Galerias bloqueadas</span>}
                            {emEncerramento && <span className="admin-status-pill danger">Encerramento {c.encerramentoStatus}</span>}
                            {c.cancelarNoFim && <span className="admin-status-pill">Cancela no fim</span>}
                          </div>
                        </div>
                      </div>
                      <div className="admin-account-plan-col">
                        <span className="admin-account-label">PLANO</span>
                        <span className="admin-account-value">{nomePlano(c.plano)}</span>
                      </div>
                      <div className="admin-account-usage-col">
                        <span className="admin-account-label">CONTEÚDO</span>
                        <span className="admin-account-value">{c.galerias} galerias · {c.clientes} clientes</span>
                      </div>
                      <div className="admin-account-date-col">
                        <span className="admin-account-label">ÚLTIMO ACESSO</span>
                        <span className="admin-account-value">{data(c.ultimoLoginEm)}</span>
                        <span className="admin-account-dates">Cadastro: {data(c.criadoEm)}</span>
                      </div>
                      <button type="button" className="admin-link-button"
                        aria-label={"Abrir detalhes da conta de " + nome}
                        onClick={() => router.push("/admin/contas/" + c.id)}>Detalhes <span aria-hidden="true">→</span></button>
                    </article>
                  );
                }) : (
                  <div className="admin-empty">
                    Nenhuma conta corresponde à busca ou ao filtro selecionado.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
