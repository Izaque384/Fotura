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

    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => translateDom(locale, document.body));
    };
    run();

    const observer = new MutationObserver(run);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "aria-label", "title", "alt"],
    });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
