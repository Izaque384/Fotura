"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const pages = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/avisos", label: "Avisos" },
  { href: "/admin/uso", label: "Armazenamento" },
  { href: "/admin/analytics", label: "Produto" },
  { href: "/admin/saude", label: "Saúde" },
  { href: "/admin/feedback", label: "Feedback" },
];

export default function AdminNavigation() {
  const pathname = usePathname().replace(/^\/(?:pt|en|es)(?=\/admin(?:\/|$))/, "");
  return (
    <header className="admin-console-header">
      <div className="admin-console-header-inner">
        <div className="admin-console-brand" aria-label="Fotura — área administrativa">
          <span className="admin-console-brand-mark" aria-hidden="true">F</span>
          <span className="admin-console-brand-name">FOTURA <small>ADMIN</small></span>
        </div>
        <nav className="admin-console-nav" aria-label="Navegação administrativa">
          {pages.map(({ href, label }) => {
            const active = href === "/admin" ? pathname === "/admin" :
              pathname === href || pathname.startsWith(href + "/");
            return <Link key={href} href={href} className={"admin-console-nav-link" + (active ? " active" : "")} aria-current={active ? "page" : undefined}>{label}</Link>;
          })}
        </nav>
        <Link href="/dashboard" className="admin-console-return"><span aria-hidden="true">←</span> Voltar ao painel</Link>
      </div>
    </header>
  );
}
