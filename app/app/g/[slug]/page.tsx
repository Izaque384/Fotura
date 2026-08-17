"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../lib/supabase-client";

function tituloDeSlug(slug: string) {
  const t = decodeURIComponent(slug).replace(/-/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function GaleriaClientePage() {
  const params = useParams();
  const slug = params.slug as string;
  const supabase = createClient();
  const [carregando, setCarregando] = useState(true);
  const [fotos, setFotos] = useState<{ url: string; nome: string }[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [ampliada, setAmpliada] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      const { data, error } = await supabase.storage.from("fotos").list(slug, {
        limit: 500,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) {
        setMensagem("Não foi possível carregar a galeria.");
        setCarregando(false);
        return;
      }
      const lista = (data ?? [])
        .filter((item) => item.id !== null)
        .map((item) => {
          const { data: urlData } = supabase.storage
            .from("fotos")
            .getPublicUrl(`${slug}/${item.name}`);
          return { url: urlData.publicUrl, nome: item.name };
        });
      setFotos(lista);
      setCarregando(false);
    }
    carregar();
  }, [slug, supabase]);

  async function baixar(url: string, nome: string) {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(href);
  }

  if (carregando) {
    return <div className="gc-center">Carregando galeria…</div>;
  }

  const titulo = tituloDeSlug(slug);
  const capa = fotos[0]?.url;

  return (
    <div className="gc-page">
      <style>{`
        .gc-page { min-height:100vh; background:#0b0b1a; }
        .gc-center { min-height:100vh; display:flex; align-items:center; justify-content:center; background:#0b0b1a; color:#7a7f9a; }

        /* Capa / hero */
        .gc-hero { position:relative; height:46vh; min-height:320px; width:100%; overflow:hidden; display:flex; align-items:flex-end; }
        .gc-hero-bg { position:absolute; inset:0; background-size:cover; background-position:center; transform:scale(1.03); }
        .gc-hero-overlay { position:absolute; inset:0; background:linear-gradient(180deg, rgba(11,11,26,0.20) 0%, rgba(11,11,26,0.55) 55%, rgba(11,11,26,0.98) 100%); }
        .gc-hero-inner { position:relative; z-index:2; width:100%; max-width:1100px; margin:0 auto; padding:0 24px 34px; }
        .gc-eyebrow { font-size:12px; letter-spacing:2px; text-transform:uppercase; color:#9fb0ff; margin:0 0 10px; font-weight:600; }
        .gc-title { font-size:clamp(30px, 5vw, 52px); font-weight:700; color:#f8f9fc; margin:0; letter-spacing:-0.5px; line-height:1.1; }
        .gc-count { font-size:14px; color:#c3c8dc; margin:12px 0 0; }

        /* Grade */
        .gc-body { max-width:1100px; margin:0 auto; padding:32px 24px 56px; }
        .gc-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(210px, 1fr)); gap:14px; }
        .gc-card { position:relative; aspect-ratio:1/1; border-radius:14px; overflow:hidden; background:#14141f; border:1px solid #1e2036; }
        .gc-card img { width:100%; height:100%; object-fit:cover; display:block; cursor:zoom-in; transition:transform .5s ease; }
        .gc-card:hover img { transform:scale(1.07); }
        .gc-dl {
          position:absolute; bottom:10px; right:10px; width:40px; height:40px;
          display:flex; align-items:center; justify-content:center;
          background:rgba(11,11,26,0.72); backdrop-filter:blur(6px);
          border:1px solid rgba(255,255,255,0.16); border-radius:10px; cursor:pointer;
          opacity:0.9; transition:opacity .2s ease, background .2s ease;
        }
        .gc-dl:hover { opacity:1; background:#4a6cf7; }
        .gc-dl svg { width:18px; height:18px; }

        /* Lightbox */
        .gc-lb { position:fixed; inset:0; background:rgba(5,5,12,0.94); display:flex; align-items:center; justify-content:center; padding:32px; z-index:50; cursor:zoom-out; }
        .gc-lb img { max-width:92%; max-height:92%; border-radius:12px; box-shadow:0 20px 60px rgba(0,0,0,0.6); }

        .gc-empty { color:#7a7f9a; text-align:center; padding:80px 24px; }
        .gc-foot { text-align:center; color:#454a63; font-size:12px; padding:0 24px 32px; }
        .gc-foot b { color:#6b7394; font-weight:600; }

        @media (max-width:600px){ .gc-hero{ height:40vh; min-height:260px; } }
      `}</style>

      {mensagem ? (
        <div className="gc-empty">{mensagem}</div>
      ) : fotos.length === 0 ? (
        <div className="gc-empty">Esta galeria ainda não tem fotos.</div>
      ) : (
        <>
          <div className="gc-hero">
            <div className="gc-hero-bg" style={{ backgroundImage: `url(${capa})` }} />
            <div className="gc-hero-overlay" />
            <div className="gc-hero-inner">
              <p className="gc-eyebrow">Sua galeria</p>
              <h1 className="gc-title">{titulo}</h1>
              <p className="gc-count">{fotos.length} foto{fotos.length === 1 ? "" : "s"}</p>
            </div>
          </div>

          <div className="gc-body">
            <div className="gc-grid">
              {fotos.map((foto) => (
                <div key={foto.url} className="gc-card">
                  <img src={foto.url} alt="Foto" onClick={() => setAmpliada(foto.url)} />
                  <button className="gc-dl" onClick={() => baixar(foto.url, foto.nome)} aria-label="Baixar foto" title="Baixar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <footer className="gc-foot">Feito com <b>Fotura</b></footer>
        </>
      )}

      {ampliada && (
        <div className="gc-lb" onClick={() => setAmpliada(null)}>
          <img src={ampliada} alt="Foto ampliada" />
        </div>
      )}
    </div>
  );
}
