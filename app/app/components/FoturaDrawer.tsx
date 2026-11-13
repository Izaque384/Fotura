"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";

type Props = {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "default" | "wide";
  suspended?: boolean;
};

export default function FoturaDrawer({ title, description, onClose, children, footer, size = "default", suspended = false }: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeLatest = useRef(onClose);
  closeLatest.current = onClose;
  const suspendedLatest = useRef(suspended);
  suspendedLatest.current = suspended;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (suspendedLatest.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeLatest.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault(); focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        event.preventDefault(); focusable[0].focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = priorOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (!suspended) closeRef.current?.focus({ preventScroll: true });
  }, [suspended]);

  return (
    <div className={"ft-drawer-overlay" + (size === "wide" ? " ft-drawer-overlay--wide" : "")} onMouseDown={(event) => {
      if (!suspended && event.currentTarget === event.target) onClose();
    }}>
      <aside
        ref={panelRef}
        className={"ft-drawer-panel" + (size === "wide" ? " ft-drawer-panel--wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <header className="ft-drawer-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button ref={closeRef} className="ft-drawer-close" type="button" onClick={onClose} aria-label="Fechar painel">×</button>
        </header>
        <div className="ft-drawer-content">{children}</div>
        {footer && <div className="ft-drawer-footer">{footer}</div>}
      </aside>
    </div>
  );
}
