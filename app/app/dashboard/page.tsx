"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-client";
import MenuFotografo from "../MenuFotografo";

type Galeria = { slug: string; qtd: number };
type Mes = { label: string; qtd: number };

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [carregando, setCarregando] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [galerias, setGalerias] = useState<Galeria[]>([]);
  const [porMes, setPorMes] = useState<Mes[]>([]);
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
      const contagemMes = new Map<string, number>();

      for (const pasta of pastas) {
        const { data: fotos } = await supabase.storage
          .from("fotos")
          .list(pasta.name, { limit: 200 });
        const arquivos = (fotos ?? []).filter((f) => f.id !== null);
        lista.push({ slug: pasta.name, qtd: arquivos.length });

        for (const f of arquivos) {
          if (!f.created_at) continue;
          const d = new Date(f.created_at);
          const chave = `${d.getFullYear()}-${d.getMonth()}`;
          contagemMes.set(chave, (contagemMes.get(chave) ?? 0) + 1);
        }
      }

      // últimos 6 meses (inclui o atual), mesmo que zerados
      const agora = new Date();
      const meses: Mes[] = [];
      for (let i = 5; i >= 0; i--) {
        const dt = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        const chave = `${dt.getFullYear()}-${dt.getMonth()}`;
        const nome = dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
        meses.push({ label: nome, qtd: contagemMes.get(chave) ?? 0 });
      }

      setGalerias(lista);
      setPorMes(meses);
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
    return <div className="dash-load">Carregando painel...</div>;
  }

  const totalGalerias = galerias.length;
  const totalFotos = galerias.reduce((s, g) => s + g.qtd, 0);
  const media = totalGalerias > 0 ? Math.round(totalFotos / totalGalerias) : 0;
  const maior = galerias.reduce<Galeria | null>((m, g) => (!m || g.qtd > m.qtd ? g : m), null);

  const topGal = [...galerias].sort((a, b) => b.qtd - a.qtd).slice(0, 6);
  const maxGal = Math.max(1, ...topGal.map((g) => g.qtd));
  const maxMes = Math.max(1, ...porMes.map((m) => m.qtd));

  return (
    <div className="dash mf-shift">
      <style>{`
        .dash { min-height: 100vh; background: linear-gradient(180deg, #0b0b1a 0%, #101024 100%); color: #f0f0f5; }
        .dash-load {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          background: linear-gradient(180deg, #0b0b1a 0%, #101024 100%); color: #7a7f9a;
        }
        .dash-body { max-width: 1120px; margin: 0 auto; padding: 40px 40px 80px; }

        .dash-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin-bottom: 30px; }
        .dash-eyebrow { font-size: 12px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #6f76a0; margin-bottom: 8px; }
        .dash-h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.5px; color: #f5f6fb; margin: 0; }
        .dash-sub { font-size: 13px; color: #7a7f9a; margin-top: 6px; }
        .dash-btn {
          padding: 11px 18px; font-size: 14px; font-weight: 600; border-radius: 11px; cursor: pointer;
          color: #fff; border: none; font-family: inherit;
          background: linear-gradient(90deg, #1196fc, #5d0dfa);
          box-shadow: 0 8px 24px rgba(74,108,247,0.30);
          transition: transform .15s ease, box-shadow .15s ease;
        }
        .dash-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 30px rgba(74,108,247,0.45); }

        .dash-aviso {
          font-size: 13px; color: #8fe3b0; background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.25); border-radius: 10px;
          padding: 10px 14px; margin-bottom: 22px; word-break: break-all;
        }

        /* KPIs */
        .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
        .kpi {
          position: relative; overflow: hidden;
          background: linear-gradient(180deg, #14142b 0%, #101023 100%);
          border: 1px solid #23233c; border-radius: 16px; padding: 20px;
        }
        .kpi::after {
          content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, #1196fc, #5d0dfa); opacity: .55;
        }
        .kpi-ic {
          width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
          background: rgba(74,108,247,0.12); color: #7ea2ff; margin-bottom: 16px;
        }
        .kpi-ic svg { width: 20px; height: 20px; }
        .kpi-val { font-size: 32px; font-weight: 700; line-height: 1; letter-spacing: -1px; color: #f5f6fb; }
        .kpi-lab { font-size: 13px; color: #8a90a8; margin-top: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* Gráficos */
        .charts { display: grid; grid-template-columns: 1.15fr 1fr; gap: 16px; margin-bottom: 20px; }
        .card { background: linear-gradient(180deg, #14142b 0%, #101023 100%); border: 1px solid #23233c; border-radius: 16px; padding: 22px 24px; }
        .card-h { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .card-t { font-size: 15px; font-weight: 600; color: #eef1f6; }
        .card-tag { font-size: 11px; color: #6f76a0; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }

        /* Barras horizontais */
        .hbars { display: flex; flex-direction: column; gap: 14px; }
        .hbar { display: grid; grid-template-columns: 130px 1fr 34px; align-items: center; gap: 12px; }
        .hbar-name { font-size: 13px; color: #c3c7db; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hbar-track { height: 10px; background: #1c1c34; border-radius: 999px; overflow: hidden; }
        .hbar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #1196fc, #5d0dfa); min-width: 6px; transition: width .5s ease; }
        .hbar-val { font-size: 13px; font-weight: 600; color: #f0f0f5; text-align: right; }

        /* Barras verticais */
        .vbars { display: flex; align-items: flex-end; gap: 10px; height: 180px; padding-top: 20px; }
        .vbar { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
        .vbar-area { width: 100%; display: flex; align-items: flex-end; justify-content: center; flex: 1; }
        .vbar-fill { position: relative; width: 60%; max-width: 40px; border-radius: 8px 8px 2px 2px; background: linear-gradient(180deg, #1196fc, #5d0dfa); transition: height .5s ease; }
        .vbar-num { position: absolute; top: -20px; left: 0; right: 0; text-align: center; font-size: 12px; font-weight: 600; color: #c3c7db; }
        .vbar-lab { font-size: 11px; color: #7a7f9a; margin-top: 10px; text-transform: capitalize; }

        .chart-vazio { font-size: 13px; color: #7a7f9a; text-align: center; padding: 30px 0; }

        /* Lista de galerias */
        .glist { display: flex; flex-direction: column; gap: 10px; margin-top: 6px; }
        .grow {
          display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
          background: rgba(255,255,255,0.02); border: 1px solid #23233c; border-radius: 13px; padding: 16px 18px;
          transition: border-color .15s ease, background .15s ease;
        }
        .grow:hover { border-color: #33364f; background: rgba(255,255,255,0.035); }
        .gname { font-size: 15px; font-weight: 600; color: #f0f0f5; }
        .gqtd { font-size: 12px; color: #7a7f9a; margin-top: 2px; }
        .gacoes { display: flex; gap: 8px; flex-wrap: wrap; }
        .gacao { padding: 8px 14px; font-size: 13px; font-weight: 600; border-radius: 9px; cursor: pointer; text-decoration: none; display: inline-block; font-family: inherit; }
        .gacao-linha { background: transparent; color: #9fb0ff; border: 1px solid #34385a; }
        .gacao-linha:hover { border-color: #4a6cf7; color: #fff; }
        .gacao-azul { background: linear-gradient(90deg, #1196fc, #5d0dfa); color: #fff; border: none; }

        .dash-vazio {
          text-align: center; padding: 48px 24px; border: 1px dashed #2a2d40; border-radius: 16px;
          background: rgba(255,255,255,0.02);
        }
        .dash-vazio-t { font-size: 16px; font-weight: 600; color: #f0f0f5; margin-bottom: 6px; }
        .dash-vazio-d { font-size: 13px; color: #7a7f9a; margin-bottom: 20px; }

        @media (max-width: 980px) {
          .kpis { grid-template-columns: repeat(2, 1fr); }
          .charts { grid-template-columns: 1fr; }
        }
        @media (max-width: 860px) {
          .dash-body { padding: 28px 20px 70px; }
        }
        @media (max-width: 520px) {
          .hbar { grid-template-columns: 96px 1fr 30px; gap: 8px; }
        }
      `}</style>

      <MenuFotografo />

      <div className="dash-body">
        <div className="dash-top">
          <div>
            <div className="dash-eyebrow">Painel</div>
            <h1 className="dash-h1">Sua visão geral</h1>
            <div className="dash-sub">{email}</div>
          </div>
        </div>

        {aviso && <p className="dash-aviso">{aviso}</p>}

        <section className="kpis">
          <div className="kpi">
            <div className="kpi-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
            </div>
            <div className="kpi-val">{totalGalerias}</div>
            <div className="kpi-lab">Galerias</div>
          </div>
          <div className="kpi">
            <div className="kpi-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M4 17l4.5-4.5 3.5 3 3-2.5L21 17"/></svg>
            </div>
            <div className="kpi-val">{totalFotos}</div>
            <div className="kpi-lab">Fotos no total</div>
          </div>
          <div className="kpi">
            <div className="kpi-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16l3.5-4 3 2.5L20 8"/></svg>
            </div>
            <div className="kpi-val">{media}</div>
            <div className="kpi-lab">Média por galeria</div>
          </div>
          <div className="kpi">
            <div className="kpi-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9 6.8 19.8l1-5.8L3.6 9.9l5.8-.8z"/></svg>
            </div>
            <div className="kpi-val">{maior ? maior.qtd : 0}</div>
            <div className="kpi-lab">{maior ? "Maior: " + titulo(maior.slug) : "Maior galeria"}</div>
          </div>
        </section>

        {totalGalerias === 0 ? (
          <div className="dash-vazio">
            <div className="dash-vazio-t">Seu painel está pronto pra começar</div>
            <div className="dash-vazio-d">Crie sua primeira galeria e os números aparecem aqui.</div>
            <button className="dash-btn" onClick={() => router.push("/upload")}>+ Enviar fotos</button>
          </div>
        ) : (
          <>
            <section className="charts">
              <div className="card">
                <div className="card-h">
                  <span className="card-t">Fotos por galeria</span>
                  <span className="card-tag">Top {topGal.length}</span>
                </div>
                <div className="hbars">
                  {topGal.map((g) => (
                    <div className="hbar" key={g.slug}>
                      <div className="hbar-name" title={titulo(g.slug)}>{titulo(g.slug)}</div>
                      <div className="hbar-track">
                        <div className="hbar-fill" style={{ width: `${Math.max(6, (g.qtd / maxGal) * 100)}%` }} />
                      </div>
                      <div className="hbar-val">{g.qtd}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="card-h">
                  <span className="card-t">Envios por mês</span>
                  <span className="card-tag">6 meses</span>
                </div>
                {porMes.every((m) => m.qtd === 0) ? (
                  <div className="chart-vazio">Ainda sem envios nos últimos meses.</div>
                ) : (
                  <div className="vbars">
                    {porMes.map((m, i) => (
                      <div className="vbar" key={i}>
                        <div className="vbar-area">
                          <div className="vbar-fill" style={{ height: `${m.qtd === 0 ? 0 : Math.max(6, (m.qtd / maxMes) * 130)}px` }}>
                            <span className="vbar-num">{m.qtd}</span>
                          </div>
                        </div>
                        <div className="vbar-lab">{m.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="card">
              <div className="card-h">
                <span className="card-t">Suas galerias</span>
                <span className="card-tag">{totalGalerias} no total</span>
              </div>
              <div className="glist">
                {galerias.map((g) => (
                  <div className="grow" key={g.slug}>
                    <div>
                      <div className="gname">{titulo(g.slug)}</div>
                      <div className="gqtd">{g.qtd} foto{g.qtd === 1 ? "" : "s"}</div>
                    </div>
                    <div className="gacoes">
                      <button className="gacao gacao-linha" onClick={() => copiarLink(g.slug)}>Copiar link</button>
                      <a className="gacao gacao-linha" href={`/g/${g.slug}`} target="_blank" rel="noreferrer">Ver</a>
                      <button className="gacao gacao-azul" onClick={() => router.push(`/upload?galeria=${g.slug}`)}>Enviar mais</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}