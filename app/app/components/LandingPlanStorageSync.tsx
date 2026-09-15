"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const trocas = new Map([
  ["20 GB de armazenamento", "10 GB de armazenamento"],
  ["100 GB de armazenamento", "50 GB de armazenamento"],
  ["500 GB de armazenamento", "100 GB de armazenamento"],
]);

export default function LandingPlanStorageSync() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    const aplicar = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node: Node | null = walker.nextNode();
      while (node) {
        const atual = node.nodeValue?.trim() ?? "";
        const novo = trocas.get(atual);
        if (novo && node.nodeValue) node.nodeValue = node.nodeValue.replace(atual, novo);
        node = walker.nextNode();
      }
    };

    aplicar();
    const observer = new MutationObserver(aplicar);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
