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
type Leitura = { aviso_id: string };
type Props = { uid: string };

const nomesTipos = { informacao: "Comunicado", novidade: "Novidade", atencao: "Aviso importante" } as const;
// Evita disparar outro anúncio em cada troca de página durante uma visita.
const vistosNestaVisita = new Set<string>();

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
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => { setMontado(true); }, []);

  useEffect(() => {
    if (!uid || vistosNestaVisita.has(uid)) return;
    let cancelado = false;

    void (async () => {
      const [avisosRes, leiturasRes] = await Promise.all([
        supabase.from("avisos_globais")
          .select("id,titulo,mensagem,tipo,versao,publicado_em")
          .order("publicado_em", { ascending: false }).limit(100),
        supabase.from("avisos_leituras")
          .select("aviso_id").eq("user_id", uid),
      ]);
      if (cancelado || avisosRes.error || leiturasRes.error) return;

      const vistos = new Set(((leiturasRes.data || []) as Leitura[]).map(l => l.aviso_id));
      const pendente = ((avisosRes.data || []) as Aviso[]).find(item => !vistos.has(item.id));
      if (!pendente || vistosNestaVisita.has(uid) || cancelado) return;

      // Reserva esta exibição no banco antes de abrir o modal.
      // A chave composta (aviso_id, user_id) impede reapresentação em outros dispositivos,
      // mesmo que dois aparelhos tentem abrir o aviso ao mesmo tempo.
      const { error } = await supabase.from("avisos_leituras").insert({
        aviso_id: pendente.id,
        user_id: uid,
        versao_lida: pendente.versao,
        lido_em: new Date().toISOString(),
      });
      if (error || cancelado) return;
      vistosNestaVisita.add(uid);
      setAviso(pendente);
    })().catch(() => {
      // Falhas de rede não devem bloquear a navegação do fotógrafo.
      // O aviso poderá ser tentado novamente em um próximo acesso.
    });

    return () => { cancelado = true; };
  }, [supabase, uid]);

  useEffect(() => {
    if (!aviso) return;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflowOriginal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    botaoFechar.current?.focus();

    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setAviso(null);
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
      if (event.currentTarget === event.target) setAviso(null);
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
            onClick={() => setAviso(null)} aria-label="Fechar anúncio">
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
          <button type="button" className="fotura-anuncio-action" onClick={() => setAviso(null)}>Entendi</button>
        </div>
      </section>
    </div>,
    document.body
  );
}
