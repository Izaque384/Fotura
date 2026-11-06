import type { Metadata } from "next";
import AdminNavigation from "./AdminNavigation";
import "./admin-console.css";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-console">
      <AdminNavigation />
      {children}
    </div>
  );
}
