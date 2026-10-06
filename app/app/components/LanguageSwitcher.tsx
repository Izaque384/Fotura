"use client";

import { useState } from "react";
import { createClient } from "../../lib/supabase-client";
import { LOCALE_COOKIE, type Locale, localeLabel, withLocalePath } from "../../lib/i18n";
import { useI18n } from "./I18nProvider";

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale } = useI18n();
  const [saving, setSaving] = useState(false);

  async function persistLocale(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    try { localStorage.setItem(LOCALE_COOKIE, next); } catch {}

    try {
      setSaving(true);
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await supabase.auth.updateUser({ data: { language: next } });
        const { data: profile } = await supabase
          .from("perfis")
          .select("configs")
          .eq("id", data.user.id)
          .maybeSingle();
        const configs = profile?.configs && typeof profile.configs === "object" && !Array.isArray(profile.configs)
          ? profile.configs as Record<string, unknown>
          : {};
        await supabase.from("perfis").upsert({
          id: data.user.id,
          configs: { ...configs, idioma: next },
          atualizado_em: new Date().toISOString(),
        });
      }
    } catch {
      // A navegação e o cookie continuam válidos mesmo se a sincronização da conta falhar.
    } finally {
      setSaving(false);
    }
  }

  async function change(next: Locale) {
    if (next === locale || saving) return;
    await persistLocale(next);
    const path = window.location.pathname + window.location.search + window.location.hash;
    window.location.assign(withLocalePath(path, next));
  }

  return (
    <label
      className={compact ? "fotura-language compact" : "fotura-language"}
      aria-label={locale === "pt" ? "Idioma" : locale === "en" ? "Language" : "Idioma"}
    >
      <span aria-hidden="true">◎</span>
      <select
        value={locale}
        disabled={saving}
        onChange={(event) => void change(event.target.value as Locale)}
        aria-label={locale === "pt" ? "Selecionar idioma" : locale === "en" ? "Select language" : "Seleccionar idioma"}
      >
        {(["pt", "en", "es"] as Locale[]).map((item) => (
          <option key={item} value={item}>{localeLabel(item)}</option>
        ))}
      </select>
      <style>{`
        .fotura-language{display:inline-flex;align-items:center;gap:7px;min-height:36px;padding:0 9px;border:1px solid rgba(35,39,49,.14);border-radius:9px;background:rgba(255,255,255,.48);color:#596079;font:700 10px/1 Sora,system-ui,sans-serif}
        .fotura-language select{appearance:none;border:0;outline:0;background:transparent;color:inherit;font:inherit;cursor:pointer;padding:0 3px}
        .fotura-language select:disabled{opacity:.55;cursor:default}
        .fotura-language.compact{min-height:32px;padding:0 8px;background:rgba(250,248,253,.7)}
      `}</style>
    </label>
  );
}
