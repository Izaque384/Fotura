import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>
    {children}
    <nav className="admin-global-nav" aria-label="Navegação administrativa">
      <Link href="/admin">Visão geral</Link>
      <Link href="/admin/saude">Saúde</Link>
      <Link href="/admin/lancamento">Lançamento</Link>
      <Link href="/admin/analytics">Produto</Link>
      <Link href="/admin/auditoria">Auditoria</Link>
    </nav>
    <style>{`
      .admin-global-nav{position:fixed;right:18px;bottom:18px;z-index:80;display:flex;gap:5px;padding:6px;background:rgba(250,248,253,.94);border:1px solid #D7D0E7;border-radius:12px;box-shadow:0 10px 30px rgba(65,52,111,.12);backdrop-filter:blur(12px);font-family:Sora,sans-serif}
      .admin-global-nav a{color:#596079;text-decoration:none;font-size:10px;padding:7px 9px;border-radius:8px}
      .admin-global-nav a:hover{background:#F3EFF9;color:#21253A}
      @media(max-width:720px){.admin-global-nav{left:12px;right:12px;bottom:12px;justify-content:center}.admin-global-nav a{flex:1;text-align:center;padding:7px 5px}}
    `}</style>
  </>;
}
