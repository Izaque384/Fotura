"use client";

import { useEffect, useMemo, useState } from "react";
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

function SearchIcon() {
  return (
    <svg className="search-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export default function ProjetosPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [galerias, setGalerias] = useState<Galeria[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [aviso, setAviso] = useState("");
  const [avisoErro, setAvisoErro] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [criando, setCriando] = useState(false);
  const [excluirProjeto, setExcluirProjeto] = useState<Projeto | null>(null);
  const [excluindo, setExcluindo] = useState(false);

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

  async function criar() {
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
    if (etapa === "entrega") return "Entregue";
    if (etapa === "preparando_entrega") return "Preparando entrega";
    if (etapa === "selecao_finalizada") return "Seleção finalizada";
    return "Em andamento";
  }

  const semProjeto = galerias.filter((g) => !g.projeto_id);
  const galeriasAgrupadas = galerias.length - semProjeto.length;
  const projetosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return projetos;
    return projetos.filter((projeto) => {
      const galeriasDoProjeto = galerias.filter((g) => g.projeto_id === projeto.id);
      return (
        projeto.nome.toLocaleLowerCase("pt-BR").includes(termo) ||
        (projeto.descricao ?? "").toLocaleLowerCase("pt-BR").includes(termo) ||
        galeriasDoProjeto.some((g) => g.titulo.toLocaleLowerCase("pt-BR").includes(termo))
      );
    });
  }, [busca, galerias, projetos]);

  return (
    <main className="dash mf-shift projects-page">
      <MenuFotografo />
      <style>{css}</style>

      <div className="wrap">
        <header className="top">
          <div>
            <div className="ey">PROJETOS</div>
            <h1 className="h1">Organize seus trabalhos</h1>
            <p className="sub">Agrupe galerias relacionadas dentro do mesmo projeto sem alterar o fluxo de cada entrega.</p>
          </div>
          <button className="btn primary" type="button" onClick={() => setModalAberto(true)}>
            + Novo projeto
          </button>
        </header>

        <section className="stats" aria-label="Resumo de projetos">
          <div className="stat">
            <strong>{projetos.length}</strong>
            <span>Projetos</span>
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
        </div>

        {aviso && <div className={"notice" + (avisoErro ? " err" : "")}>{aviso}</div>}

        <section className="card list-card">
          {carregando ? (
            <div className="empty">Carregando projetos…</div>
          ) : projetosFiltrados.length === 0 ? (
            <div className="empty-state">
              <strong>{projetos.length ? "Nenhum projeto corresponde à busca" : "Crie seu primeiro projeto"}</strong>
              <span>
                {projetos.length
                  ? "Tente buscar por outro nome de projeto ou galeria."
                  : "Use projetos para reunir etapas de um mesmo trabalho, como pré-wedding, cerimônia e festa."}
              </span>
              {!projetos.length && (
                <button className="btn primary" type="button" onClick={() => setModalAberto(true)}>
                  Criar projeto
                </button>
              )}
            </div>
          ) : (
            <div className="project-list">
              {projetosFiltrados.map((projeto) => {
                const gs = galerias.filter((g) => g.projeto_id === projeto.id);
                const clientesProjeto = Array.from(
                  new Set(gs.map((g) => nomeCliente(g.cliente_id)).filter((nome): nome is string => Boolean(nome)))
                );
                return (
                  <article className="project-card" key={projeto.id}>
                    <div className="project-main">
                      <div className="project-icon" aria-hidden="true">▱</div>
                      <div className="project-copy">
                        <div className="project-title-line">
                          <h2>{projeto.nome}</h2>
                          <span className="count-badge">{gs.length} {gs.length === 1 ? "galeria" : "galerias"}</span>
                        </div>
                        {projeto.descricao && <p>{projeto.descricao}</p>}
                        <div className="project-meta">
                          <span>{clientesProjeto.length ? clientesProjeto.join(" · ") : "Sem cliente vinculado"}</span>
                        </div>
                      </div>
                      <div className="project-actions">
                        <button
                          className="mini"
                          type="button"
                          onClick={() => gs[0] && router.push(`/dashboard/galerias/${gs[0].id}`)}
                          disabled={!gs.length}
                        >
                          {gs.length ? "Abrir" : "Sem galerias"}
                        </button>
                        <button className="mini danger" type="button" onClick={() => setExcluirProjeto(projeto)}>
                          Excluir
                        </button>
                      </div>
                    </div>

                    {gs.length > 0 && (
                      <div className="gallery-list">
                        {gs.map((g) => (
                          <button
                            className="gallery-row"
                            key={g.id}
                            type="button"
                            onClick={() => router.push(`/dashboard/galerias/${g.id}`)}
                          >
                            <div>
                              <strong>{g.titulo}</strong>
                              <span>{nomeCliente(g.cliente_id) || "Sem cliente vinculado"}</span>
                            </div>
                            <div className="gallery-status">
                              <span>{status(g.etapa)}</span>
                              <b>→</b>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {!carregando && semProjeto.length > 0 && (
          <section className="card unassigned-card">
            <div className="section-head">
              <div>
                <div className="ey">SEM PROJETO</div>
                <h2>Galerias ainda não agrupadas</h2>
                <p>Abra o workspace de uma galeria para associá-la a um projeto.</p>
              </div>
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
      </div>

      {modalAberto && (
        <div
          className="modal"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !criando) setModalAberto(false);
          }}
        >
          <section className="panel create-panel" role="dialog" aria-modal="true" aria-labelledby="novo-projeto-title">
            <div className="modal-head">
              <div>
                <h2 id="novo-projeto-title">Novo projeto</h2>
                <p>Crie uma pasta de trabalho. Depois, associe as galerias pelo workspace de cada uma.</p>
              </div>
              <button className="close" type="button" aria-label="Fechar" onClick={() => setModalAberto(false)} disabled={criando}>×</button>
            </div>

            <label className="field">
              <span>Nome do projeto</span>
              <input
                autoFocus
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void criar();
                }}
                placeholder="Ex: Casamento Ana e João"
                disabled={criando}
              />
            </label>

            <label className="field">
              <span>Descrição <em>opcional</em></span>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Pré-wedding, cerimônia e festa"
                disabled={criando}
              />
            </label>

            <div className="modal-actions">
              <button className="btn ghost" type="button" onClick={() => setModalAberto(false)} disabled={criando}>Cancelar</button>
              <button className="btn primary" type="button" onClick={() => void criar()} disabled={criando || !nome.trim()}>
                {criando ? "Criando…" : "Criar projeto"}
              </button>
            </div>
          </section>
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
    </main>
  );
}

const css = `
.dash{min-height:100vh;background:linear-gradient(180deg,#F0EDF7 0%,#ECE8F4 100%);color:#21253A;padding-top:46px;padding-right:5vw;padding-bottom:80px;box-sizing:border-box}
.wrap{max-width:1180px;margin:auto}
.top{display:flex;justify-content:space-between;gap:18px;align-items:end;margin-bottom:18px}
.ey{font-size:11px;letter-spacing:2px;color:#6f76a0}
.h1{font-size:28px;margin:7px 0 0}
.sub{color:#7a7f9a;font-size:13px;line-height:1.55;margin-bottom:0}
.btn{min-height:36px;border:0;border-radius:9px;padding:0 13px;font-family:inherit;font-size:11px;font-weight:750;cursor:pointer}
.btn.primary{color:#fff;background:linear-gradient(90deg,#1196fc,#5d0dfa)}
.btn.ghost{color:#626980;background:#EEEAF8;border:1px solid #D7D0E7}
.btn:disabled{opacity:.55;cursor:default}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}
.stat{background:linear-gradient(180deg,#FAF8FD,#F3EFF9);border:1px solid #DCD6EE;border-radius:14px;padding:15px 17px}
.stat strong{display:block;font-size:23px;color:#21253A}
.stat span{display:block;font-size:11px;color:#777d98;margin-top:5px}
.toolbar{display:flex;align-items:center;gap:8px;margin-bottom:18px}
.search-box{position:relative;display:inline-flex;align-items:center;width:min(320px,100%);flex:0 1 320px}
.search-icon{position:absolute;left:10px;width:14px;height:14px;color:#747a96;pointer-events:none}
.search{width:100%;min-width:0;height:34px;padding:7px 10px 7px 31px;border:1px solid #D7D0E7;border-radius:9px;background:#F3EFF9;color:#21253A;font-family:inherit;font-size:12px;font-weight:500;outline:none;box-sizing:border-box}
.search:focus{border-color:#BFB4D7;background:#F7F4FB}
.card,.panel{background:linear-gradient(180deg,#FAF8FD,#F3EFF9);border:1px solid #DCD6EE;border-radius:16px}
.list-card{padding:14px}
.project-list{display:grid;gap:10px}
.project-card{padding:15px;border:1px solid #DDD7E8;border-radius:14px;background:#FCFAFE;box-shadow:0 7px 20px rgba(65,52,111,.045)}
.project-main{display:grid;grid-template-columns:46px minmax(0,1fr) auto;gap:12px;align-items:center}
.project-icon{width:46px;height:46px;border:1px solid #D8D0EA;border-radius:13px;background:linear-gradient(135deg,rgba(17,150,252,.12),rgba(93,13,250,.14));display:grid;place-items:center;color:#655B94;font-size:23px}
.project-copy{min-width:0}
.project-title-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.project-title-line h2{margin:0;font-size:14px;color:#282D44;letter-spacing:-.1px}
.count-badge{padding:5px 7px;border:1px solid #E0DAEB;border-radius:999px;background:#F6F2FA;color:#6A7087;font-size:8.5px;font-weight:750;white-space:nowrap}
.project-copy>p{margin:5px 0 0;color:#777D91;font-size:10.5px;line-height:1.45}
.project-meta{display:flex;gap:8px;margin-top:7px;color:#8A8D9E;font-size:9.5px}
.project-actions{display:flex;align-items:center;gap:6px}
.mini{height:31px;border:1px solid #D7D0E7;background:#FAF8FD;color:#5F667E;border-radius:8px;padding:0 9px;font-family:inherit;font-size:9.5px;font-weight:700;cursor:pointer;white-space:nowrap}
.mini:hover{background:#F0EBF7;border-color:#C8BEE0}
.mini:disabled{opacity:.5;cursor:default}
.mini.danger{color:#B95C66}
.gallery-list{display:grid;gap:6px;margin-top:12px;padding-top:12px;border-top:1px solid #E7E2EE}
.gallery-row,.unassigned-row{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;padding:10px 11px;border:1px solid #E3DDEA;border-radius:10px;background:#F7F4FB;color:#30354A;cursor:pointer}
.gallery-row:hover,.unassigned-row:hover{background:#F0EBF7;border-color:#CCC2DF}
.gallery-row strong,.unassigned-row strong{display:block;font-size:11px}
.gallery-row div>span,.unassigned-row div>span{display:block;margin-top:3px;color:#858899;font-size:9.5px}
.gallery-status{display:flex;align-items:center;gap:9px;color:#716A92;font-size:9.5px;white-space:nowrap}
.gallery-status b{font-size:12px}
.notice{margin-bottom:16px;color:#3F7C5B;font-size:13px;border:1px solid rgba(143,227,176,.18);background:rgba(143,227,176,.06);padding:10px 12px;border-radius:10px}
.notice.err{color:#B95C66;border-color:rgba(255,157,157,.2);background:rgba(255,157,157,.06)}
.empty{padding:48px 10px;text-align:center;color:#7A7F9A}
.empty-state{padding:48px 18px;text-align:center;display:grid;justify-items:center;gap:8px;color:#7A7F9A}
.empty-state strong{font-size:16px;color:#31364B}
.empty-state span{max-width:540px;font-size:11px;line-height:1.6}
.empty-state .btn{margin-top:5px}
.unassigned-card{margin-top:18px;padding:16px}
.section-head h2{margin:5px 0 4px;font-size:16px}
.section-head p{margin:0;color:#7A7F9A;font-size:10.5px}
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
@media(max-width:900px){.top{align-items:flex-start;flex-direction:column}.unassigned-list{grid-template-columns:1fr}}
@media(max-width:640px){.dash{padding:76px 18px 60px}.h1{font-size:24px}.stats{grid-template-columns:1fr}.toolbar,.search-box{width:100%}.project-main{grid-template-columns:42px minmax(0,1fr)}.project-icon{width:42px;height:42px}.project-actions{grid-column:1/-1;justify-content:flex-end}.gallery-row,.unassigned-row{align-items:flex-start}.gallery-status,.unassigned-row>span{white-space:normal;text-align:right}}
`;
