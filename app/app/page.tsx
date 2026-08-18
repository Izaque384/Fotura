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
        .lp-brand svg { height: 28px; width: 32px; display: block; }
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

      <header className="lp-top">
        <div className="lp-brand">
          <svg viewBox="0 0 115 101" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="lpGrad" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1196fc" />
              <stop offset="1" stopColor="#5d0dfa" />
            </linearGradient>
          </defs>
          <g fill="url(#lpGrad)">
            <path d="M 65.5,6.1 C 60.6,6.6 56.3,8.3 52.5,11.4 C 51.2,12.4 49.5,14.1 40.1,23.2 C 36.2,27.0 31.6,31.5 29.7,33.3 C 27.8,35.1 24.4,38.4 22.2,40.7 C 19.9,42.9 16.6,46.1 14.9,47.8 C 9.3,53.2 8.5,54.0 7.7,55.1 C 6.4,57.1 6.0,58.5 6.0,60.7 C 6.0,62.4 6.1,63.0 6.8,64.3 C 7.8,66.3 9.5,67.7 12.0,68.4 C 12.9,68.7 12.9,68.7 17.0,68.7 C 21.5,68.8 22.3,68.7 24.1,68.2 C 26.8,67.3 29.0,66.0 31.4,63.8 C 34.4,61.0 42.6,53.2 43.9,52.0 C 44.7,51.2 46.2,49.7 47.4,48.7 C 50.1,46.1 56.8,39.7 59.1,37.4 C 60.1,36.4 61.3,35.3 61.7,34.9 C 64.5,32.6 67.9,31.2 71.5,30.9 C 72.2,30.8 76.2,30.8 80.4,30.8 C 85.4,30.9 88.6,30.8 89.3,30.8 C 92.1,30.5 94.4,29.7 96.7,28.2 C 97.9,27.3 98.2,27.1 101.4,24.1 C 106.2,19.7 107.0,18.8 107.9,16.9 C 108.7,15.5 108.9,14.4 108.8,12.9 C 108.7,11.0 108.3,9.8 107.0,8.5 C 106.1,7.5 104.8,6.7 103.2,6.2 C 102.5,6.0 102.5,6.0 84.4,6.0 C 74.5,6.0 65.9,6.0 65.5,6.1" />
            <path d="M 71.3,45.7 C 68.6,46.1 66.0,47.4 63.7,49.4 C 63.1,49.8 59.3,53.4 55.0,57.5 C 53.7,58.7 52.2,60.2 51.6,60.8 C 51.0,61.3 49.8,62.5 49.0,63.3 C 48.2,64.1 47.2,65.0 46.9,65.3 C 45.8,66.3 38.0,73.7 33.1,78.4 C 30.7,80.8 29.7,81.9 29.0,83.0 C 26.4,87.3 28.0,92.3 32.5,94.2 C 34.1,94.8 34.1,94.8 39.3,94.8 C 43.9,94.8 43.9,94.8 45.0,94.5 C 47.6,93.9 49.8,92.7 51.7,91.0 C 52.5,90.3 57.4,85.8 61.2,82.1 C 62.3,81.1 63.9,79.6 64.9,78.6 C 65.9,77.7 67.3,76.4 68.0,75.7 C 68.6,75.1 69.6,74.2 70.1,73.7 C 74.5,69.6 82.3,62.1 84.5,60.0 C 87.5,56.9 88.4,55.4 88.5,52.8 C 88.6,50.7 88.0,49.1 86.6,47.7 C 85.4,46.6 84.2,45.9 82.5,45.6 C 81.2,45.4 72.8,45.4 71.3,45.7" />
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
