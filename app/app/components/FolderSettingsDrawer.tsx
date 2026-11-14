"use client";

import { type FormEvent, useEffect, useState } from "react";
import FoturaDrawer from "./FoturaDrawer";

type FolderData = {
  id: string; titulo: string; capaUrl: string | null; qtd: number;
  visivel: boolean; etapa: string; criado_em: string;
  selecao: { fotos: string[]; finalizada: boolean } | null;
};

type Props = {
  pasta: FolderData; prova: boolean; saving: boolean;
  onClose: () => void;
  onRename: (name: string) => Promise<void>;
  onVisibility: () => Promise<void>;
  onCover: () => void;
  onManage: () => void;
  onAction: () => void;
  actionLabel: string;
  onProjectSettings: () => void;
};

function data(valor: string) {
  const dt = new Date(valor);
  return Number.isNaN(dt.getTime()) ? "—" :
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(dt);
}

export default function FolderSettingsDrawer({ pasta, prova, saving, onClose, onRename, onVisibility, onCover, onManage, onAction, actionLabel, onProjectSettings }: Props) {
  const [name, setName] = useState(pasta.titulo);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setName(pasta.titulo); setError(""); }, [pasta.id, pasta.titulo]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = name.trim();
    if (!next || next.length > 120 || next === pasta.titulo || busy || saving) return;
    setBusy(true); setError("");
    try { await onRename(next); } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o nome.");
    } finally { setBusy(false); }
  }
  return (
    <FoturaDrawer title="Configurações da galeria" description="Faça ajustes rápidos sem sair do projeto" onClose={() => { if (!busy && !saving) onClose(); }}
      footer={<>
        <button type="button" className="ft-drawer-button" onClick={onManage} disabled={!pasta.qtd || busy || saving}>Gerenciar fotos</button>
        <button type="button" className="ft-drawer-button primary" onClick={onAction} disabled={busy || saving}>{actionLabel} <span aria-hidden="true">→</span></button>
      </>}>
      {pasta.capaUrl ? <img className="ft-drawer-cover" src={pasta.capaUrl} alt="" /> :
        <div className="ft-drawer-cover-placeholder">Galeria do projeto</div>}
      <h3 className="ft-drawer-name">{pasta.titulo}</h3>
      <div className="ft-drawer-badges">
        <span className={"ft-drawer-badge" + (pasta.visivel ? " ok" : "")}>{pasta.visivel ? "Publicada" : "Oculta"}</span>
        <span className="ft-drawer-badge">{pasta.qtd} fotos</span>
        <span className="ft-drawer-badge">{pasta.selecao?.fotos.length ?? 0} selecionadas</span>
      </div>
      <section className="ft-drawer-section">
        <h3>Informações</h3>
        <div className="ft-drawer-field"><strong>Etapa</strong>{pasta.etapa === "entrega" ? "Entregue" : pasta.etapa === "preparando_entrega" ? "Preparando entrega" : pasta.selecao?.finalizada ? "Seleção finalizada" : prova ? "Aguardando seleção" : "Entrega direta"}</div>
        <div className="ft-drawer-field"><strong>Criada em</strong>{data(pasta.criado_em)}</div>
        <div className="ft-drawer-field"><strong>Seleção</strong>{pasta.selecao?.finalizada ? "Concluída" : pasta.selecao ? "Em andamento" : "Nenhuma seleção registrada"}</div>
      </section>
      <section className="ft-drawer-section">
        <h3>Renomear galeria</h3>
        <form className="ft-drawer-form" onSubmit={save}>
          <label htmlFor="ft-folder-name">Nome da galeria</label>
          <input id="ft-folder-name" type="text" value={name} onChange={e => setName(e.target.value)} required maxLength={120} disabled={busy || saving} />
          {error && <p className="ft-drawer-error" role="alert">{error}</p>}
          <button className="ft-drawer-button" type="submit" disabled={busy || saving || !name.trim() || name.trim() === pasta.titulo}>{busy ? "Salvando…" : "Salvar nome"}</button>
        </form>
      </section>
      <section className="ft-drawer-section">
        <h3>Visibilidade e capa</h3>
        <div className="ft-drawer-field"><strong>Visibilidade atual</strong>{pasta.visivel ? "Visível no projeto compartilhado com o cliente." : "Oculta para o cliente."}</div>
        <div className="ft-drawer-actions">
          <button className="ft-drawer-button" type="button" onClick={() => void onVisibility()} disabled={busy || saving}>{saving ? "Salvando…" : pasta.visivel ? "Ocultar do cliente" : "Publicar para o cliente"}</button>
          <button className="ft-drawer-button" type="button" onClick={onCover} disabled={!pasta.qtd || busy || saving}>Escolher capa</button>
        </div>
        <p className="ft-drawer-note">Prazo, downloads, prova e senha são configurados para todo o projeto.</p>
        <button type="button" className="ft-drawer-button" onClick={onProjectSettings} disabled={busy || saving}>Configurações gerais do projeto</button>
      </section>
    </FoturaDrawer>
  );
}
