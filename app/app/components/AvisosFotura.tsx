"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "../../lib/supabase-client";

type Aviso = {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: "informacao" | "novidade" | "atencao";
  versao: number;
  publicado_em: string;
};
type Preferencia = { aviso_id: string; ocultar_permanentemente: boolean };
type Props = { uid: string };

const nomesTipos = { informacao: "Comunicado", novidade: "Novidade", atencao: "Aviso importante" } as const;
// Cada login/visita pode mostrar um anúncio. Navegação interna não repete o modal.
// Um novo login (last_sign_in_at) ou uma nova visita com recarga permite outra exibição.
const exibidosNestaEntrada = new Set<string>();

function dataCurta(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" :
    date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function AvisosFotura({ uid }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const tituloId = useId();
  const descricaoId = useId();
  const botaoFechar = useRef<HTMLButtonElement>(null);
  const fecharAtual = useRef<() => void>(() => {});
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [naoMostrar, setNaoMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroPreferencia, setErroPreferencia] = useState("");
  const [montado, setMontado] = useState(false);

  useEffect(() => { setMontado(true); }, []);

  useEffect(() => {
    if (!uid) return;
    let cancelado = false;

    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelado || !session || session.user.id !== uid) return;
      const chaveEntrada = uid + ":" + (session.user.last_sign_in_at || "sessao");
      if (exibidosNestaEntrada.has(chaveEntrada)) return;

      const [avisosRes, preferenciasRes] = await Promise.all([
        supabase.from("avisos_globais")
          .select("id,titulo,mensagem,tipo,versao,publicado_em")
          .order("publicado_em", { ascending: false }).limit(100),
        supabase.from("avisos_leituras")
          .select("aviso_id,ocultar_permanentemente").eq("user_id", uid)
          .eq("ocultar_permanentemente", true),
      ]);
      if (cancelado || avisosRes.error || preferenciasRes.error) return;

      // Visualizações de versões anteriores não representam opt-out explícito.
      const ocultos = new Set(((preferenciasRes.data || []) as Preferencia[])
        .filter(item => item.ocultar_permanentemente).map(item => item.aviso_id));
      const escolhido = ((avisosRes.data || []) as Aviso[]).find(item => !ocultos.has(item.id));
      if (!escolhido || cancelado || exibidosNestaEntrada.has(chaveEntrada)) return;

      exibidosNestaEntrada.add(chaveEntrada);
      setNaoMostrar(false);
      setErroPreferencia("");
      setAviso(escolhido);
    })().catch(() => {
      // Um erro de rede nunca deve bloquear o acesso ao painel.
    });

    return () => { cancelado = true; };
  }, [supabase, uid]);

  // Fechar normalmente não grava nenhuma leitura permanente. A opção é
  // registrada no Supabase apenas após escolha explícita do fotógrafo.
  async function fecharAviso() {
    if (!aviso || salvando) return;
    if (!naoMostrar) {
      setAviso(null);
      return;
    }
    setSalvando(true);
    setErroPreferencia("");
    try {
      const { error } = await supabase.from("avisos_leituras").upsert({
        aviso_id: aviso.id,
        user_id: uid,
        versao_lida: aviso.versao,
        lido_em: new Date().toISOString(),
        ocultar_permanentemente: true,
      }, { onConflict: "aviso_id,user_id" });

      if (error) throw error;
      setAviso(null);
    } catch {
      setErroPreferencia("Não foi possível salvar a preferência. Tente novamente ou feche sem salvar.");
    } finally {
      setSalvando(false);
    }
  }
  fecharAtual.current = () => { void fecharAviso(); };

  useEffect(() => {
    if (!aviso) return;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflowOriginal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    botaoFechar.current?.focus();

    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        fecharAtual.current();
      }
      if (event.key === "Tab") {
        const acoes = document.querySelectorAll<HTMLButtonElement>(".fotura-anuncio-dialog button:not([disabled])");
        const botoes = Array.from(acoes);
        if (!botoes.length) return;
        const primeiro = botoes[0], ultimo = botoes[botoes.length - 1];
        if (event.shiftKey && document.activeElement === primeiro) {
          event.preventDefault(); ultimo.focus();
        } else if (!event.shiftKey && document.activeElement === ultimo) {
          event.preventDefault(); primeiro.focus();
        }
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = overflowOriginal;
      document.removeEventListener("keydown", aoTeclar);
      anterior?.focus({ preventScroll: true });
    };
  }, [aviso]);

  if (!montado || !uid || !aviso) return null;
  return createPortal(
    <div className="fotura-anuncio-overlay" onMouseDown={event => {
      if (event.currentTarget === event.target) fecharAtual.current();
    }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descricaoId}
        className={"fotura-anuncio-dialog tipo-" + aviso.tipo}
      >
        <div className="fotura-anuncio-top">
          <div className="fotura-anuncio-brand">
            <strong>FOTURA</strong>
            <span className="fotura-anuncio-brand-separator" aria-hidden="true">·</span>
            <span className="fotura-anuncio-type">{nomesTipos[aviso.tipo]}</span>
          </div>
          <button ref={botaoFechar} type="button" className="fotura-anuncio-close"
            onClick={() => fecharAtual.current()} aria-label="Fechar anúncio" disabled={salvando}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="fotura-anuncio-content">
          <time className="fotura-anuncio-date" dateTime={aviso.publicado_em}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M16 3v4M8 3v4M3 10h18" />
            </svg>
            {dataCurta(aviso.publicado_em)}
          </time>
          <h2 id={tituloId}>{aviso.titulo}</h2>
          <p id={descricaoId}>{aviso.mensagem}</p>
        </div>
        <div className="fotura-anuncio-bottom">
          <label className="fotura-anuncio-choice">
            <input
              type="checkbox"
              checked={naoMostrar}
              onChange={event => {
                setNaoMostrar(event.target.checked);
                setErroPreferencia("");
              }}
              disabled={salvando}
            />
            <span>Não mostrar este aviso novamente</span>
          </label>
          <button type="button" className="fotura-anuncio-action"
            onClick={() => fecharAtual.current()} disabled={salvando}>
            {salvando ? "Salvando…" : "Entendi"}
          </button>
          {erroPreferencia && <div className="fotura-anuncio-preference-error" role="alert">
            <span>{erroPreferencia}</span>
            <button type="button" onClick={() => setAviso(null)}>Fechar sem salvar</button>
          </div>}
        </div>
      </section>
    </div>,
    document.body
  );
}
