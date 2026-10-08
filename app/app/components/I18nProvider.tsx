"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { type Locale, translate, translatePreservingWhitespace } from "../../lib/i18n";

type I18nContextValue = {
  locale: Locale;
  t: (source: string) => string;
};

const I18nContext = createContext<I18nContextValue>({
  locale: "pt",
  t: (source) => source,
});

function shouldSkip(node: Node) {
  const parent = node.parentElement;
  if (!parent) return false;
  return Boolean(parent.closest("script,style,code,pre,[data-no-i18n],[contenteditable='true']"));
}

function translateElementAttributes(locale: Locale, root: ParentNode) {
  root.querySelectorAll<HTMLElement>("[placeholder],[aria-label],[title],[alt]").forEach((element) => {
    for (const attribute of ["placeholder", "aria-label", "title", "alt"]) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const translated = translate(locale, value);
      if (translated !== value) element.setAttribute(attribute, translated);
    }
  });
}

function translateDom(locale: Locale, root: ParentNode) {
  if (locale === "pt") return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    if (!shouldSkip(current)) nodes.push(current as Text);
    current = walker.nextNode();
  }
  for (const node of nodes) {
    const source = node.nodeValue ?? "";
    const translated = translatePreservingWhitespace(locale, source);
    if (translated !== source) node.nodeValue = translated;
  }
  translateElementAttributes(locale, root);
}

export default function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nContextValue>(() => ({
    locale,
    t: (source) => translate(locale, source),
  }), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale === "pt" ? "pt-BR" : locale;
    if (locale === "pt") return;

    let translateFrame = 0;
    let startFrameA = 0;
    let startFrameB = 0;
    let startTimer = 0;
    let observer: MutationObserver | null = null;
    let started = false;

    const run = () => {
      cancelAnimationFrame(translateFrame);
      translateFrame = requestAnimationFrame(() => translateDom(locale, document.body));
    };

    const start = () => {
      if (started) return;
      started = true;
      run();
      observer = new MutationObserver(run);
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["placeholder", "aria-label", "title", "alt"],
      });
    };

    const scheduleStart = () => {
      startTimer = window.setTimeout(() => {
        startFrameA = requestAnimationFrame(() => {
          startFrameB = requestAnimationFrame(start);
        });
      }, 0);
    };

    if (document.readyState === "complete") scheduleStart();
    else window.addEventListener("load", scheduleStart, { once: true });

    return () => {
      window.removeEventListener("load", scheduleStart);
      observer?.disconnect();
      window.clearTimeout(startTimer);
      cancelAnimationFrame(startFrameA);
      cancelAnimationFrame(startFrameB);
      cancelAnimationFrame(translateFrame);
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
