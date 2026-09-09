"use client";

import { useEffect, useState } from "react";
import FoturaLoadingScreen from "./FoturaLoadingScreen";

const LEGACY_LOADING_TEXTS = [
  "Verificando seu plano",
  "Carregando painel",
];

export default function LegacyLoadingBridge() {
  const [ativo, setAtivo] = useState(false);

  useEffect(() => {
    let frame = 0;

    const verificar = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const texto = document.body?.innerText ?? "";
        setAtivo(LEGACY_LOADING_TEXTS.some((alvo) => texto.includes(alvo)));
      });
    };

    verificar();
    const observer = new MutationObserver(verificar);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return ativo ? <FoturaLoadingScreen /> : null;
}
