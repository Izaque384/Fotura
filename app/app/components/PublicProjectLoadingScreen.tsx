/**
 * Estado de espera da página pública do projeto.
 * CSS puro: nenhuma espera artificial, nenhuma foto é carregada antes de verificar o acesso.
 */
export default function PublicProjectLoadingScreen() {
  return (
    <main className="fpl-screen" role="status" aria-live="polite" aria-label="Carregando projeto fotográfico">
      <div className="fpl-ambient fpl-ambient-left" aria-hidden="true" />
      <div className="fpl-ambient fpl-ambient-right" aria-hidden="true" />

      <div className="fpl-content">
        <div className="fpl-mark" aria-hidden="true">
          <span className="fpl-mark-glow" />
          <span className="fpl-symbol" />
        </div>
        <div className="fpl-brand">FOTURA</div>
        <div className="fpl-rule" aria-hidden="true" />

        <h1 className="fpl-title">Cada momento merece ser revivido.</h1>
        <p className="fpl-description">Preparando suas fotografias...</p>

        <div className="fpl-progress" aria-hidden="true"><span /></div>
      </div>

      <div className="fpl-footnote">UMA EXPERIÊNCIA FOTOGRÁFICA</div>

      <style>{`
        .fpl-screen {
          position: fixed;
          inset: 0;
          isolation: isolate;
          box-sizing: border-box;
          width: 100%;
          min-height: 100vh;
          min-height: 100dvh;
          z-index: 1000;
          display: grid;
          place-items: center;
          overflow: hidden;
          padding: 32px 24px;
          background: #0d0e19;
          color: #fff;
          font-family: var(--font-sora), Sora, system-ui, sans-serif;
        }
        .fpl-screen::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          background: radial-gradient(ellipse at 50% 44%, rgba(33, 36, 69, .48) 0%, transparent 63%),
            linear-gradient(152deg, rgba(39, 47, 85, .17), transparent 47%, rgba(63, 35, 110, .12));
        }
        .fpl-screen::after {
          content: "";
          position: absolute;
          inset: 18px;
          border: 1px solid rgba(226, 225, 255, .06);
          border-radius: 3px;
          pointer-events: none;
        }
        .fpl-ambient {
          position: absolute;
          width: min(42vw, 530px);
          height: min(42vw, 530px);
          border-radius: 50%;
          filter: blur(95px);
          opacity: .18;
          pointer-events: none;
          z-index: -1;
        }
        .fpl-ambient-left { left: -17%; top: 9%; background: #3e67dd; }
        .fpl-ambient-right { right: -20%; bottom: 1%; background: #7040e6; }
        .fpl-content {
          width: min(540px, 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .fpl-mark {
          position: relative;
          display: grid;
          place-items: center;
          width: 94px;
          height: 94px;
          margin-bottom: 12px;
        }
        .fpl-mark-glow {
          position: absolute;
          inset: 10px;
          border-radius: 50%;
          background: #5457ee;
          filter: blur(36px);
          opacity: .28;
          animation: fpl-breathe 3.8s ease-in-out infinite;
        }
        .fpl-symbol {
          position: relative;
          width: 61px;
          height: 61px;
          background: url("/favicon.svg") center / contain no-repeat;
          animation: fpl-enter .75s ease-out both;
        }
        .fpl-brand {
          margin-left: .3em;
          color: #f7f7ff;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: .34em;
        }
        .fpl-rule {
          height: 1px;
          width: 44px;
          margin: 28px 0;
          background: linear-gradient(90deg, transparent, rgba(209, 203, 255, .78), transparent);
        }
        .fpl-title {
          max-width: 480px;
          margin: 0;
          font-size: clamp(27px, 4.3vw, 42px);
          font-weight: 500;
          line-height: 1.23;
          letter-spacing: -.04em;
          color: #fff !important;
          text-wrap: balance;
          text-shadow: 0 5px 26px rgba(0,0,0,.2);
          animation: fpl-enter .85s .12s ease-out both;
        }
        .fpl-description {
          margin: 19px 0 0;
          color: #b4b7ce;
          font-size: 13px;
          font-weight: 400;
          line-height: 1.6;
          letter-spacing: .015em;
        }
        .fpl-progress {
          width: 148px;
          height: 2px;
          border-radius: 99px;
          overflow: hidden;
          margin-top: 30px;
          background: rgba(198, 198, 238, .18);
        }
        .fpl-progress span {
          display: block;
          width: 36%;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #38a0ff, #8360ff);
          animation: fpl-travel 1.9s ease-in-out infinite;
        }
        .fpl-footnote {
          position: absolute;
          bottom: max(37px, env(safe-area-inset-bottom) + 24px);
          left: 18px;
          right: 18px;
          text-align: center;
          color: rgba(198, 196, 224, .48);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: .23em;
        }
        @keyframes fpl-travel {
          0% { transform: translateX(-110%); opacity: .35; }
          20%, 80% { opacity: 1; }
          100% { transform: translateX(310%); opacity: .35; }
        }
        @keyframes fpl-breathe {
          0%, 100% { opacity: .18; transform: scale(.9); }
          50% { opacity: .35; transform: scale(1.1); }
        }
        @keyframes fpl-enter {
          from { transform: translateY(9px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (max-width: 640px) {
          .fpl-screen { padding: 24px 28px; }
          .fpl-screen::after { inset: 12px; }
          .fpl-mark { width: 86px; height: 86px; }
          .fpl-symbol { width: 56px; height: 56px; }
          .fpl-rule { margin: 25px 0; }
          .fpl-title { font-size: clamp(27px, 7vw, 36px); }
          .fpl-description { font-size: 12px; }
          .fpl-footnote { font-size: 9px; letter-spacing: .18em; }
        }
        @media (prefers-reduced-motion: reduce) {
          .fpl-mark-glow, .fpl-symbol, .fpl-title, .fpl-progress span { animation: none !important; }
          .fpl-progress span { width: 100%; opacity: .7; }
        }
      `}</style>
    </main>
  );
}
