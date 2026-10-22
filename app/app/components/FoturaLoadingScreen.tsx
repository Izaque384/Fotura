export default function FoturaLoadingScreen() {
  return (
    <main className="fotura-loading" role="status" aria-live="polite" aria-label="Carregando Fotura">
      <section className="fotura-loading__content">
        <div className="fotura-loading__halo" aria-hidden="true" />
        <div className="fotura-loading__logo" aria-hidden="true" />

        <div className="fotura-loading__brand">FOTURA</div>
        <p className="fotura-loading__message">Preparando seu espaço</p>

        <div className="fotura-loading__progress" aria-hidden="true"><span /></div>
      </section>

      <style>{`
        .fotura-loading {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: grid;
          place-items: center;
          min-height: 100dvh;
          overflow: hidden;
          background: #111222;
          color: #f8f7ff;
          font-family: var(--font-sora), Sora, system-ui, sans-serif;
        }
        .fotura-loading__content {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: min(320px, calc(100vw - 48px));
          text-align: center;
          isolation: isolate;
        }
        .fotura-loading__halo {
          position: absolute;
          top: -36px;
          left: 50%;
          z-index: -1;
          width: 190px;
          height: 190px;
          transform: translateX(-50%);
          border-radius: 50%;
          background: radial-gradient(circle, rgba(82, 69, 230, .16) 0%, rgba(18, 17, 44, 0) 72%);
          pointer-events: none;
        }
        .fotura-loading__logo {
          width: 88px;
          height: 88px;
          margin-bottom: 18px;
          background: url("/favicon.svg") center / contain no-repeat;
          animation: fotura-loading-appear .65s ease-out both;
        }
        .fotura-loading__brand {
          margin-left: .18em;
          font-size: 17px;
          font-weight: 700;
          line-height: 1.35;
          letter-spacing: .22em;
        }
        .fotura-loading__message {
          margin: 9px 0 27px;
          font-size: 12px;
          font-weight: 400;
          line-height: 1.5;
          letter-spacing: .01em;
          color: #a9aec6;
        }
        .fotura-loading__progress {
          position: relative;
          overflow: hidden;
          width: 112px;
          height: 2px;
          border-radius: 999px;
          background: rgba(197, 197, 233, .14);
        }
        .fotura-loading__progress span {
          display: block;
          width: 36%;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #1196fc, #6550fa);
          animation: fotura-loading-progress 1.55s cubic-bezier(.4, 0, .2, 1) infinite;
        }
        @keyframes fotura-loading-progress {
          0% { transform: translateX(-100%); opacity: .3; }
          25% { opacity: 1; }
          75% { opacity: 1; }
          100% { transform: translateX(310%); opacity: .3; }
        }
        @keyframes fotura-loading-appear {
          from { opacity: 0; transform: translateY(7px) scale(.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (max-width: 640px) {
          .fotura-loading__logo { width: 80px; height: 80px; margin-bottom: 16px; }
          .fotura-loading__brand { font-size: 16px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .fotura-loading__logo,
          .fotura-loading__progress span { animation: none; }
        }
      `}</style>
    </main>
  );
}
