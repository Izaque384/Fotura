"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase-client";

export default function Home() {
  const router = useRouter();
  const supabase = createClient();
  const [logado, setLogado] = useState(false);

  // Se já estiver logado, mostra "Ir para o painel" em vez de "Entrar"
  useEffect(() => {
    async function checar() {
      const { data } = await supabase.auth.getUser();
      setLogado(Boolean(data.user));
    }
    checar();
  }, [supabase]);

  return (
    <div className="lp">
      <style>{`
        .lp {
          min-height: 100vh;
          background:
            radial-gradient(1200px 600px at 50% -10%, rgba(74,108,247,0.18), transparent 60%),
            linear-gradient(180deg, #0b0b1a 0%, #111126 100%);
          display: flex;
          flex-direction: column;
        }

        /* Cabeçalho da landing */
        .lp-top {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 32px;
          max-width: 1120px; width: 100%; margin: 0 auto;
        }
        .lp-brand { display: flex; align-items: center; gap: 10px; }
        .lp-brand svg { height: 30px; width: 30px; display: block; }
        .lp-brand span { font-size: 20px; font-weight: 700; letter-spacing: 3px; color: #f0f0f5; }
        .lp-top-actions { display: flex; align-items: center; gap: 10px; }
        .lp-ghost {
          padding: 9px 18px; font-size: 14px; font-weight: 600;
          color: #cdd2e4; background: transparent; border: 1px solid #2a2d40;
          border-radius: 10px; cursor: pointer; text-decoration: none;
        }
        .lp-ghost:hover { border-color: #4a6cf7; color: #fff; }

        /* Hero central */
        .lp-hero {
          flex: 1;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; padding: 60px 24px 40px;
        }
        .lp-mark { height: 84px; width: 84px; margin-bottom: 28px; }
        .lp-pill {
          display: inline-block; font-size: 12px; font-weight: 600; letter-spacing: 1px;
          color: #9fb0ff; background: rgba(74,108,247,0.12); border: 1px solid rgba(74,108,247,0.35);
          padding: 6px 14px; border-radius: 999px; margin-bottom: 24px; text-transform: uppercase;
        }
        .lp-title {
          font-size: clamp(36px, 6vw, 64px); font-weight: 700; line-height: 1.08;
          color: #f5f6fb; margin: 0 0 20px; max-width: 780px; letter-spacing: -1px;
        }
        .lp-title .grad {
          background: linear-gradient(90deg, #2F72FF, #6422E8);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .lp-sub {
          font-size: clamp(15px, 2.2vw, 19px); color: #9aa0b8; max-width: 560px;
          line-height: 1.6; margin: 0 0 40px;
        }
        .lp-cta { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
        .lp-primary {
          padding: 15px 30px; font-size: 15px; font-weight: 700; color: #fff;
          background: linear-gradient(90deg, #4a6cf7, #6422E8);
          border: none; border-radius: 12px; cursor: pointer; text-decoration: none;
          box-shadow: 0 10px 30px rgba(74,108,247,0.35);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .lp-primary:hover { transform: translateY(-2px); box-shadow: 0 14px 40px rgba(74,108,247,0.5); }
        .lp-secondary {
          padding: 15px 30px; font-size: 15px; font-weight: 600; color: #cdd2e4;
          background: rgba(255,255,255,0.04); border: 1px solid #2a2d40;
          border-radius: 12px; cursor: pointer; text-decoration: none;
        }
        .lp-secondary:hover { border-color: #4a6cf7; color: #fff; }

        /* Faixa dos 3 passos */
        .lp-steps {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
          max-width: 900px; width: 100%; margin: 20px auto 0; padding: 0 24px 64px;
        }
        .lp-step {
          background: rgba(255,255,255,0.03); border: 1px solid #1e2036;
          border-radius: 14px; padding: 22px; text-align: left;
        }
        .lp-step-n {
          display: inline-flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border-radius: 8px; margin-bottom: 12px;
          background: rgba(74,108,247,0.15); color: #9fb0ff; font-weight: 700; font-size: 14px;
        }
        .lp-step-t { font-size: 15px; font-weight: 600; color: #eef1f6; margin: 0 0 6px; }
        .lp-step-d { font-size: 13px; color: #8a90a8; margin: 0; line-height: 1.5; }

        .lp-foot { text-align: center; color: #5a5f78; font-size: 12px; padding: 0 24px 28px; }

        @media (max-width: 680px) {
          .lp-steps { grid-template-columns: 1fr; }
          .lp-top { padding: 16px 20px; }
        }
      `}</style>

      {/* Símbolo da marca (inline, na cor degradê) — usado no topo e no hero */}
      <span style={{ display: "none" }} />

      <header className="lp-top">
        <div className="lp-brand">
          <svg viewBox="0 0 210 210" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              <linearGradient id="lpGrad" x1="55" y1="15" x2="205" y2="205" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#2F72FF" />
                <stop offset="0.52" stopColor="#3E55F2" />
                <stop offset="1" stopColor="#6422E8" />
              </linearGradient>
            </defs>
            <g transform="translate(0,4)" fill="url(#lpGrad)">
              <path d="M 44 133 C 35 133 28 128 24 120 C 20 112 22 103 28 97 L 96 29 C 103 22 112 18 122 18 L 164 18 C 177 18 187 28 187 41 C 187 54 177 64 164 64 L 133 64 L 61 133 C 56 137 49 139 44 133 Z" />
              <path d="M 82 194 C 72 194 65 189 61 181 C 57 173 59 164 65 158 L 112 111 C 119 104 128 101 137 101 L 151 101 C 164 101 174 111 174 124 C 174 137 164 147 151 147 L 130 147 L 99 178 C 94 183 88 188 82 194 Z" />
            </g>
          </svg>
          <span>FOTURA</span>
        </div>
        <div className="lp-top-actions">
          <a className="lp-ghost" href={logado ? "/dashboard" : "/login"}>
            {logado ? "Ir para o painel" : "Entrar"}
          </a>
        </div>
      </header>

      <main className="lp-hero">
        <svg className="lp-mark" viewBox="0 0 210 210" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <g transform="translate(0,4)" fill="url(#lpGrad)">
            <path d="M 44 133 C 35 133 28 128 24 120 C 20 112 22 103 28 97 L 96 29 C 103 22 112 18 122 18 L 164 18 C 177 18 187 28 187 41 C 187 54 177 64 164 64 L 133 64 L 61 133 C 56 137 49 139 44 133 Z" />
            <path d="M 82 194 C 72 194 65 189 61 181 C 57 173 59 164 65 158 L 112 111 C 119 104 128 101 137 101 L 151 101 C 164 101 174 111 174 124 C 174 137 164 147 151 147 L 130 147 L 99 178 C 94 183 88 188 82 194 Z" />
          </g>
        </svg>

        <span className="lp-pill">Entrega de fotos para fotógrafos</span>

        <h1 className="lp-title">
          A forma mais <span className="grad">bonita</span> de entregar fotos
        </h1>

        <p className="lp-sub">
          Suba as fotos, gere um link com a sua marca e deixe o cliente visualizar
          e baixar — simples, rápido e elegante.
        </p>

        <div className="lp-cta">
          <a className="lp-primary" href={logado ? "/dashboard" : "/login"}>
            {logado ? "Ir para o painel" : "Começar agora"}
          </a>
          <a className="lp-secondary" href="/login">
            Já tenho conta
          </a>
        </div>
      </main>

      <section className="lp-steps">
        <div className="lp-step">
          <div className="lp-step-n">1</div>
          <p className="lp-step-t">Envie as fotos</p>
          <p className="lp-step-d">Faça o upload da galeria do seu cliente em segundos.</p>
        </div>
        <div className="lp-step">
          <div className="lp-step-n">2</div>
          <p className="lp-step-t">Compartilhe o link</p>
          <p className="lp-step-d">Um endereço único e bonito para cada galeria.</p>
        </div>
        <div className="lp-step">
          <div className="lp-step-n">3</div>
          <p className="lp-step-t">O cliente baixa</p>
          <p className="lp-step-d">Sem cadastro, sem complicação. Só as fotos.</p>
        </div>
      </section>

      <footer className="lp-foot">© {new Date().getFullYear()} Fotura</footer>
    </div>
  );
}
