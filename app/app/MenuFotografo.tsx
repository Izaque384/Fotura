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
          padding: 12px 24px;
          background: rgba(11,11,26,0.85);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid #23233a;
        }
        .mf-logo {
          display: flex; align-items: center; gap: 10px;
          background: none; border: none; cursor: pointer; padding: 0;
        }
        .mf-icon { height: 30px; width: 30px; display: block; }
        .mf-wordmark {
          font-size: 20px; font-weight: 700; letter-spacing: 3px;
          color: #f0f0f5;
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

      <button className="mf-logo" onClick={() => router.push("/dashboard")} aria-label="Ir para o início">
        <svg className="mf-icon" viewBox="0 0 210 210" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="mfGrad" x1="55" y1="15" x2="205" y2="205" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#2F72FF" />
              <stop offset="0.52" stopColor="#3E55F2" />
              <stop offset="1" stopColor="#6422E8" />
            </linearGradient>
          </defs>
          <g transform="translate(0,4)" fill="url(#mfGrad)">
            <path d="M 44 133 C 35 133 28 128 24 120 C 20 112 22 103 28 97 L 96 29 C 103 22 112 18 122 18 L 164 18 C 177 18 187 28 187 41 C 187 54 177 64 164 64 L 133 64 L 61 133 C 56 137 49 139 44 133 Z" />
            <path d="M 82 194 C 72 194 65 189 61 181 C 57 173 59 164 65 158 L 112 111 C 119 104 128 101 137 101 L 151 101 C 164 101 174 111 174 124 C 174 137 164 147 151 147 L 130 147 L 99 178 C 94 183 88 188 82 194 Z" />
          </g>
        </svg>
        <span className="mf-wordmark">FOTURA</span>
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
