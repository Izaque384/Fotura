"use client";

import { useMemo, useState } from "react";
import { useI18n } from "../components/I18nProvider";
import { withLocalePath, type Locale } from "../../lib/i18n";

const photos = [
  "https://images.unsplash.com/photo-1780291116326-36096428e499?auto=format&fit=crop&w=1500&q=88",
  "https://images.unsplash.com/photo-1777312379304-e958accc0fa9?auto=format&fit=crop&w=1500&q=88",
  "https://images.unsplash.com/photo-1764593823886-6cd9af7f8a5c?auto=format&fit=crop&w=1500&q=88",
  "https://images.unsplash.com/photo-1647900748342-7631ef9c9429?auto=format&fit=crop&w=1500&q=88",
  "https://images.unsplash.com/photo-1760080903525-d3608e3bbe2d?auto=format&fit=crop&w=1500&q=88",
  "https://images.unsplash.com/photo-1769898548207-ec7bb38a7cb8?auto=format&fit=crop&w=1500&q=88",
  "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1500&q=88",
  "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1500&q=88",
];

const copy: Record<Locale, {
  demo: string;
  noSave: string;
  proof: string;
  studio: string;
  gallery: string;
  hint: string;
  hint2: string;
  selected: string;
  select: string;
  remove: string;
  finish: string;
  finishTitle: string;
  finishText: string;
  back: string;
  confirm: string;
  done: string;
  doneText: string;
  create: string;
  close: string;
  previous: string;
  next: string;
  commentPlaceholder: string;
  saveComment: string;
  commentSaved: string;
  madeWith: string;
}> = {
  pt: {
    demo: "Demonstração interativa",
    noSave: "Nada nesta galeria é salvo",
    proof: "PROVA DE FOTOS",
    studio: "STUDIO AURORA",
    gallery: "Galeria",
    hint: "Selecione até 5 fotos como se você fosse o cliente.",
    hint2: "Abra qualquer imagem para ampliar e deixar um comentário.",
    selected: "selecionadas",
    select: "Selecionar",
    remove: "Remover da seleção",
    finish: "Finalizar seleção",
    finishTitle: "Finalizar seleção?",
    finishText: "Esta é uma demonstração. Você verá a mesma confirmação que um cliente receberia ao concluir a prova.",
    back: "Voltar",
    confirm: "Finalizar demonstração",
    done: "Seleção concluída",
    doneText: "É assim que o cliente encerra a prova. No Fotura real, a seleção aparece imediatamente no painel do fotógrafo.",
    create: "Criar minha galeria grátis",
    close: "Fechar foto",
    previous: "Foto anterior",
    next: "Próxima foto",
    commentPlaceholder: "Comente nesta foto…",
    saveComment: "Salvar comentário",
    commentSaved: "Comentário salvo nesta demonstração.",
    madeWith: "Feito com",
  },
  en: {
    demo: "Interactive demo",
    noSave: "Nothing in this gallery is saved",
    proof: "PHOTO PROOF",
    studio: "STUDIO AURORA",
    gallery: "Gallery",
    hint: "Select up to 5 photos as if you were the client.",
    hint2: "Open any image to enlarge it and leave a comment.",
    selected: "selected",
    select: "Select",
    remove: "Remove from selection",
    finish: "Finish selection",
    finishTitle: "Finish selection?",
    finishText: "This is a demo. You will see the same confirmation a client receives when completing a proof.",
    back: "Back",
    confirm: "Finish demo",
    done: "Selection completed",
    doneText: "This is how the client completes a proof. In Fotura, the selection appears immediately in the photographer dashboard.",
    create: "Create my free gallery",
    close: "Close photo",
    previous: "Previous photo",
    next: "Next photo",
    commentPlaceholder: "Comment on this photo…",
    saveComment: "Save comment",
    commentSaved: "Comment saved in this demo.",
    madeWith: "Made with",
  },
  es: {
    demo: "Demostración interactiva",
    noSave: "Nada de esta galería se guarda",
    proof: "SELECCIÓN DE FOTOS",
    studio: "STUDIO AURORA",
    gallery: "Galería",
    hint: "Selecciona hasta 5 fotos como si fueras el cliente.",
    hint2: "Abre cualquier imagen para ampliarla y dejar un comentario.",
    selected: "seleccionadas",
    select: "Seleccionar",
    remove: "Quitar de la selección",
    finish: "Finalizar selección",
    finishTitle: "¿Finalizar selección?",
    finishText: "Esta es una demostración. Verás la misma confirmación que recibe un cliente al completar la selección.",
    back: "Volver",
    confirm: "Finalizar demostración",
    done: "Selección completada",
    doneText: "Así termina el cliente la selección. En Fotura, el resultado aparece inmediatamente en el panel del fotógrafo.",
    create: "Crear mi galería gratis",
    close: "Cerrar foto",
    previous: "Foto anterior",
    next: "Siguiente foto",
    commentPlaceholder: "Comenta esta foto…",
    saveComment: "Guardar comentario",
    commentSaved: "Comentario guardado en esta demostración.",
    madeWith: "Hecho con",
  },
};

