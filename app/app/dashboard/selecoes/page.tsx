"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase-client";
import MenuFotografo from "../../MenuFotografo";
import ModalSelecao from "../../components/ModalSelecao";

type Galeria = { id: string; titulo: string; limite: number; prova: boolean };
type Selecao = { fotos: string[]; finalizada: boolean; comentarios: Record<string, string>; atualizadoEm?: string };
type Item = Galeria & { selecao: Selecao; comentarios: number };

export default function SelecoesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [uid, setUid] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [itens, setItens] = useState<Item[]>([]);
  const [filtro, setFiltro] = useState<"todas" | "andamento" | "finalizadas">("todas");
  const [modal, setModal] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.replace("/login"); return; }
      const meuId = auth.user.id;
      setUid(meuId);

      const { data: galerias, error: eGal } = await supabase
        .from("galerias")
        .select("id,titulo,limite,prova")
        .eq("user_id", meuId);
      if (!ativo) return;
      if (eGal) { setErro("Não foi possível carregar suas seleções agora."); setCarregando(false); return; }

      const ids = (galerias ?? []).map((g) => g.id as string);
      if (!ids.length) { setItens([]); setCarregando(false); return; }

      const { data: selecoes, error: eSel } = await supabase
        .from("selecoes")
        .select("galeria,fotos,finalizada,comentarios,atualizado_em")
        .in("galeria", ids);
      if (!ativo) return;
      if (eSel) { setErro("Não foi possível carregar suas seleções agora."); setCarregando(false); return; }

      const galPorId = new Map((galerias ?? []).map((g) => [g.id as string, g]));
      const lista: Item[] = (selecoes ?? []).flatMap((s) => {
        const g = galPorId.get(s.galeria as string);
        if (!g) return [];
        const comentarios = (s.comentarios as Record<string, string> | null) ?? {};
        return [{
          id: g.id as string,
          titulo: (g.titulo as string) || "Galeria",
          limite: (g.limite as number) ?? 0,
          prova: Boolean(g.prova),
          selecao: {
            fotos: (s.fotos as string[]) ?? [],
            finalizada: Boolean(s.finalizada),
            comentarios,
            atualizadoEm: (s.atualizado_em as string | null) ?? undefined,
          },
          comentarios: Object.values(comentarios).filter((t) => (t ?? "").trim()).length,
        }];
      }).sort((a, b) => (b.selecao.atualizadoEm ?? "").localeCompare(a.selecao.atualizadoEm ?? ""));

      setItens(lista);
      setCarregando(false);

      const foco = new URLSearchParams(window.location.search).get("galeria");
      if (foco && lista.some((x) => x.id === foco)) setModal(foco);
    }
    carregar();
    return () => { ativo = false; };
  }, [router, supabase]);

  const visiveis = itens.filter((x) => filtro === "todas" || (filtro === "finalizadas" ? x.selecao.finalizada : !x.selecao.finalizada));
  const andamento = itens.filter((x) => !x.selecao.finalizada).length;
  const finalizadas = itens.filter((x) => x.selecao.finalizada).length;
  const itemModal = modal ? itens.find((x) => x.id === modal) : null;

  function relativo(iso?: string) {
    if (!iso) return "Sem atualização registrada";
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.max(0, Math.floor(diff / 60000));
    if (min < 1) return "agora";
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `há ${d} dia${d === 1 ? "" : "s"}`;
    return new Date(iso).toLocaleDateString("pt-BR");
  }

  return (
    <div className="dash mf-shift">
      <MenuFotografo />
      <style>{`
        .dash{min-height:100vh;background:linear-gradient(180deg,#0b0b1a 0%,#101024 100%);color:#f0f0f5}.dash-body{max-width:1120px;margin:0 auto;padding:40px 40px 80px}.dash-top{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:26px}.dash-eyebrow{font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#6f76a0;margin-bottom:8px}.dash-h1{font-size:30px;font-weight:700;letter-spacing:-.5px;color:#f5f6fb;margin:0}.dash-sub{font-size:13px;color:#7a7f9a;margin-top:6px}.sel-tabs{display:flex;gap:6px;padding:4px;border:1px solid #23233c;border-radius:11px;background:#111124}.sel-tab{border:0;background:transparent;color:#7a7f9a;padding:8px 12px;border-radius:8px;font:600 12px inherit;cursor:pointer}.sel-tab.on{color:#fff;background:linear-gradient(90deg,rgba(17,150,252,.18),rgba(93,13,250,.14))}.sel-summary{display:grid;grid-template-columns:repeat(2,minmax(0,220px));gap:12px;margin-bottom:18px}.sel-mini{background:linear-gradient(180deg,#14142b,#101023);border:1px solid #23233c;border-radius:14px;padding:16px}.sel-mini strong{display:block;font-size:25px;color:#f5f6fb}.sel-mini span{font-size:12px;color:#7a7f9a}.sel-list{display:flex;flex-direction:column;gap:10px}.sel-row{display:grid;grid-template-columns:minmax(180px,1.5fr) repeat(3,minmax(100px,.6fr)) auto;gap:14px;align-items:center;padding:17px 18px;border:1px solid #23233c;border-radius:14px;background:linear-gradient(180deg,#14142b,#101023)}.sel-title{font-size:14px;font-weight:650;color:#eef1f6}.sel-meta{font-size:11px;color:#6f76a0;margin-top:4px}.sel-k{font-size:10px;text-transform:uppercase;letter-spacing:.9px;color:#626985}.sel-v{font-size:12px;color:#c9ccda;margin-top:4px}.sel-status{display:inline-flex;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:650}.sel-status.and{background:rgba(246,196,69,.12);color:#f6c445}.sel-status.fin{background:rgba(34,197,94,.12);color:#8fe3b0}.sel-btn{padding:9px 12px;border-radius:9px;border:1px solid #30334d;background:rgba(255,255,255,.025);color:#d9dbea;font:600 12px inherit;cursor:pointer}.sel-btn:hover{border-color:#4a6cf7}.sel-empty,.sel-error{padding:42px 24px;text-align:center;border:1px solid #23233c;border-radius:16px;background:linear-gradient(180deg,#14142b,#101023);color:#7a7f9a;font-size:13px}.sel-error{color:#ff9d9d}.sk{height:72px;border-radius:14px;background:linear-gradient(90deg,#131329,#1a1a34,#131329);background-size:200% 100%;animation:sk 1.2s infinite}@keyframes sk{to{background-position:-200% 0}}@media(max-width:800px){.sel-row{grid-template-columns:1fr 1fr}.sel-row>div:first-child{grid-column:1/-1}.dash-body{padding:74px 18px 60px}}@media(max-width:520px){.sel-row{grid-template-columns:1fr}.sel-row>div:first-child{grid-column:auto}.sel-summary{grid-template-columns:1fr 1fr}}
      `}</style>
      <main className="dash-body">
        <div className="dash-top">
          <div><div className="dash-eyebrow">Seleções</div><h1 className="dash-h1">Provas dos seus clientes</h1><div className="dash-sub">Acompanhe escolhas, comentários e finalizações em um único lugar.</div></div>
          <div className="sel-tabs" role="group" aria-label="Filtrar seleções">
            <button className={"sel-tab"+(filtro==="todas"?" on":"")} onClick={()=>setFiltro("todas")}>Todas</button>
            <button className={"sel-tab"+(filtro==="andamento"?" on":"")} onClick={()=>setFiltro("andamento")}>Em andamento</button>
            <button className={"sel-tab"+(filtro==="finalizadas"?" on":"")} onClick={()=>setFiltro("finalizadas")}>Finalizadas</button>
          </div>
        </div>

        {carregando ? <div className="sel-list"><div className="sk"/><div className="sk"/><div className="sk"/></div> : erro ? <div className="sel-error">{erro}</div> : <>
          <div className="sel-summary"><div className="sel-mini"><strong>{andamento}</strong><span>Em andamento</span></div><div className="sel-mini"><strong>{finalizadas}</strong><span>Finalizadas</span></div></div>
          {visiveis.length === 0 ? <div className="sel-empty">{itens.length === 0 ? "Nenhum cliente iniciou uma seleção ainda." : "Nenhuma seleção neste filtro."}</div> : <div className="sel-list">{visiveis.map((x)=><article className="sel-row" key={x.id}>
            <div><div className="sel-title">{x.titulo}</div><div className="sel-meta">Atualizada {relativo(x.selecao.atualizadoEm)}</div></div>
            <div><div className="sel-k">Escolhidas</div><div className="sel-v">{x.selecao.fotos.length}{x.limite > 0 ? ` / ${x.limite}` : ""}</div></div>
            <div><div className="sel-k">Comentários</div><div className="sel-v">{x.comentarios}</div></div>
            <div><div className="sel-k">Status</div><div className={"sel-status "+(x.selecao.finalizada?"fin":"and")}>{x.selecao.finalizada?"Finalizada":"Em andamento"}</div></div>
            <button className="sel-btn" onClick={()=>setModal(x.id)}>Ver seleção</button>
          </article>)}</div>}
        </>}
      </main>
      {itemModal && <ModalSelecao uid={uid} galeriaId={itemModal.id} titulo={itemModal.titulo} selecao={itemModal.selecao} onFechar={()=>setModal(null)}/>} 
    </div>
  );
}
