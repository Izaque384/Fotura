"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase-client";

type Tipo = "informacao" | "novidade" | "atencao";
type Aviso = {
  id: string; titulo: string; mensagem: string; tipo: Tipo; ativo: boolean;
  versao: number; publicado_em: string | null; criado_em: string; atualizado_em: string;
};
type Formulario = { titulo: string; mensagem: string; tipo: Tipo };
const VAZIO: Formulario = { titulo: "", mensagem: "", tipo: "informacao" };
const TIPO_LABEL: Record<Tipo,string> = {
  informacao: "Informação", novidade: "Novidade", atencao: "Atenção"
};

function dataCurta(value: string | null) {
  if (!value) return "Ainda não publicado";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" :
    date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminAvisosPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [form, setForm] = useState<Formulario>(VAZIO);
  const [editando, setEditando] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const carregar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { router.replace("/login"); return; }
    const res = await fetch("/api/admin/avisos", {
      headers: { Authorization: "Bearer " + data.session.access_token }, cache: "no-store"
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Não foi possível carregar os avisos.");
    setAvisos((json.avisos || []) as Aviso[]);
  }, [supabase, router]);

  useEffect(() => {
    let ativo = true;
    void carregar().catch(err => { if (ativo) setErro(err instanceof Error ? err.message : "Não foi possível carregar os avisos."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [carregar]);

  async function executar(metodo: "POST" | "PATCH" | "DELETE", body: Record<string,unknown>, mensagem: string) {
    if (salvando) return;
    setSalvando(true); setErro(""); setSucesso("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.replace("/login"); return; }
      const res = await fetch("/api/admin/avisos", {
        method: metodo, cache: "no-store",
        headers: { Authorization: "Bearer " + data.session.access_token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Não foi possível concluir a operação.");
      await carregar();
      setSucesso(mensagem);
      if (metodo === "DELETE" || metodo === "POST" || body.acao === "editar") {
        setEditando(null); setForm(VAZIO);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível atualizar o aviso.");
    } finally { setSalvando(false); }
  }

  function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const titulo = form.titulo.trim(), mensagem = form.mensagem.trim();
    if (titulo.length < 3 || titulo.length > 120 || mensagem.length < 3 || mensagem.length > 3000) {
      setErro("Informe um título de 3 a 120 caracteres e uma mensagem de 3 a 3.000 caracteres.");
      return;
    }
    if (editando) void executar("PATCH", { id: editando, acao: "editar", titulo, mensagem, tipo: form.tipo }, "Alterações salvas.");
    else void executar("POST", { titulo, mensagem, tipo: form.tipo }, "Rascunho criado. Publique-o quando estiver pronto.");
  }

  function editar(aviso: Aviso) {
    setEditando(aviso.id);
    setForm({ titulo: aviso.titulo, mensagem: aviso.mensagem, tipo: aviso.tipo });
    setErro(""); setSucesso("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function novo() { setEditando(null); setForm(VAZIO); setErro(""); setSucesso(""); }
  const totalPublicados = avisos.filter(a => a.ativo).length;

  return (
    <main className="admin-avisos">
      <div className="admin-avisos-inner">
        <header className="admin-overview-heading">
          <div>
            <div className="admin-overview-eyebrow">COMUNICAÇÃO</div>
            <h1>Avisos para usuários</h1>
            <p className="admin-overview-description">
              Prepare comunicados e publique para todos os fotógrafos que utilizam o Fotura.
              Ao entrar no Fotura, o fotógrafo vê o anúncio novamente, até optar por não mostrá-lo mais. O aviso não é enviado por e-mail.
            </p>
          </div>
          <span className="admin-heading-badge">Publicação exclusiva do responsável</span>
        </header>

        <div className="admin-avisos-metrics" aria-label="Resumo de avisos">
          <div className="admin-mini-stat"><strong>{avisos.length}</strong><span>Avisos cadastrados</span></div>
          <div className="admin-mini-stat"><strong>{totalPublicados}</strong><span>Publicados agora</span></div>
          <div className="admin-mini-stat"><strong>{avisos.length - totalPublicados}</strong><span>Rascunhos e retirados</span></div>
        </div>

        {erro && <div className="admin-error" role="alert">{erro}</div>}
        {sucesso && <div className="admin-avisos-success" role="status">{sucesso}</div>}

        <div className="admin-avisos-columns">
          <section className="admin-panel admin-avisos-editor">
            <div className="admin-section-kicker">EDITOR</div>
            <h2>{editando ? "Editar comunicado" : "Criar aviso"}</h2>
            <p>O aviso é salvo como rascunho. Para aparecer aos usuários, publique-o na lista abaixo.</p>
            <form onSubmit={salvar}>
              <label htmlFor="av-title">Título do aviso</label>
              <input id="av-title" type="text" required minLength={3} maxLength={120}
                placeholder="Ex.: Novidade nas galerias"
                value={form.titulo} disabled={salvando}
                onChange={e => setForm(f => ({...f, titulo: e.target.value}))} />
              <label htmlFor="av-type">Tipo de comunicado</label>
              <select id="av-type" value={form.tipo} disabled={salvando}
                onChange={e => setForm(f => ({...f, tipo: e.target.value as Tipo}))}>
                <option value="informacao">Informação</option>
                <option value="novidade">Novidade</option>
                <option value="atencao">Atenção</option>
              </select>
              <label htmlFor="av-message">Mensagem</label>
              <textarea id="av-message" required minLength={3} maxLength={3000} rows={7}
                placeholder="Escreva o que os fotógrafos devem saber…"
                value={form.mensagem} disabled={salvando}
                onChange={e => setForm(f => ({...f, mensagem: e.target.value}))} />
              <div className="admin-avisos-counter">{form.mensagem.length}/3.000 caracteres</div>
              <div className="admin-avisos-actions">
                <button type="submit" className="admin-avisos-primary" disabled={salvando || !form.titulo.trim() || !form.mensagem.trim()}>
                  {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Salvar rascunho"}
                </button>
                {editando && <button type="button" className="admin-avisos-secondary" disabled={salvando} onClick={novo}>Cancelar edição</button>}
              </div>
            </form>
          </section>

          <section className="admin-panel admin-avisos-preview">
            <div className="admin-section-kicker">PRÉ-VISUALIZAÇÃO</div>
            <h2>Como o usuário verá</h2>
            <p>O conteúdo é exibido como texto, sem executar links ou códigos inseridos na mensagem.</p>
            <div className={"admin-avisos-preview-card tipo-" + form.tipo}>
              <span className="admin-avisos-tag">{TIPO_LABEL[form.tipo]} · Fotura</span>
              <strong>{form.titulo.trim() || "Título do seu aviso"}</strong>
              <p>{form.mensagem.trim() || "A mensagem aparecerá neste espaço quando você começar a escrever."}</p>
            </div>
            <p className="admin-avisos-tip">O anúncio aparece na entrada do Fotura e pode ser fechado a qualquer momento. O fotógrafo pode marcar “Não mostrar este aviso novamente”; a escolha vale para sua conta, mesmo após edições no comunicado.</p>
          </section>
        </div>

        <section className="admin-avisos-list">
          <div className="admin-section-head">
            <div>
              <div className="admin-section-kicker">PUBLICAÇÕES</div>
              <h2>Comunicados cadastrados</h2>
              <p>Publique, retire do ar ou edite quando precisar.</p>
            </div>
          </div>
          {carregando ? <div className="admin-loading" role="status">Carregando avisos…</div> :
           !avisos.length ? <div className="admin-empty">Nenhum comunicado cadastrado ainda. Comece criando um rascunho.</div> :
            <div className="admin-avisos-items">
              {avisos.map(aviso => (
                <article key={aviso.id} className="admin-avisos-row">
                  <div className="admin-avisos-row-body">
                    <div className="admin-avisos-row-badges">
                      <span className={"admin-status-pill " + (aviso.ativo ? "good" : "")}>{aviso.ativo ? "Publicado" : "Fora do ar"}</span>
                      <span className="admin-avisos-tag">{TIPO_LABEL[aviso.tipo]}</span>
                    </div>
                    <h3>{aviso.titulo}</h3>
                    <p>{aviso.mensagem}</p>
                    <small>{aviso.ativo ? "Publicado: " : "Última publicação: "}{dataCurta(aviso.publicado_em)} · Atualizado: {dataCurta(aviso.atualizado_em)}</small>
                  </div>
                  <div className="admin-avisos-row-buttons">
                    <button className="admin-avisos-secondary" type="button" onClick={() => editar(aviso)} disabled={salvando}>Editar</button>
                    <button className={aviso.ativo ? "admin-avisos-secondary" : "admin-avisos-primary"} type="button"
                      disabled={salvando}
                      onClick={() => {
                        if (aviso.ativo) {
                          void executar("PATCH", { id: aviso.id, acao: "desativar" }, "O comunicado foi retirado do ar.");
                        } else {
                          if (window.confirm("Publicar este aviso para todos os usuários do Fotura?")) {
                            void executar("PATCH", { id: aviso.id, acao: "publicar" }, "Comunicado publicado para todos os usuários.");
                          }
                        }
                      }}>
                      {aviso.ativo ? "Retirar do ar" : "Publicar para todos"}
                    </button>
                    <button className="admin-avisos-delete" type="button" disabled={salvando} onClick={() => {
                      if (window.confirm("Excluir este aviso permanentemente? As preferências de não exibição associadas também serão excluídas.")) {
                        void executar("DELETE", { id: aviso.id }, "Comunicado excluído.");
                      }
                    }}>Excluir</button>
                  </div>
                </article>
              ))}
            </div>}
        </section>
      </div>
    </main>
  );
}
