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
        .mf-icon { height: 28px; width: 32px; display: block; }
        .mf-wordmark {
          font-size: 20px; font-weight: 700; letter-spacing: 3px;
          color: #f0f0f5;
        }
        .mf-nav { display: flex; align-items: center; gap: 6px; }
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
        <svg className="mf-icon" viewBox="0 0 115 101" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="mfGrad" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1196fc" />
              <stop offset="1" stopColor="#5d0dfa" />
            </linearGradient>
          </defs>
          <g fill="url(#mfGrad)">
            <path d="M 65.5,6.1 C 60.6,6.6 56.3,8.3 52.5,11.4 C 51.2,12.4 49.5,14.1 40.1,23.2 C 36.2,27.0 31.6,31.5 29.7,33.3 C 27.8,35.1 24.4,38.4 22.2,40.7 C 19.9,42.9 16.6,46.1 14.9,47.8 C 9.3,53.2 8.5,54.0 7.7,55.1 C 6.4,57.1 6.0,58.5 6.0,60.7 C 6.0,62.4 6.1,63.0 6.8,64.3 C 7.8,66.3 9.5,67.7 12.0,68.4 C 12.9,68.7 12.9,68.7 17.0,68.7 C 21.5,68.8 22.3,68.7 24.1,68.2 C 26.8,67.3 29.0,66.0 31.4,63.8 C 34.4,61.0 42.6,53.2 43.9,52.0 C 44.7,51.2 46.2,49.7 47.4,48.7 C 50.1,46.1 56.8,39.7 59.1,37.4 C 60.1,36.4 61.3,35.3 61.7,34.9 C 64.5,32.6 67.9,31.2 71.5,30.9 C 72.2,30.8 76.2,30.8 80.4,30.8 C 85.4,30.9 88.6,30.8 89.3,30.8 C 92.1,30.5 94.4,29.7 96.7,28.2 C 97.9,27.3 98.2,27.1 101.4,24.1 C 106.2,19.7 107.0,18.8 107.9,16.9 C 108.7,15.5 108.9,14.4 108.8,12.9 C 108.7,11.0 108.3,9.8 107.0,8.5 C 106.1,7.5 104.8,6.7 103.2,6.2 C 102.5,6.0 102.5,6.0 84.4,6.0 C 74.5,6.0 65.9,6.0 65.5,6.1" />
            <path d="M 71.3,45.7 C 68.6,46.1 66.0,47.4 63.7,49.4 C 63.1,49.8 59.3,53.4 55.0,57.5 C 53.7,58.7 52.2,60.2 51.6,60.8 C 51.0,61.3 49.8,62.5 49.0,63.3 C 48.2,64.1 47.2,65.0 46.9,65.3 C 45.8,66.3 38.0,73.7 33.1,78.4 C 30.7,80.8 29.7,81.9 29.0,83.0 C 26.4,87.3 28.0,92.3 32.5,94.2 C 34.1,94.8 34.1,94.8 39.3,94.8 C 43.9,94.8 43.9,94.8 45.0,94.5 C 47.6,93.9 49.8,92.7 51.7,91.0 C 52.5,90.3 57.4,85.8 61.2,82.1 C 62.3,81.1 63.9,79.6 64.9,78.6 C 65.9,77.7 67.3,76.4 68.0,75.7 C 68.6,75.1 69.6,74.2 70.1,73.7 C 74.5,69.6 82.3,62.1 84.5,60.0 C 87.5,56.9 88.4,55.4 88.5,52.8 C 88.6,50.7 88.0,49.1 86.6,47.7 C 85.4,46.6 84.2,45.9 82.5,45.6 C 81.2,45.4 72.8,45.4 71.3,45.7" />
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
        <button className="mf-link" onClick={() => router.push("/configuracoes")}>
          Configurações
        </button>
        <button className="mf-sair" onClick={sair}>
          Sair
        </button>
      </nav>
    </header>
  );
}
