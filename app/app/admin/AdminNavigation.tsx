"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const pages = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin#contas", label: "Contas" },
  { href: "/admin/uso", label: "Armazenamento" },
  { href: "/admin/analytics", label: "Produto" },
  { href: "/admin/saude", label: "Saúde" },
  { href: "/admin/lancamento", label: "Lançamento" },
  { href: "/admin/feedback", label: "Feedback" },
  { href: "/admin/auditoria", label: "Auditoria" },
];

export default function AdminNavigation() {
  const pathname = usePathname();
  return (
    <header className="admin-console-header">
      <div className="admin-console-header-inner">
        <div className="admin-console-brand" aria-label="Fotura — área administrativa">
          <span className="admin-console-brand-mark" aria-hidden="true">F</span>
          <span className="admin-console-brand-name">FOTURA <small>ADMIN</small></span>
        </div>
        <nav className="admin-console-nav" aria-label="Navegação administrativa">
          {pages.map(({ href, label }) => {
            const route = href.split("#")[0];
            const active = href === "/admin" ? pathname === "/admin" :
              href.includes("#") ? pathname.startsWith("/admin/contas") :
              pathname === route || pathname.startsWith(route + "/");
            return <Link key={href} href={href} className={"admin-console-nav-link" + (active ? " active" : "")} aria-current={active ? "page" : undefined}>{label}</Link>;
          })}
        </nav>
        <Link href="/dashboard" className="admin-console-return"><span aria-hidden="true">←</span> Voltar ao painel</Link>
      </div>
    </header>
  );
}
