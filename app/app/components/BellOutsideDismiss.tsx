"use client";

import { useEffect } from "react";

export default function BellOutsideDismiss() {
  useEffect(() => {
    function aoClicar(event: PointerEvent) {
      const alvo = event.target;
      if (!(alvo instanceof Element)) return;
      const popover = document.querySelector<HTMLElement>(".bell-pop");
      if (!popover) return;
      if (alvo.closest(".bell-pop") || alvo.closest(".bell")) return;
      const sino = document.querySelector<HTMLButtonElement>(".bell[aria-expanded='true']");
      sino?.click();
    }

    document.addEventListener("pointerdown", aoClicar);
    return () => document.removeEventListener("pointerdown", aoClicar);
  }, []);

  return null;
}
