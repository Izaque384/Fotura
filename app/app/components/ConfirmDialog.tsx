"use client";

import { useEffect, useId, useRef } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  loading = false,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => cancelRef.current?.focus());

    function teclado(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focaveis = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((elemento) => !elemento.hasAttribute("disabled"));
      if (!focaveis.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primeiro.focus();
      }
    }

    window.addEventListener("keydown", teclado);
    return () => {
      window.removeEventListener("keydown", teclado);
      document.body.style.overflow = overflowAnterior;
      requestAnimationFrame(() => anterior?.focus());
    };
  }, [loading, onCancel, open]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 160,
        background: "var(--ft-backdrop)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        style={{
          width: "min(440px, 100%)",
          background: "linear-gradient(180deg,var(--ft-surface),var(--ft-surface-muted))",
          border: "1px solid var(--ft-border)",
          borderRadius: "var(--ft-radius-panel)",
          padding: "clamp(18px, 5vw, 22px)",
          boxShadow: "var(--ft-shadow-modal)",
          color: "var(--ft-text)",
          boxSizing: "border-box",
        }}
      >
        <h2 id={titleId} style={{ margin: 0, fontSize: "var(--ft-font-xl)", fontWeight: 700 }}>
          {title}
        </h2>
        <p
          id={descriptionId}
          style={{ margin: "10px 0 20px", color: "var(--ft-text-muted)", fontSize: "var(--ft-font-md)", lineHeight: 1.6 }}
        >
          {description}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              minHeight: 44,
              border: "1px solid var(--ft-border)",
              borderRadius: "var(--ft-radius-control)",
              padding: "10px 14px",
              color: "var(--ft-text-secondary)",
              background: "var(--ft-surface-muted)",
              fontFamily: "inherit",
              fontWeight: 600,
              fontSize: "var(--ft-font-sm)",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.65 : 1,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading}
            style={{
              minHeight: 44,
              border: 0,
              borderRadius: "var(--ft-radius-control)",
              padding: "10px 14px",
              color: "#fff",
              background: danger ? "#b4232f" : "var(--ft-brand-gradient)",
              fontFamily: "inherit",
              fontWeight: 600,
              fontSize: "var(--ft-font-sm)",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Aguarde..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
