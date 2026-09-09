"use client";

export default function FoturaLoadingScreen() {
  return (
    <main className="fotura-loading" role="status" aria-live="polite" aria-label="Carregando Fotura">
      <div className="fotura-loading__ambient fotura-loading__ambient--one" />
      <div className="fotura-loading__ambient fotura-loading__ambient--two" />

      <section className="fotura-loading__content">
        <div className="fotura-loading__mark" aria-hidden="true">
          <span className="fotura-loading__orbit fotura-loading__orbit--outer" />
          <span className="fotura-loading__orbit fotura-loading__orbit--inner" />
          <span className="fotura-loading__core" />
        </div>

        <div className="fotura-loading__brand">FOTURA</div>
        <p className="fotura-loading__message">Preparando sua experiência</p>

        <div className="fotura-loading__progress" aria-hidden="true">
          <span />
        </div>
      </section>

      <style>{`
        .fotura-loading {
          position: fixed;
          inset: 0;
          z-index: 99999;
          min-height: 100dvh;
          display: grid;
          place-items: center;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 42%, rgba(31, 50, 102, .16), transparent 34%),
            linear-gradient(180deg, #0b0b1a 0%, #101024 100%);
          color: #f0f0f5;
          font-family: var(--font-sora), Sora, system-ui, sans-serif;
        }

        .fotura-loading__ambient {
          position: absolute;
          width: 340px;
          height: 340px;
          border-radius: 50%;
          filter: blur(90px);
          opacity: .1;
          pointer-events: none;
        }

        .fotura-loading__ambient--one {
          top: -150px;
          left: -120px;
          background: #1196fc;
        }

        .fotura-loading__ambient--two {
          right: -140px;
          bottom: -170px;
          background: #5d0dfa;
        }

        .fotura-loading__content {
          position: relative;
          z-index: 1;
          display: flex;
          width: min(320px, calc(100vw - 48px));
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .fotura-loading__mark {
          position: relative;
          width: 74px;
          height: 74px;
          margin-bottom: 24px;
        }

        .fotura-loading__orbit,
        .fotura-loading__core {
          position: absolute;
          border-radius: 50%;
        }

        .fotura-loading__orbit--outer {
          inset: 0;
          border: 1px solid rgba(122, 127, 154, .22);
          border-top-color: rgba(17, 150, 252, .95);
          border-right-color: rgba(93, 13, 250, .65);
          animation: fotura-spin 1.45s linear infinite;
        }

        .fotura-loading__orbit--inner {
          inset: 11px;
          border: 1px solid rgba(122, 127, 154, .16);
          border-bottom-color: rgba(93, 13, 250, .9);
          animation: fotura-spin-reverse 1.9s linear infinite;
        }

        .fotura-loading__core {
          inset: 26px;
          background: linear-gradient(135deg, #1196fc, #5d0dfa);
          box-shadow: 0 0 18px rgba(74, 108, 247, .22);
          animation: fotura-pulse 1.8s ease-in-out infinite;
        }

        .fotura-loading__brand {
          margin-left: .18em;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: .22em;
          background: linear-gradient(90deg, #d9efff 0%, #f0f0f5 45%, #ded4ff 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .fotura-loading__message {
          margin: 9px 0 20px;
          color: #7a7f9a;
          font-size: 12px;
          font-weight: 400;
          letter-spacing: .01em;
        }

        .fotura-loading__progress {
          position: relative;
          width: 152px;
          height: 2px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(122, 127, 154, .13);
        }

        .fotura-loading__progress span {
          position: absolute;
          inset: 0 auto 0 0;
          width: 46%;
          border-radius: inherit;
          background: linear-gradient(90deg, #1196fc, #5d0dfa);
          animation: fotura-progress 1.55s cubic-bezier(.4, 0, .2, 1) infinite;
        }

        @keyframes fotura-spin { to { transform: rotate(360deg); } }
        @keyframes fotura-spin-reverse { to { transform: rotate(-360deg); } }
        @keyframes fotura-pulse {
          0%, 100% { transform: scale(.84); opacity: .72; }
          50% { transform: scale(1); opacity: 1; }
        }
        @keyframes fotura-progress {
          0% { transform: translateX(-115%); opacity: 0; }
          18% { opacity: 1; }
          82% { opacity: 1; }
          100% { transform: translateX(330%); opacity: 0; }
        }

        @media (max-width: 640px) {
          .fotura-loading__mark { width: 66px; height: 66px; margin-bottom: 21px; }
          .fotura-loading__orbit--inner { inset: 10px; }
          .fotura-loading__core { inset: 23px; }
          .fotura-loading__brand { font-size: 17px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .fotura-loading__orbit,
          .fotura-loading__core,
          .fotura-loading__progress span { animation-duration: 4s; }
        }
      `}</style>
    </main>
  );
}
