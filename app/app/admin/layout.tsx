import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>
    {children}
    <nav className="admin-global-nav" aria-label="Navegação administrativa">
      <Link href="/admin">Visão geral</Link>
      <Link href="/admin/saude">Saúde</Link>
      <Link href="/admin/lancamento">Lançamento</Link>
      <Link href="/admin/auditoria">Auditoria</Link>
    </nav>
    <style>{`
      .admin-global-nav{position:fixed;right:18px;bottom:18px;z-index:80;display:flex;gap:5px;padding:6px;background:rgba(10,10,25,.92);border:1px solid #292d47;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.28);backdrop-filter:blur(12px);font-family:Sora,sans-serif}
      .admin-global-nav a{color:#b8bdd1;text-decoration:none;font-size:10px;padding:7px 9px;border-radius:8px}
      .admin-global-nav a:hover{background:#191b31;color:#fff}
      @media(max-width:720px){.admin-global-nav{left:12px;right:12px;bottom:12px;justify-content:center}.admin-global-nav a{flex:1;text-align:center;padding:7px 5px}}
    `}</style>
  </>;
}
