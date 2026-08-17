"use client";

import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase-client";

export default function MenuFotografo() {
  const router = useRouter();
  const supabase = createClient();

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <header className="mf-header">
      <style>{`
        .mf-header {
          position: sticky; top: 0; z-index: 40;
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 24px;
          background: rgba(11,11,26,0.85);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid #23233a;
        }
        .mf-logo {
          font-size: 18px; font-weight: 700; letter-spacing: 3px;
          color: #f0f0f5; cursor: pointer; background: none; border: none;
        }
        .mf-nav { display: flex; align-items: center; gap: 8px; }
        .mf-link {
          padding: 8px 14px; font-size: 14px; font-weight: 500;
          color: #a0a4b8; background: none; border: none; border-radius: 8px;
          cursor: pointer;
        }
        .mf-link:hover { color: #f0f0f5; background: #1a1a2e; }
        .mf-sair {
          padding: 8px 16px; font-size: 14px; font-weight: 600;
          color: #fff; background: #4a6cf7; border: none; border-radius: 8px;
          cursor: pointer; margin-left: 4px;
        }
        .mf-sair:hover { background: #3b5de0; }
      `}</style>

      <button className="mf-logo" onClick={() => router.push("/dashboard")}>
        FOTURA
      </button>

      <nav className="mf-nav">
        <button className="mf-link" onClick={() => router.push("/dashboard")}>
          Galerias
        </button>
        <button className="mf-link" onClick={() => router.push("/upload")}>
          Enviar
        </button>
        <button className="mf-sair" onClick={sair}>
          Sair
        </button>
      </nav>
    </header>
  );
}
