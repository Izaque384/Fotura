"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-client";
import MenuFotografo from "../MenuFotografo";

type Galeria = { slug: string; qtd: number };

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [carregando, setCarregando] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [galerias, setGalerias] = useState<Galeria[]>([]);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    async function carregar() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      setEmail(userData.user.email ?? null);

      const { data, error } = await supabase.storage.from("fotos").list("", {
        limit: 200,
        sortBy: { column: "name", order: "asc" },
      });

      if (error) {
        setAviso("Não foi possível carregar as galerias.");
        setCarregando(false);
        return;
      }

      const pastas = (data ?? []).filter((item) => item.id === null);

      const lista: Galeria[] = [];
      for (const pasta of pastas) {
        const { data: fotos } = await supabase.storage
          .from("fotos")
          .list(pasta.name, { limit: 200 });
        const qtd = (fotos ?? []).filter((f) => f.id !== null).length;
        lista.push({ slug: pasta.name, qtd });
      }

      setGalerias(lista);
      setCarregando(false);
    }
    carregar();
  }, [router, supabase]);

  async function copiarLink(slug: string) {
    const link = `${window.location.origin}/g/${slug}`;
    try {
      await navigator.clipboard.writeText(link);
      setAviso("Link copiado: " + link);
    } catch {
      setAviso("Copie manualmente: " + link);
    }
  }

  function titulo(slug: string) {
    const t = slug.replace(/-/g, " ");
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  if (carregando) {
    return <div className="fd-center">Carregando...</div>;
  }

  return (
    <div className="fd-page">
      <style>{`
        .fd-page { min-height:100vh; background:linear-gradient(180deg,#0b0b1a 0%,#111126 100%); }
        .fd-center { min-height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(180deg,#0b0b1a 0%,#111126 100%); color:#7a7f9a; }
        .fd-body { padding:40px 24px; }
        .fd-wrap { max-width:820px; margin:0 auto; }
        .fd-head { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; margin-bottom:28px; flex-wrap:wrap; }
        .fd-titulo { font-size:22px; font-weight:700; color:#f0f0f5; }
        .fd-sub { font-size:13px; color:#7a7f9a; margin-top:4px; }
        .fd-nova { padding:11px 18px; font-size:14px; font-weight:600; border-radius:10px; cursor:pointer; background:#4a6cf7; color:#fff; border:none; }
        .fd-nova:hover { background:#3b5de0; }
        .fd-aviso { font-size:13px; color:#22c55e; text-align:center; margin-bottom:20px; word-break:break-all; }
        .fd-vazio { font-size:14px; color:#7a7f9a; text-align:center; padding:40px; border:1px dashed #2a2d40; border-radius:12px; }
        .fd-card { background:#16162a; border:1px solid #2a2d40; border-radius:12px; padding:18px 20px; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }
        .fd-card-nome { font-size:16px; font-weight:600; color:#f0f0f5; }
        .fd-card-qtd { font-size:12px; color:#7a7f9a; margin-top:2px; }
        .fd-acoes { display:flex; gap:8px; flex-wrap:wrap; }
        .fd-acao { padding:8px 14px; font-size:13px; font-weight:600; border-radius:8px; cursor:pointer; text-decoration:none; display:inline-block; }
        .fd-acao-azul { background:#4a6cf7; color:#fff; border:none; }
        .fd-acao-linha { background:transparent; color:#4a6cf7; border:1px solid #4a6cf7; }
      `}</style>

      <MenuFotografo />

      <div className="fd-body">
        <div className="fd-wrap">
          <div className="fd-head">
            <div>
              <div className="fd-titulo">
                Suas galerias{galerias.length > 0 ? ` (${galerias.length})` : ""}
              </div>
              <div className="fd-sub">{email}</div>
            </div>
            <button className="fd-nova" onClick={() => router.push("/upload")}>
              + Enviar fotos
            </button>
          </div>

          {aviso && <p className="fd-aviso">{aviso}</p>}

          {galerias.length === 0 ? (
            <div className="fd-vazio">
              Você ainda não criou nenhuma galeria.<br />
              Clique em “+ Enviar fotos” pra começar.
            </div>
          ) : (
            galerias.map((g) => (
              <div key={g.slug} className="fd-card">
                <div>
                  <div className="fd-card-nome">{titulo(g.slug)}</div>
                  <div className="fd-card-qtd">
                    {g.qtd} foto{g.qtd === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="fd-acoes">
                  <button className="fd-acao fd-acao-linha" onClick={() => copiarLink(g.slug)}>
                    Copiar link
                  </button>
                  <a className="fd-acao fd-acao-linha" href={`/g/${g.slug}`} target="_blank" rel="noreferrer">
                    Ver
                  </a>
                  <a className="fd-acao fd-acao-azul" href={`/upload?galeria=${g.slug}`}>
                    Enviar mais
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
