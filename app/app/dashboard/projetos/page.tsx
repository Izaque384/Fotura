"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MenuFotografo from "../../MenuFotografo";
import ConfirmDialog from "../../components/ConfirmDialog";
import { createClient } from "../../../lib/supabase-client";

type Projeto = {
  id: string;
  nome: string;
  descricao: string | null;
  cliente_id: string | null;
  criado_em: string;
  atualizado_em: string;
};

type Galeria = {
  id: string;
  titulo: string;
  projeto_id: string | null;
  cliente_id: string | null;
  etapa: string;
  criado_em: string;
};

type Cliente = { id: string; nome: string };
type Filtro = "todos" | "com_galerias" | "sem_galerias";

function SearchIcon() {
  return (
    <svg className="search-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 7.3A2.3 2.3 0 0 1 5.8 5h4l1.8 2h6.6a2.3 2.3 0 0 1 2.3 2.3v7.4a2.3 2.3 0 0 1-2.3 2.3H5.8a2.3 2.3 0 0 1-2.3-2.3Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function dataCurta(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(data);
}

export default function ProjetosPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [galerias, setGalerias] = useState<Galeria[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [projetoAberto, setProjetoAberto] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [avisoErro, setAvisoErro] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [criando, setCriando] = useState(false);
  const [excluirProjeto, setExcluirProjeto] = useState<Projeto | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    const fora = (event: PointerEvent) => {
      const alvo = event.target;
      if (!(alvo instanceof Element) || !alvo.closest(".filter-wrap")) setFiltroAberto(false);
    };
    const tecla = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltroAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    window.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      window.removeEventListener("keydown", tecla);
    };
  }, []);

  useEffect(() => {
    if (!modalAberto) return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tecla = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !criando) setModalAberto(false);
    };
    window.addEventListener("keydown", tecla);
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflowAnterior;
    };
  }, [criando, modalAberto]);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function carregar() {
    setCarregando(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.replace("/login");
      return;
    }

    const [p, g, c] = await Promise.all([
      supabase
        .from("galeria_projetos")
        .select("id,nome,descricao,cliente_id,criado_em,atualizado_em")
        .eq("user_id", auth.user.id)
        .order("atualizado_em", { ascending: false }),
      supabase
        .from("galerias")
        .select("id,titulo,projeto_id,cliente_id,etapa,criado_em")
        .eq("user_id", auth.user.id)
        .order("criado_em", { ascending: false }),
      supabase.from("clientes").select("id,nome").eq("user_id", auth.user.id).order("nome"),
    ]);

    if (p.error || g.error || c.error) {
      setAvisoErro(true);
      setAviso("Não foi possível carregar seus projetos agora.");
      setCarregando(false);
      return;
    }

    setProjetos((p.data ?? []) as Projeto[]);
    setGalerias((g.data ?? []) as Galeria[]);
    setClientes((c.data ?? []) as Cliente[]);
    setCarregando(false);
  }

  useEffect(() => {
    void carregar();
  }, []);

  function abrirModal() {
    setNome("");
    setDescricao("");
    setAviso("");
    setAvisoErro(false);
    setModalAberto(true);
  }

  function fecharModal() {
    if (criando) return;
    setModalAberto(false);
    setNome("");
    setDescricao("");
  }

  async function criar(event?: FormEvent) {
    event?.preventDefault();
    if (!nome.trim() || criando) return;
    setCriando(true);
    setAviso("");
    setAvisoErro(false);

    try {
      const access = await token();
      if (!access) throw new Error("Sua sessão expirou. Entre novamente.");
      const r = await fetch("/api/galeria/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
        body: JSON.stringify({
          acao: "criar_projeto",
          nome: nome.trim(),
          descricao: descricao.trim() || null,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Não foi possível criar o projeto.");
      setNome("");
      setDescricao("");
      setModalAberto(false);
      setAviso("Projeto criado.");
      await carregar();
    } catch (e) {
      setAvisoErro(true);
      setAviso(e instanceof Error ? e.message : "Não foi possível criar o projeto.");
    } finally {
      setCriando(false);
    }
  }

  async function confirmarExclusao() {
    if (!excluirProjeto || excluindo) return;
    setExcluindo(true);
    setAviso("");
    setAvisoErro(false);

    try {
      const access = await token();
      if (!access) throw new Error("Sua sessão expirou. Entre novamente.");
      const r = await fetch("/api/galeria/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
        body: JSON.stringify({ acao: "excluir_projeto", projetoId: excluirProjeto.id }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Não foi possível excluir o projeto.");
      setProjetoAberto((atual) => (atual === excluirProjeto.id ? null : atual));
      setExcluirProjeto(null);
      setAviso("Projeto excluído. As galerias foram preservadas.");
      await carregar();
    } catch (e) {
      setAvisoErro(true);
      setAviso(e instanceof Error ? e.message : "Não foi possível excluir o projeto.");
    } finally {
      setExcluindo(false);
    }
  }

  function nomeCliente(id: string | null) {
    return clientes.find((c) => c.id === id)?.nome || null;
  }

  function status(etapa: string) {
    if (etapa === "entrega") return { rotulo: "Entregue", classe: "delivery" };
    if (etapa === "preparando_entrega") return { rotulo: "Preparando", classe: "preparing" };
    if (etapa === "selecao_finalizada") return { rotulo: "Seleção finalizada", classe: "finalized" };
    return { rotulo: "Em andamento", classe: "progress" };
  }

  function resumoClientes(gs: Galeria[]) {
    const nomes = Array.from(new Set(gs.map((g) => nomeCliente(g.cliente_id)).filter((item): item is string => Boolean(item))));
    if (!nomes.length) return "Sem cliente vinculado";
    if (nomes.length <= 2) return nomes.join(" · ");
    return `${nomes.slice(0, 2).join(" · ")} +${nomes.length - 2}`;
  }

  const semProjeto = galerias.filter((g) => !g.projeto_id);
  const galeriasAgrupadas = galerias.length - semProjeto.length;

  const projetosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return projetos.filter((projeto) => {
      const gs = galerias.filter((g) => g.projeto_id === projeto.id);
      const bateFiltro =
        filtro === "todos" ||
        (filtro === "com_galerias" && gs.length > 0) ||
        (filtro === "sem_galerias" && gs.length === 0);
      const bateBusca =
        !termo ||
        projeto.nome.toLocaleLowerCase("pt-BR").includes(termo) ||
        (projeto.descricao ?? "").toLocaleLowerCase("pt-BR").includes(termo) ||
        gs.some((g) => g.titulo.toLocaleLowerCase("pt-BR").includes(termo));
      return bateFiltro && bateBusca;
    });
  }, [busca, filtro, galerias, projetos]);

  return (
    <div className="dash mf-shift projects-page">
      <MenuFotografo />
      <style>{css}</style>

      <main className="dash-body">
        <header className="top">
          <div>
            <div className="ey">PROJETOS</div>
            <h1 className="h1">Organize seus trabalhos</h1>
            <p className="sub">Agrupe galerias relacionadas e encontre todas as etapas de um mesmo trabalho com mais rapidez.</p>
          </div>
          <button className="btn" type="button" onClick={abrirModal}>
            + Novo projeto
          </button>
        </header>

        <section className="stats" aria-label="Resumo de projetos">
          <div className="stat">
            <strong>{projetos.length}</strong>
            <span>Total de projetos</span>
          </div>
          <div className="stat">
            <strong>{galeriasAgrupadas}</strong>
            <span>Galerias agrupadas</span>
          </div>
          <div className="stat">
            <strong>{semProjeto.length}</strong>
            <span>Galerias sem projeto</span>
          </div>
        </section>

        <div className="toolbar">
          <label className="search-box">
            <SearchIcon />
            <input
              className="search"
              aria-label="Buscar projetos"
              placeholder="Buscar por projeto ou galeria"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
          <div className="filter-wrap">
            <button
              type="button"
              className={"filter-trigger" + (filtroAberto ? " open" : "")}
              aria-haspopup="menu"
              aria-expanded={filtroAberto}
              onClick={() => setFiltroAberto((aberto) => !aberto)}
            >
              Filtrar por <span className="filter-chevron">⌄</span>
            </button>
            {filtroAberto && (
              <div className="filter-menu" role="menu">
                {([
                  ["todos", "Todos"],
                  ["com_galerias", "Com galerias"],
                  ["sem_galerias", "Sem galerias"],
                ] as [Filtro, string][]).map(([valor, rotulo]) => (
                  <button
                    type="button"
                    role="menuitem"
                    key={valor}
                    className={"filter-option" + (filtro === valor ? " on" : "")}
                    onClick={() => {
                      setFiltro(valor);
                      setFiltroAberto(false);
                    }}
                  >
                    <span>{rotulo}</span>
                    {filtro === valor && <span className="filter-check">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {aviso && <div className={"notice" + (avisoErro ? " err" : "")}>{aviso}</div>}

        <section className="panel list-panel">
          {carregando ? (
            <div className="empty">Carregando projetos…</div>
          ) : projetosFiltrados.length === 0 ? (
            <div className="empty-first">
              <strong>{projetos.length ? "Nenhum projeto encontrado" : "Crie seu primeiro projeto"}</strong>
              <span>
                {projetos.length
                  ? "Ajuste a busca ou o filtro para encontrar outro projeto."
                  : "Projetos ajudam a reunir várias galerias do mesmo trabalho sem alterar cada entrega."}
              </span>
              {!projetos.length && <button className="btn" type="button" onClick={abrirModal}>Criar projeto</button>}
            </div>
          ) : (
            <div className="project-list">
              {projetosFiltrados.map((projeto) => {
                const gs = galerias.filter((g) => g.projeto_id === projeto.id);
                const aberto = projetoAberto === projeto.id;
                return (
                  <article className={"project-card" + (aberto ? " open" : "")} key={projeto.id}>
                    <div className="project-main">
                      <div className="project-icon" aria-hidden="true"><FolderIcon /></div>
                      <div className="project-copy">
                        <div className="project-title-line">
                          <h2>{projeto.nome}</h2>
                          <span className="count-badge">{gs.length} {gs.length === 1 ? "galeria" : "galerias"}</span>
                        </div>
                        <p className="project-description">{projeto.descricao || "Sem descrição"}</p>
                        <div className="project-meta">
                          <span>{resumoClientes(gs)}</span>
                          <span>Atualizado {dataCurta(projeto.atualizado_em)}</span>
                        </div>
                      </div>
                      <div className="project-actions">
                        <button
                          className="mini"
                          type="button"
                          disabled={!gs.length}
                          aria-expanded={gs.length ? aberto : undefined}
                          onClick={() => setProjetoAberto((atual) => (atual === projeto.id ? null : projeto.id))}
                        >
                          {gs.length ? (aberto ? "Recolher" : "Ver galerias") : "Sem galerias"}
                        </button>
                        <button className="mini danger" type="button" onClick={() => setExcluirProjeto(projeto)}>
                          Excluir
                        </button>
                      </div>
                    </div>

                    {aberto && gs.length > 0 && (
                      <div className="gallery-list">
                        {gs.map((g) => {
                          const estado = status(g.etapa);
                          return (
                            <button
                              className="gallery-row"
                              key={g.id}
                              type="button"
                              onClick={() => router.push(`/dashboard/galerias/${g.id}`)}
                            >
                              <div className="gallery-copy">
                                <strong>{g.titulo}</strong>
                                <span>{nomeCliente(g.cliente_id) || "Sem cliente vinculado"}</span>
                              </div>
                              <div className="gallery-side">
                                <span className={"status-pill " + estado.classe}>{estado.rotulo}</span>
                                <b aria-hidden="true">→</b>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {!carregando && semProjeto.length > 0 && (
          <section className="panel unassigned-panel">
            <div className="section-head">
              <div>
                <div className="ey">SEM PROJETO</div>
                <h2>Galerias ainda não agrupadas</h2>
                <p>Abra o workspace da galeria para vinculá-la ao projeto desejado.</p>
              </div>
              <span className="section-count">{semProjeto.length}</span>
            </div>
            <div className="unassigned-list">
              {semProjeto.map((g) => (
                <button
                  className="unassigned-row"
                  key={g.id}
                  type="button"
                  onClick={() => router.push(`/dashboard/galerias/${g.id}`)}
                >
                  <div>
                    <strong>{g.titulo}</strong>
                    <span>{nomeCliente(g.cliente_id) || "Sem cliente vinculado"}</span>
                  </div>
                  <span>Abrir workspace →</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {modalAberto && (
        <div
          className="modal"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) fecharModal();
          }}
        >
          <form className="panel create-panel" role="dialog" aria-modal="true" aria-labelledby="novo-projeto-title" onSubmit={criar}>
            <div className="modal-head">
              <div>
                <h2 id="novo-projeto-title">Novo projeto</h2>
                <p>Crie o projeto agora e associe galerias pelo workspace de cada uma.</p>
              </div>
              <button className="close" type="button" aria-label="Fechar" onClick={fecharModal} disabled={criando}>×</button>
            </div>

            <label className="field">
              <span>Nome do projeto</span>
              <input
                autoFocus
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                placeholder="Ex: Casamento Ana e João"
                disabled={criando}
                required
              />
            </label>

            <label className="field">
              <span>Descrição <em>opcional</em></span>
              <textarea
                value={descricao}
                onChange={(event) => setDescricao(event.target.value)}
                placeholder="Ex: Pré-wedding, cerimônia e festa"
                disabled={criando}
              />
            </label>

            <div className="modal-actions">
              <button className="btn ghost" type="button" onClick={fecharModal} disabled={criando}>Cancelar</button>
              <button className="btn" type="submit" disabled={criando || !nome.trim()}>
                {criando ? "Criando…" : "Criar projeto"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(excluirProjeto)}
        title="Excluir projeto?"
        description="As galerias continuarão existindo e ficarão sem projeto. Nenhuma foto ou entrega será apagada."
        confirmLabel="Excluir projeto"
        cancelLabel="Cancelar"
        danger
        loading={excluindo}
        onConfirm={() => void confirmarExclusao()}
        onCancel={() => {
          if (!excluindo) setExcluirProjeto(null);
        }}
      />
    </div>
  );
}

const css = `
.dash{min-height:100vh;background:linear-gradient(180deg,#F0EDF7,#ECE8F4);color:#21253A}
.dash-body{max-width:1120px;margin:0 auto;padding:40px 40px 80px}
.top{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:22px}
.ey{font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#6f76a0}
.h1{font-size:30px;font-weight:700;letter-spacing:-.5px;color:#21253A;margin:8px 0 0}
.sub{font-size:13px;color:#7a7f9a;margin:6px 0 0;line-height:1.55}
.btn{min-height:38px;border:0;border-radius:10px;padding:0 14px;color:#fff;background:linear-gradient(90deg,#1196fc,#5d0dfa);font:700 12px inherit;cursor:pointer}
.btn:disabled{opacity:.55;cursor:default}
.btn.ghost{color:#626980;background:#EEEAF8;border:1px solid #D7D0E7}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}
.stat{background:linear-gradient(180deg,#FAF8FD,#F3EFF9);border:1px solid #DCD6EE;border-radius:14px;padding:15px 17px}
.stat strong{display:block;font-size:23px;color:#21253A}
.stat span{display:block;font-size:11px;color:#777d98;margin-top:5px}
.toolbar{display:flex;justify-content:flex-start;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.search-box{position:relative;display:inline-flex;align-items:center;width:min(320px,100%);flex:0 1 320px}
.search-icon{position:absolute;left:10px;width:14px;height:14px;color:#747a96;pointer-events:none}
.search{width:100%;min-width:0;height:34px;padding:7px 10px 7px 31px;border:1px solid #D7D0E7;border-radius:9px;background:#F3EFF9;color:#21253A;font-family:inherit;font-size:12px;font-weight:500;outline:none;box-sizing:border-box}
.search:focus{border-color:#BFB4D7;background:#F7F4FB}
.search::placeholder{color:#737a96}
.filter-wrap{position:relative;display:inline-flex}
.filter-trigger{height:34px;display:inline-flex;align-items:center;gap:7px;padding:0 11px;border:1px solid #D7D0E7;border-radius:9px;background:#FAF8FD;color:#555b73;font-family:inherit;font-size:11px;font-weight:700;line-height:1;cursor:pointer;white-space:nowrap}
.filter-trigger:hover,.filter-trigger.open{border-color:#BFB4D7;background:#F3EFF9}
.filter-chevron{font-size:12px;color:#7a7f9a;transform:translateY(-1px)}
.filter-menu{position:absolute;left:0;top:calc(100% + 6px);z-index:40;min-width:160px;padding:5px;border:1px solid #D7D0E7;border-radius:10px;background:#FAF8FD;box-shadow:0 12px 28px rgba(49,42,79,.13)}
.filter-option{width:100%;display:flex;align-items:center;justify-content:space-between;gap:14px;border:0;border-radius:7px;background:transparent;color:#555b73;padding:8px 9px;font-family:inherit;font-size:12px;font-weight:650;cursor:pointer;text-align:left}
.filter-option:hover{background:#F0EBF7}
.filter-option.on{color:#514780;background:#ECE7F6}
.filter-check{font-size:10px}
.panel{background:linear-gradient(180deg,#FAF8FD,#F3EFF9);border:1px solid #DCD6EE;border-radius:16px}
.list-panel{padding:14px}
.project-list{display:grid;gap:9px}
.project-card{padding:12px 13px;border:1px solid #DDD7E8;border-radius:13px;background:#FCFAFE;box-shadow:0 7px 20px rgba(65,52,111,.04)}
.project-card.open{border-color:#CFC5E2}
.project-main{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:12px;align-items:center}
.project-icon{width:48px;height:44px;border:1px solid #D8D0EA;border-radius:11px;background:#F2EEF8;display:grid;place-items:center;color:#655B94}
.project-icon svg{width:22px;height:22px}
.project-copy{min-width:0}
.project-title-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.project-title-line h2{margin:0;font-size:14px;color:#282D44;letter-spacing:-.1px}
.count-badge{padding:4px 7px;border:1px solid #E0DAEB;border-radius:999px;background:#F6F2FA;color:#6A7087;font-size:8.5px;font-weight:750;white-space:nowrap}
.project-description{margin:4px 0 0;color:#777D91;font-size:10.5px;line-height:1.45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.project-meta{display:flex;gap:9px;flex-wrap:wrap;margin-top:5px;color:#8A8D9E;font-size:9.5px}
.project-meta span+span::before{content:"·";margin-right:9px;color:#B0AABD}
.project-actions{display:flex;align-items:center;gap:6px}
.mini{height:32px;border:1px solid #D7D0E7;background:#FAF8FD;color:#5F667E;border-radius:8px;padding:0 10px;font-family:inherit;font-size:9.5px;font-weight:700;cursor:pointer;white-space:nowrap}
.mini:hover{background:#F0EBF7;border-color:#C8BEE0}
.mini:disabled{opacity:.48;cursor:default}
.mini.danger{color:#B95C66}
.gallery-list{display:grid;gap:6px;margin-top:11px;padding-top:11px;border-top:1px solid #E7E2EE}
.gallery-row,.unassigned-row{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;padding:9px 10px;border:1px solid #E3DDEA;border-radius:9px;background:#F7F4FB;color:#30354A;cursor:pointer}
.gallery-row:hover,.unassigned-row:hover{background:#F0EBF7;border-color:#CCC2DF}
.gallery-copy strong,.unassigned-row strong{display:block;font-size:11px}
.gallery-copy span,.unassigned-row div>span{display:block;margin-top:3px;color:#858899;font-size:9.5px}
.gallery-side{display:flex;align-items:center;gap:9px;white-space:nowrap}
.gallery-side b{font-size:12px;color:#716A92}
.status-pill{border-radius:999px;padding:4px 7px;font-size:8.5px;font-weight:750;border:1px solid}
.status-pill.delivery{color:#3F7C5B;background:#E9F5EF;border-color:#C9E4D5}
.status-pill.preparing{color:#527A9A;background:#EAF4FB;border-color:#C9DFEE}
.status-pill.finalized{color:#65558B;background:#F0EBF8;border-color:#D7CBEA}
.status-pill.progress{color:#97702D;background:#FBF2DB;border-color:#E8D4A0}
.notice{margin-bottom:16px;color:#3F7C5B;font-size:13px;border:1px solid rgba(143,227,176,.18);background:rgba(143,227,176,.06);padding:10px 12px;border-radius:10px}
.notice.err{color:#B95C66;border-color:rgba(255,157,157,.2);background:rgba(255,157,157,.06)}
.empty{padding:48px 10px;text-align:center;color:#7A7F9A}
.empty-first{padding:46px 16px;display:grid;justify-items:center;gap:8px;text-align:center;color:#7A7F9A}
.empty-first strong{font-size:16px;color:#31364B}
.empty-first span{max-width:520px;font-size:11px;line-height:1.6}
.empty-first .btn{margin-top:5px}
.unassigned-panel{margin-top:18px;padding:16px}
.section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:15px}
.section-head h2{margin:5px 0 4px;font-size:16px}
.section-head p{margin:0;color:#7A7F9A;font-size:10.5px}
.section-count{min-width:30px;height:30px;padding:0 8px;display:grid;place-items:center;border:1px solid #DDD7E8;border-radius:9px;background:#F6F2FA;color:#646B84;font-size:11px;font-weight:750}
.unassigned-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:13px}
.unassigned-row>span{color:#716A92;font-size:9.5px;white-space:nowrap}
.modal{position:fixed;inset:0;z-index:120;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(20,18,31,.58);backdrop-filter:blur(8px)}
.create-panel{width:min(510px,100%);padding:20px;box-shadow:0 28px 80px rgba(31,25,53,.25)}
.modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid #E3DEEB}
.modal-head h2{margin:0;font-size:18px}
.modal-head p{margin:6px 0 0;color:#7A7F9A;font-size:10.5px;line-height:1.5}
.close{width:34px;height:34px;flex:none;border:1px solid #D7D0E7;border-radius:50%;background:#F3EFF9;color:#656B82;font-size:20px;cursor:pointer}
.field{display:grid;gap:6px;margin-top:12px}
.field span{color:#686F89;font-size:10px;font-weight:700}
.field em{font-style:normal;font-weight:500;color:#9699A8}
.field input,.field textarea{width:100%;box-sizing:border-box;border:1px solid #D7D0E7;border-radius:9px;background:#F7F4FB;color:#21253A;font-family:inherit;font-size:12px;outline:none}
.field input{height:40px;padding:0 11px}
.field textarea{min-height:90px;padding:11px;resize:vertical}
.field input:focus,.field textarea:focus{border-color:#B9ADD8;background:#FCFAFE}
.modal-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:18px}
@media(max-width:980px){.top{align-items:flex-start;flex-direction:column}.unassigned-list{grid-template-columns:1fr}.project-main{grid-template-columns:44px minmax(0,1fr)}.project-icon{width:44px;height:42px}.project-actions{grid-column:1/-1;justify-content:flex-end}}
@media(max-width:700px){.dash-body{padding:76px 14px 60px}.h1{font-size:24px}.stats{grid-template-columns:1fr}.toolbar,.search-box{width:100%}.project-card{padding:10px}.project-main{grid-template-columns:40px minmax(0,1fr);gap:10px}.project-icon{width:40px;height:40px}.project-description{white-space:normal}.project-meta span+span::before{display:none}.project-meta{display:grid;gap:3px}.project-actions{justify-content:flex-start;flex-wrap:wrap}.gallery-row,.unassigned-row{align-items:flex-start}.gallery-side,.unassigned-row>span{white-space:normal;text-align:right}.modal-actions{display:grid;grid-template-columns:1fr 1fr}.modal-actions .btn{width:100%}}
`;
