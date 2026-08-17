"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-client";

export default function GaleriaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [carregando, setCarregando] = useState(true);
  const [fotos, setFotos] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [ampliada, setAmpliada] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase.storage.from("fotos").list("", {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });

      if (error) {
        setMensagem("Erro ao carregar fotos: " + error.message);
        setCarregando(false);
        return;
      }

      const urls = (data ?? [])
        .filter((item) => item.id !== null)
        .map((item) => {
          const { data: urlData } = supabase.storage
            .from("fotos")
            .getPublicUrl(item.name);
          return urlData.publicUrl;
        });

      setFotos(urls);
      setCarregando(false);
    }
    carregar();
  }, [router, supabase]);

  if (carregando) {
    return <div className="fotura-center">Carregando...</div>;
  }

  return (
    <div className="fotura-galeria">
      <style>{`
        .fotura-galeria {
          min-height: 100vh;
          background: linear-gradient(180deg, #0b0b1a 0%, #111126 100%);
          font-family: sans-serif;
          padding: 48px 24px;
        }
        .fotura-center {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, #0b0b1a 0%, #111126 100%);
          color: #7a7f9a;
          font-family: sans-serif;
        }
        .fotura-wrap { max-width: 1040px; margin: 0 auto; }
        .fotura-logo {
          font-size: 28px; font-weight: 700; letter-spacing: 4px;
          color: #f0f0f5; text-align: center; margin-bottom: 4px;
        }
        .fotura-sub {
          font-size: 14px; color: #7a7f9a; text-align: center; margin-bottom: 40px;
        }
        .fotura-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }
        .fotura-card {
          position: relative;
          aspect-ratio: 1 / 1;
          border-radius: 14px;
          overflow: hidden;
          background: #0f0f1a;
          border: 1px solid #2a2d40;
          cursor: pointer;
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .fotura-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          border-color: #4a6cf7;
        }
        .fotura-card img {
          width: 100%; height: 100%; object-fit: cover;
          display: block;
          transition: transform 0.4s ease;
        }
        .fotura-card:hover img { transform: scale(1.06); }
        .fotura-empty { font-size: 14px; color: #7a7f9a; text-align: center; }
        .fotura-erro { font-size: 13px; color: #ef4444; text-align: center; margin-bottom: 24px; }
        .fotura-lightbox {
          position: fixed; inset: 0;
          background: rgba(5,5,12,0.9);
          display: flex; align-items: center; justify-content: center;
          padding: 32px; z-index: 50; cursor: zoom-out;
        }
        .fotura-lightbox img {
          max-width: 90%; max-height: 90%;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6);
        }
      `}</style>

      <div className="fotura-wrap">
        <div className="fotura-logo">FOTURA</div>
        <p className="fotura-sub">
          Galeria{fotos.length > 0 ? ` · ${fotos.length} foto${fotos.length > 1 ? "s" : ""}` : ""}
        </p>

        {mensagem && <p className="fotura-erro">{mensagem}</p>}

        {fotos.length === 0 && !mensagem ? (
          <p className="fotura-empty">Nenhuma foto ainda. Envie fotos na página de upload.</p>
        ) : (
          <div className="fotura-grid">
            {fotos.map((url) => (
              <div key={url} className="fotura-card" onClick={() => setAmpliada(url)}>
                <img src={url} alt="Foto" />
              </div>
            ))}
          </div>
        )}
      </div>

      {ampliada && (
        <div className="fotura-lightbox" onClick={() => setAmpliada(null)}>
          <img src={ampliada} alt="Foto ampliada" />
        </div>
      )}
    </div>
  );
}