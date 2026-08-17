"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../lib/supabase-client";

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
        limit: 200,
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
    return <div className="fc-center">Carregando galeria...</div>;
  }

  return (
    <div className="fc-page">
      <style>{`
        .fc-page { min-height:100vh; background:linear-gradient(180deg,#0b0b1a 0%,#111126 100%); font-family:sans-serif; padding:48px 24px; }
        .fc-center { min-height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(180deg,#0b0b1a 0%,#111126 100%); color:#7a7f9a; font-family:sans-serif; }
        .fc-wrap { max-width:1040px; margin:0 auto; }
        .fc-logo { font-size:28px; font-weight:700; letter-spacing:4px; color:#f0f0f5; text-align:center; margin-bottom:4px; }
        .fc-sub { font-size:14px; color:#7a7f9a; text-align:center; margin-bottom:40px; }
        .fc-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:16px; }
        .fc-card { position:relative; aspect-ratio:1/1; border-radius:14px; overflow:hidden; background:#0f0f1a; border:1px solid #2a2d40; }
        .fc-card img { width:100%; height:100%; object-fit:cover; display:block; cursor:zoom-in; transition:transform .4s ease; }
        .fc-card:hover img { transform:scale(1.06); }
        .fc-baixar { position:absolute; bottom:8px; right:8px; padding:6px 12px; font-size:12px; font-weight:600; color:#fff; background:rgba(74,108,247,.92); border:none; border-radius:8px; cursor:pointer; }
        .fc-empty { font-size:14px; color:#7a7f9a; text-align:center; }
        .fc-lightbox { position:fixed; inset:0; background:rgba(5,5,12,.9); display:flex; align-items:center; justify-content:center; padding:32px; z-index:50; cursor:zoom-out; }
        .fc-lightbox img { max-width:90%; max-height:90%; border-radius:12px; }
      `}</style>

      <div className="fc-wrap">
        <div className="fc-logo">FOTURA</div>
        <p className="fc-sub">
          {fotos.length > 0 ? `${fotos.length} foto${fotos.length > 1 ? "s" : ""} pra você` : "Sua galeria"}
        </p>

        {mensagem ? (
          <p className="fc-empty">{mensagem}</p>
        ) : fotos.length === 0 ? (
          <p className="fc-empty">Esta galeria ainda não tem fotos.</p>
        ) : (
          <div className="fc-grid">
            {fotos.map((foto) => (
              <div key={foto.url} className="fc-card">
                <img src={foto.url} alt="Foto" onClick={() => setAmpliada(foto.url)} />
                <button className="fc-baixar" onClick={() => baixar(foto.url, foto.nome)}>
                  Baixar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {ampliada && (
        <div className="fc-lightbox" onClick={() => setAmpliada(null)}>
          <img src={ampliada} alt="Foto ampliada" />
        </div>
      )}
    </div>
  );
}