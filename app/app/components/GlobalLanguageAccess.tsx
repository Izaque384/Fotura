"use client";

import { usePathname } from "next/navigation";
import LanguageSwitcher from "./LanguageSwitcher";
import { stripLocalePrefix } from "../../lib/i18n";

export default function GlobalLanguageAccess() {
  const pathname = stripLocalePrefix(usePathname() || "/");
  const hasOwnSwitcher = pathname === "/" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/upload" ||
    pathname === "/perfil" ||
    pathname === "/configuracoes" ||
    pathname === "/ajuda" ||
    pathname.startsWith("/admin");
  if (hasOwnSwitcher) return null;

  return (
    <div className="fotura-global-language">
      <LanguageSwitcher compact />
      <style>{`
        .fotura-global-language{position:fixed;top:14px;right:14px;z-index:100}
        @media(max-width:640px){.fotura-global-language{top:10px;right:10px}}
      `}</style>
    </div>
  );
}