export default function DemoGalleryPage() {
  const { locale } = useI18n();
  const c = copy[locale];
  const [selected, setSelected] = useState<number[]>([0, 3]);
  const [active, setActive] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [commentSaved, setCommentSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const signupHref = useMemo(() => withLocalePath("/login?modo=cadastro", locale), [locale]);

  function toggle(index: number) {
    if (done) return;
    setSelected((current) => {
      if (current.includes(index)) return current.filter((item) => item !== index);
      if (current.length >= 5) return current;
      return [...current, index];
    });
  }

  function open(index: number) {
    setCommentSaved(false);
    setActive(index);
  }

  function move(direction: -1 | 1) {
    setActive((current) => current === null ? 0 : (current + direction + photos.length) % photos.length);
    setCommentSaved(false);
  }

  function saveComment() {
    if (active === null) return;
    setCommentSaved(true);
  }

  function finish() {
    setConfirming(false);
    setDone(true);
  }

  return (
    <main className="fd-page">
      <style>{styles}</style>

      <div className="fd-demo-pill">
        <strong>{c.demo}</strong>
        <span>{c.noSave}</span>
      </div>

      <header className="fd-hero" style={{ backgroundImage: `url("${photos[6]}")` }}>
        <div className="fd-hero-shade" />
        <div className="fd-hero-brand">{c.studio}</div>
        <div className="fd-hero-copy">
          <small>{c.proof}</small>
          <h1>Marina &amp; Pedro</h1>
          <p>12.09.2026 · Serra do Mar</p>
        </div>
      </header>

      <section className="fd-strip">
        <div>
          <small>{c.gallery}</small>
          <strong>Marina &amp; Pedro</strong>
        </div>
        <span>{photos.length} fotos</span>
      </section>

      <section className="fd-hint">
        <strong>{c.hint}</strong>
        <span>{c.hint2}</span>
      </section>

      <section className="fd-grid" aria-label={c.gallery}>
        {photos.map((src, index) => {
          const isSelected = selected.includes(index);
          return (
            <article
              key={src}
              className={"fd-card" + (isSelected ? " selected" : "") + (index === 0 || index === 5 ? " tall" : "")}
            >
              <button className="fd-photo" type="button" onClick={() => open(index)} aria-label={`${c.gallery} ${index + 1}`}>
                <img src={src} alt={`Marina & Pedro — ${index + 1}`} loading={index < 4 ? "eager" : "lazy"} />
              </button>
              <button
                className={"fd-select" + (isSelected ? " on" : "")}
                type="button"
                aria-label={isSelected ? c.remove : c.select}
                aria-pressed={isSelected}
                onClick={() => toggle(index)}
              >
                {isSelected ? "✓" : ""}
              </button>
              {comments[index]?.trim() && <span className="fd-comment-dot" aria-hidden="true">●</span>}
            </article>
          );
        })}
      </section>

      <footer className="fd-footer">
        {c.madeWith} <b>Fotura</b>
        <a href={signupHref}>{c.create} →</a>
      </footer>

      {!done && selected.length > 0 && (
        <div className="fd-selection-bar" role="status">
          <span><b>{selected.length}</b> / 5 {c.selected}</span>
          <button type="button" onClick={() => setConfirming(true)}>{c.finish}</button>
        </div>
      )}

      {done && (
        <div className="fd-done" role="status">
          <div>
            <strong>✓ {c.done}</strong>
            <span>{c.doneText}</span>
          </div>
          <a href={signupHref}>{c.create} →</a>
        </div>
      )}

      {active !== null && (
        <div className="fd-lightbox" role="dialog" aria-modal="true" aria-label={`${c.gallery} ${active + 1}`} onClick={() => setActive(null)}>
          <span className="fd-count">{active + 1} / {photos.length}</span>
          <button className="fd-close" type="button" aria-label={c.close} onClick={() => setActive(null)}>×</button>
          <button className="fd-nav prev" type="button" aria-label={c.previous} onClick={(event) => { event.stopPropagation(); move(-1); }}>‹</button>
          <div className="fd-lightbox-photo" onClick={(event) => event.stopPropagation()}>
            <img src={photos[active]} alt={`Marina & Pedro — ${active + 1}`} />
          </div>
          <button className="fd-nav next" type="button" aria-label={c.next} onClick={(event) => { event.stopPropagation(); move(1); }}>›</button>
          <div className="fd-comment-box" onClick={(event) => event.stopPropagation()}>
            <textarea
              value={comments[active] ?? ""}
              onChange={(event) => { setComments((current) => ({ ...current, [active]: event.target.value })); setCommentSaved(false); }}
              placeholder={c.commentPlaceholder}
              rows={1}
            />
            <button type="button" onClick={saveComment}>{c.saveComment}</button>
            {commentSaved && <small>{c.commentSaved}</small>}
          </div>
        </div>
      )}

      {confirming && (
        <div className="fd-confirm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirming(false); }}>
          <section className="fd-confirm-card" role="dialog" aria-modal="true" aria-labelledby="fd-confirm-title">
            <div className="fd-confirm-icon">✓</div>
            <h2 id="fd-confirm-title">{c.finishTitle}</h2>
            <p>{c.finishText}</p>
            <strong>{selected.length} / 5 {c.selected}</strong>
            <div className="fd-confirm-actions">
              <button type="button" className="secondary" onClick={() => setConfirming(false)}>{c.back}</button>
              <button type="button" className="primary" onClick={finish}>{c.confirm}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

const styles = `
.fd-page{min-height:100vh;background:#f0edf7;color:#21253a;font-family:var(--font-sora),Sora,system-ui,sans-serif}
.fd-demo-pill{position:fixed;z-index:70;top:18px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(18,18,31,.82);color:#fff;box-shadow:0 9px 30px rgba(15,14,27,.2);backdrop-filter:blur(18px)}
.fd-demo-pill strong{font-size:10px}.fd-demo-pill span{font-size:9px;color:rgba(255,255,255,.66)}
.fd-hero{min-height:54vh;position:relative;display:flex;align-items:flex-end;padding:clamp(42px,6vw,82px);background-size:cover;background-position:center 47%;isolation:isolate;color:#fff}
.fd-hero-shade{position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgba(7,7,15,.72) 0%,rgba(7,7,15,.22) 60%,rgba(7,7,15,.3) 100%)}
.fd-hero-brand{position:absolute;top:50%;right:7%;transform:translateY(-50%);font-size:clamp(16px,2vw,27px);font-weight:850;letter-spacing:.18em}
.fd-hero-copy small{font-size:10px;letter-spacing:.2em;font-weight:800;opacity:.78}
.fd-hero-copy h1{margin:10px 0 6px;font-family:Georgia,"Times New Roman",serif;font-size:clamp(52px,7.5vw,108px);font-weight:500;letter-spacing:-.045em;line-height:.9}
.fd-hero-copy p{margin:0;font-size:11px;letter-spacing:.1em;opacity:.76}
.fd-strip{min-height:84px;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:0 clamp(18px,3vw,48px);border-bottom:1px solid #d8d1e7;background:linear-gradient(180deg,#faf8fd,#f5f1fa)}
.fd-strip small{display:block;color:#86899c;font-size:8px;text-transform:uppercase;letter-spacing:.14em}.fd-strip strong{display:block;margin-top:5px;font-size:17px}.fd-strip>span{padding:9px 12px;border:1px solid #ddd6eb;border-radius:999px;background:#fff;color:#666b80;font-size:10px;font-weight:700}
.fd-hint{display:grid;gap:5px;margin:18px clamp(14px,2vw,30px);padding:13px 16px;border:1px solid rgba(74,108,247,.22);border-radius:12px;background:rgba(74,108,247,.07);color:#596079}.fd-hint strong{font-size:12px}.fd-hint span{font-size:10px;color:#747990}
.fd-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-flow:dense;gap:2px;background:#dcd6ee}
.fd-card{position:relative;min-width:0;aspect-ratio:4/3;overflow:hidden;background:#e5e0ed}.fd-card.tall{grid-row:span 2;aspect-ratio:auto;min-height:620px}
.fd-photo{width:100%;height:100%;padding:0;border:0;background:none;cursor:zoom-in}.fd-photo img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .45s ease,filter .3s ease}.fd-card:hover .fd-photo img{transform:scale(1.018);filter:saturate(1.03)}
.fd-card.selected{box-shadow:inset 0 0 0 3px #6177e8}.fd-select{position:absolute;z-index:3;top:12px;left:12px;width:42px;height:42px;border:1px solid rgba(255,255,255,.55);border-radius:50%;background:rgba(11,11,26,.62);color:#fff;font-size:17px;font-weight:800;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.12)}.fd-select.on{background:#4a6cf7}.fd-comment-dot{position:absolute;left:17px;bottom:15px;color:#9db4ff;font-size:13px;text-shadow:0 1px 5px rgba(0,0,0,.4)}
.fd-footer{min-height:96px;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:22px clamp(18px,3vw,48px);color:#62677c;font-size:11px}.fd-footer b{color:#292e43}.fd-footer a{padding:11px 15px;border:1px solid #d4cce4;border-radius:10px;background:#faf8fd;color:#3e4561;font-weight:800;text-decoration:none}
.fd-selection-bar{position:fixed;z-index:55;left:50%;bottom:22px;transform:translateX(-50%);display:flex;align-items:center;gap:15px;padding:8px 9px 8px 18px;border:1px solid #2a2d4a;border-radius:999px;background:rgba(16,16,34,.94);color:#fff;box-shadow:0 12px 36px rgba(8,8,19,.25);backdrop-filter:blur(14px);font-size:11px;white-space:nowrap}.fd-selection-bar button{padding:10px 15px;border:0;border-radius:999px;background:linear-gradient(90deg,#1196fc,#5d0dfa);color:#fff;font-weight:800;cursor:pointer}
.fd-done{position:fixed;z-index:55;left:50%;bottom:22px;transform:translateX(-50%);width:min(690px,calc(100vw - 30px));display:flex;align-items:center;justify-content:space-between;gap:18px;padding:13px 14px 13px 19px;border:1px solid rgba(63,124,91,.25);border-radius:16px;background:rgba(246,251,248,.96);box-shadow:0 15px 42px rgba(31,50,39,.16);backdrop-filter:blur(14px)}.fd-done strong{display:block;color:#32684b;font-size:12px}.fd-done span{display:block;max-width:430px;margin-top:4px;color:#6b756f;font-size:9px;line-height:1.45}.fd-done a{flex:none;padding:11px 14px;border-radius:10px;background:linear-gradient(90deg,#1196fc,#5d0dfa);color:#fff;text-decoration:none;font-size:10px;font-weight:800}
.fd-lightbox{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:26px 30px 112px;background:rgba(4,4,10,.96)}.fd-lightbox-photo{max-width:90vw;max-height:calc(100vh - 160px);display:grid;place-items:center}.fd-lightbox-photo img{display:block;max-width:90vw;max-height:calc(100vh - 160px);border-radius:5px;box-shadow:0 24px 80px rgba(0,0,0,.32)}
.fd-count{position:absolute;top:22px;left:22px;padding:8px 11px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(20,20,36,.62);color:#fff;font-size:10px}.fd-close,.fd-nav{position:absolute;z-index:2;display:grid;place-items:center;padding:0;border:1px solid rgba(255,255,255,.2);background:rgba(20,20,36,.72);color:#fff;cursor:pointer}.fd-close{top:20px;right:20px;width:44px;height:44px;border-radius:12px;font-size:25px}.fd-nav{top:50%;width:50px;height:50px;transform:translateY(-50%);border-radius:50%;font-size:32px}.fd-nav.prev{left:18px}.fd-nav.next{right:18px}
.fd-comment-box{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);width:min(620px,calc(100vw - 32px));display:grid;grid-template-columns:1fr auto;gap:7px;padding:7px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(16,16,34,.96)}.fd-comment-box textarea{min-height:38px;padding:10px 11px;border:0;outline:0;resize:none;background:transparent;color:#fff;font:inherit}.fd-comment-box button{padding:0 14px;border:0;border-radius:9px;background:linear-gradient(90deg,#1196fc,#5d0dfa);color:#fff;font-size:10px;font-weight:800;cursor:pointer}.fd-comment-box small{grid-column:1/-1;padding:0 9px 5px;color:#9ecfb0;font-size:8px}
.fd-confirm{position:fixed;inset:0;z-index:110;display:grid;place-items:center;padding:20px;background:rgba(3,3,12,.78)}.fd-confirm-card{width:min(430px,100%);padding:32px;border:1px solid #dcd6ee;border-radius:18px;background:#faf8fd;text-align:center;box-shadow:0 30px 80px rgba(9,8,18,.3)}.fd-confirm-icon{width:44px;height:44px;margin:0 auto 15px;display:grid;place-items:center;border-radius:50%;background:rgba(63,124,91,.12);color:#3f7c5b;font-size:20px;font-weight:900}.fd-confirm h2{margin:0;font-size:23px}.fd-confirm p{margin:12px 0 16px;color:#73788f;font-size:12px;line-height:1.6}.fd-confirm>strong,.fd-confirm-card>strong{font-size:11px;color:#575d76}.fd-confirm-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:24px}.fd-confirm-actions button{min-height:43px;border-radius:10px;font-weight:800;cursor:pointer}.fd-confirm-actions .secondary{border:1px solid #d7d0e7;background:#f3eff9;color:#596079}.fd-confirm-actions .primary{border:0;background:linear-gradient(90deg,#1196fc,#5d0dfa);color:#fff}
@media(max-width:820px){.fd-demo-pill{top:10px;width:max-content;max-width:calc(100vw - 20px)}.fd-demo-pill span{display:none}.fd-hero{min-height:480px;padding:42px 20px;background-position:center}.fd-hero-brand{top:70px;right:auto;left:20px;transform:none;font-size:13px}.fd-hero-copy h1{font-size:clamp(52px,16vw,76px)}.fd-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.fd-card.tall{min-height:430px}.fd-footer{align-items:flex-start;flex-direction:column}.fd-lightbox{padding:20px 10px 104px}.fd-nav{width:44px;height:44px}.fd-nav.prev{left:7px}.fd-nav.next{right:7px}.fd-done{align-items:stretch;flex-direction:column}.fd-done a{text-align:center}}
@media(max-width:520px){.fd-strip{min-height:72px}.fd-hint{margin:12px 10px}.fd-card{aspect-ratio:1/1.18}.fd-card.tall{min-height:360px}.fd-select{width:38px;height:38px;top:9px;left:9px}.fd-selection-bar{bottom:12px;width:calc(100vw - 24px);justify-content:space-between}.fd-confirm-actions{grid-template-columns:1fr}.fd-comment-box{bottom:10px}.fd-comment-box button{padding:0 10px}}
@media(prefers-reduced-motion:reduce){.fd-photo img{transition:none}}
`;
