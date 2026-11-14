"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { ChevronRightIcon } from "../../components/FoturaIcons";

type Rect = { top: number; left: number; width: number; height: number };

export default function SelectionGuide({
  open, step, selectRef, photoRef, onNext, onClose,
}: {
  open: boolean;
  step: 1 | 2;
  selectRef: RefObject<HTMLButtonElement | null>;
  photoRef: RefObject<HTMLImageElement | null>;
  onNext: () => void;
  onClose: () => void;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) { setRect(null); return; }
    let raf = 0;
    let active = true;
    const target = step === 1 ? selectRef.current : photoRef.current;
    if (target) target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!active) return;
        const node = step === 1 ? selectRef.current : photoRef.current;
        if (!node) { setRect(null); return; }
        const r = node.getBoundingClientRect();
        setRect({
          top: r.top,
          left: r.left,
          width: step === 1 ? r.width : Math.min(r.width, 230),
          height: step === 1 ? r.height : Math.min(r.height, 180),
        });
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const exit = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", exit);
    return () => {
      active = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("keydown", exit);
    };
  }, [open, step, selectRef, photoRef]);

  if (!open) return null;
  return <div className="gc-tour" role="dialog" aria-modal="true" aria-label="Guia rápido de seleção de fotos" onPointerDown={e => e.stopPropagation()}>
    {rect && <div className="gc-tour-spotlight" style={{
      top: Math.max(6, rect.top - 6),
      left: Math.max(6, rect.left - 6),
      width: rect.width + 12,
      height: rect.height + 12,
      borderRadius: step === 1 ? "50%" : "14px",
    }} />}
    <div className={"gc-tour-card gc-tour-step-" + step}>
      <div className="gc-tour-progress">
        <span>PASSO {step} DE 2</span>
        <div aria-hidden="true"><i className="on" /><i className={step === 2 ? "on" : ""} /></div>
      </div>
      <h2>{step === 1 ? "Escolha suas fotos favoritas" : "Amplie e comente"}</h2>
      <p>{step === 1
        ? "Toque na bolinha de cada foto que deseja selecionar. Quando terminar, use “Finalizar seleção”."
        : "Toque na foto para vê-la ampliada e, se quiser, deixe um comentário para o fotógrafo."}</p>
      <div className="gc-tour-actions">
        <button type="button" className="gc-tour-skip" onClick={onClose}>Pular</button>
        <button type="button" className="gc-tour-next" onClick={onNext}>
          {step === 1 ? "Próximo" : "Concluir"} <span><ChevronRightIcon size={16} /></span>
        </button>
      </div>
    </div>
  </div>;
}
