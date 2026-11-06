"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "../../lib/supabase-client";
import FoturaDrawer from "./FoturaDrawer";

type Aviso = {
  id: string; titulo: string; mensagem: string; tipo: "informacao" | "novidade" | "atencao";
  versao: number; publicado_em: string;
};
type Leitura = { aviso_id: string; versao_lida: number };
type Props = { uid: string };

const TIPO = { informacao: "Informação", novidade: "Novidade", atencao: "Atenção" } as const;

function dataCurta(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function AvisosFotura({ uid }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [leituras, setLeituras] = useState<Record<string,number>>({});
  const [aberto, setAberto] = useState(false);
  const [montado, setMontado] = useState(false);
  const [erro, setErro] = useState("");
  const [processando, setProcessando] = useState<string | null>(null);
  const [mostrarLembrete, setMostrarLembrete] = useState(false);

  const carregar = useCallback(async () => {
    if (!uid) return;
    const [list, reads] = await Promise.all([
      supabase.from("avisos_globais")
        .select("id,titulo,mensagem,tipo,versao,publicado_em")
        .order("publicado_em", { ascending: false }).limit(30),
      supabase.from("avisos_leituras")
        .select("aviso_id,versao_lida").eq("user_id", uid),
    ]);
    if (list.error || reads.error) throw list.error || reads.error;
    setAvisos((list.data || []) as Aviso[]);
    const mapa: Record<string,number> = {};
    ((reads.data || []) as Leitura[]).forEach(r => { mapa[r.aviso_id] = r.versao_lida; });
    setLeituras(mapa);
  }, [supabase, uid]);

  useEffect(() => {
    setMontado(true);
    let ativo = true;
    if (uid) {
      void carregar().catch(() => { if (ativo) setErro("Não foi possível carregar os avisos."); });
    }
    const aoVoltar = () => {
      if (document.visibilityState === "visible" && uid) void carregar().catch(() => {});
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => { ativo = false; document.removeEventListener("visibilitychange", aoVoltar); };
  }, [uid, carregar]);

  const naoLidos = avisos.filter(a => leituras[a.id] !== a.versao);
  const primeiro = naoLidos[0] || null;
  const chave = primeiro ? "fotura_aviso_" + uid + "_" + primeiro.id + "_" + primeiro.versao : null;

  useEffect(() => {
    if (!primeiro || !chave || aberto || !montado) { setMostrarLembrete(false); return; }
    try { setMostrarLembrete(sessionStorage.getItem(chave) !== "oculto"); }
    catch { setMostrarLembrete(true); }
  }, [chave, primeiro, aberto, montado]);

  function adiar() {
    if (chave) { try { sessionStorage.setItem(chave, "oculto"); } catch {} }
    setMostrarLembrete(false);
  }

  async function marcarComoLido(aviso: Aviso) {
    if (!uid || processando) return;
    setProcessando(aviso.id); setErro("");
    const { error } = await supabase.from("avisos_leituras").upsert({
      aviso_id: aviso.id, user_id: uid, versao_lida: aviso.versao, lido_em: new Date().toISOString()
    }, { onConflict: "aviso_id,user_id" });
    if (error) {
      setErro("Não foi possível registrar a leitura. Tente novamente.");
    } else {
      setLeituras(anteriores => ({ ...anteriores, [aviso.id]: aviso.versao }));
    }
    setProcessando(null);
  }

  if (!uid) return null;
  return (
    <>
      <button type="button" className="mf-item mf-aviso-item" onClick={() => { setAberto(true); setMostrarLembrete(false); }}
        title="Avisos do Fotura" aria-label={naoLidos.length ? "Avisos do Fotura, " + naoLidos.length + " não lidos" : "Avisos do Fotura"}>
        <span className="mf-ic">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/>
          </svg>
        </span>
        <span className="mf-tx">Avisos do Fotura</span>
        {naoLidos.length > 0 && <span className="mf-badge" aria-hidden="true">{naoLidos.length > 9 ? "9+" : naoLidos.length}</span>}
      </button>

      {montado && mostrarLembrete && primeiro && !aberto && createPortal(
        <div className={"fotura-aviso-toast tipo-" + primeiro.tipo} role="status">
          <div className="fotura-aviso-toast-head"><strong>Novo aviso do Fotura</strong>
            <button type="button" aria-label="Lembrar mais tarde" onClick={adiar}>×</button>
          </div>
          <h3>{primeiro.titulo}</h3>
          <p>{primeiro.mensagem}</p>
          <div className="fotura-aviso-toast-actions">
            <button type="button" className="fotura-aviso-open" onClick={() => { setAberto(true); setMostrarLembrete(false); }}>Ler avisos</button>
            <button type="button" className="fotura-aviso-later" onClick={adiar}>Depois</button>
          </div>
        </div>, document.body)}

      {montado && aberto && createPortal(
        <FoturaDrawer title="Avisos do Fotura" description="Comunicados para os fotógrafos" onClose={() => setAberto(false)}>
          <div className="fotura-aviso-summary">{naoLidos.length ? naoLidos.length + " aviso(s) ainda não lido(s)" : "Você está em dia com os avisos"}</div>
          {erro && <div className="ft-drawer-error" role="alert">{erro}</div>}
          {avisos.length ? avisos.map(aviso => {
            const lido = leituras[aviso.id] === aviso.versao;
            return <article key={aviso.id} className={"fotura-aviso-card tipo-" + aviso.tipo + (lido ? " lido" : "")}>
              <div className="fotura-aviso-card-top">
                <span className="fotura-aviso-tipo">{TIPO[aviso.tipo]}</span>
                <span className="fotura-aviso-date">{dataCurta(aviso.publicado_em)}</span>
              </div>
              <h3>{aviso.titulo}</h3>
              <p>{aviso.mensagem}</p>
              {lido ? <span className="fotura-aviso-read">Lido</span> :
                <button className="ft-drawer-button primary" type="button"
                  disabled={!!processando} onClick={() => void marcarComoLido(aviso)}>
                  {processando === aviso.id ? "Salvando…" : "Marcar como lido"}
                </button>}
            </article>;
          }) : <p className="ft-drawer-note">Nenhum comunicado publicado no momento.</p>}
        </FoturaDrawer>, document.body)}
    </>
  );
}
