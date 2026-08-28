"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-client";
import { inscreverPush } from "../../lib/push-client";
import MenuFotografo from "../MenuFotografo";

type Galeria = { id: string; titulo: string; criadoEm: string | null; linkAte: string | null; prova: boolean };
type Selecao = { galeria: string; fotos: string[]; finalizada: boolean; comentarios: Record<string, string>; atualizadoEm?: string };
type Mes = { label: string; qtd: number };

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [galerias, setGalerias] = useState<Galeria[]>([]);
  const [selecoes, setSelecoes] = useState<Record<string, Selecao>>({});
  const [notifVistoEm, setNotifVistoEm] = useState<string | null>(null);
  const [sinoAberto, setSinoAberto] = useState(false);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.replace("/login"); return; }
      const uid = auth.user.id;
      setEmail(auth.user.email ?? "");
      inscreverPush(uid);

      const [perfilRes, galeriasRes] = await Promise.all([
        supabase.from("perfis").select("nome_estudio,notif_visto_em").eq("id", uid).maybeSingle(),
        supabase.from("galerias").select("id,titulo,criado_em,link_ate,prova").eq("user_id", uid).order("criado_em", { ascending: false }),
      ]);
      if (!ativo) return;
      if (galeriasRes.error) { setErro("Não foi possível carregar seu painel agora."); setCarregando(false); return; }

      setNome((perfilRes.data?.nome_estudio as string | null)?.trim() ?? "");
      setNotifVistoEm((perfilRes.data?.notif_visto_em as string | null) ?? null);

      const lista: Galeria[] = (galeriasRes.data ?? []).map((g) => ({
        id: g.id as string,
        titulo: (g.titulo as string) || "Galeria",
        criadoEm: (g.criado_em as string | null) ?? null,
        linkAte: (g.link_ate as string | null) ?? null,
        prova: Boolean(g.prova),
      }));
      setGalerias(lista);

      const ids = lista.map((g) => g.id);
      const mapa: Record<string, Selecao> = {};
      if (ids.length) {
        const { data, error } = await supabase.from("selecoes").select("galeria,fotos,finalizada,comentarios,atualizado_em").in("galeria", ids);
        if (!ativo) return;
        if (error) { setErro("Não foi possível carregar as seleções agora."); setCarregando(false); return; }
        for (const s of data ?? []) mapa[s.galeria as string] = {
          galeria: s.galeria as string,
          fotos: (s.fotos as string[]) ?? [],
          finalizada: Boolean(s.finalizada),
          comentarios: (s.comentarios as Record<string, string> | null) ?? {},
          atualizadoEm: (s.atualizado_em as string | null) ?? undefined,
        };
      }
      setSelecoes(mapa);
      setCarregando(false);
    }
    carregar();
    return () => { ativo = false; };
  }, [router, supabase]);

  const agoraMs = Date.now();
  const totalGalerias = galerias.length;
  const pendentes = Object.values(selecoes).filter((s) => !s.finalizada).length;
  const finalizadas = Object.values(selecoes).filter((s) => s.finalizada).length;
  const em7dias = agoraMs + 7 * 86400000;
  const expirando = galerias.filter((g) => {
    if (!g.linkAte) return false;
    const exp = new Date(g.linkAte + "T23:59:59").getTime();
    return exp > agoraMs && exp <= em7dias;
  });

  const galPorMes: Mes[] = [];
  const agora = new Date();
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const qtd = galerias.filter((g) => {
      if (!g.criadoEm) return false;
      const d = new Date(g.criadoEm);
      return d.getFullYear() === dt.getFullYear() && d.getMonth() === dt.getMonth();
    }).length;
    galPorMes.push({ label: dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), qtd });
  }
  const maxMes = Math.max(1, ...galPorMes.map((m) => m.qtd));

  const inicioAtual = new Date(agora.getFullYear(), agora.getMonth() - 5, 1).getTime();
  const inicioAnterior = new Date(agora.getFullYear(), agora.getMonth() - 11, 1).getTime();
  const atual6 = galerias.filter((g) => g.criadoEm && new Date(g.criadoEm).getTime() >= inicioAtual).length;
  const anterior6 = galerias.filter((g) => {
    if (!g.criadoEm) return false;
    const t = new Date(g.criadoEm).getTime();
    return t >= inicioAnterior && t < inicioAtual;
  }).length;
  const variacao = anterior6 > 0 ? Math.round(((atual6 - anterior6) / anterior6) * 100) : null;

  const provas = galerias.filter((g) => g.prova);
  const semInteracao = provas.filter((g) => !selecoes[g.id]).length;
  const emAndamento = provas.filter((g) => selecoes[g.id] && !selecoes[g.id].finalizada).length;
  const provasFinalizadas = provas.filter((g) => selecoes[g.id]?.finalizada).length;
  const totalStatus = semInteracao + emAndamento + provasFinalizadas;

  const pendentesLista = galerias
    .filter((g) => selecoes[g.id] && !selecoes[g.id].finalizada)
    .sort((a, b) => (selecoes[b.id]?.atualizadoEm ?? "").localeCompare(selecoes[a.id]?.atualizadoEm ?? ""))
    .slice(0, 3);
  const recentes = [...galerias].sort((a, b) => (b.criadoEm ?? "").localeCompare(a.criadoEm ?? "")).slice(0, 4);

  const notificacoes = galerias
    .filter((g) => selecoes[g.id]?.finalizada)
    .map((g) => ({ id: g.id, titulo: g.titulo, quando: selecoes[g.id].atualizadoEm, qtd: selecoes[g.id].fotos.length }))
    .sort((a, b) => (b.quando ?? "").localeCompare(a.quando ?? ""));
  const naoLidas = notificacoes.filter((n) => !notifVistoEm || Boolean(n.quando && n.quando > notifVistoEm)).length;

  async function abrirSino() {
    const abrir = !sinoAberto;
    setSinoAberto(abrir);
    if (!abrir || naoLidas === 0) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const agoraIso = new Date().toISOString();
    setNotifVistoEm(agoraIso);
    await supabase.from("perfis").upsert({ id: auth.user.id, notif_visto_em: agoraIso });
  }

  function relativo(iso?: string) {
    if (!iso) return "Sem atualização";
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

  function dataCurta(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  }

  function diasPara(linkAte: string | null) {
    if (!linkAte) return null;
    const fim = new Date(linkAte + "T23:59:59").getTime();
    return Math.ceil((fim - Date.now()) / 86400000);
  }

  if (carregando) return <div className="dash mf-shift"><MenuFotografo/><style>{`.dash{min-height:100vh;background:linear-gradient(180deg,#0b0b1a 0%,#101024 100%)}.db-sk-wrap{max-width:1120px;margin:0 auto;padding:40px}.db-sk{height:98px;border-radius:16px;margin-bottom:16px;background:linear-gradient(90deg,#131329,#1a1a34,#131329);background-size:200% 100%;animation:sk 1.2s infinite}@keyframes sk{to{background-position:-200% 0}}@media(max-width:640px){.db-sk-wrap{padding:74px 18px}}`}</style><div className="db-sk-wrap"><div className="db-sk"/><div className="db-sk"/><div className="db-sk"/></div></div>;

  return <div className="dash mf-shift">
    <MenuFotografo />
    <style>{`
      .dash{min-height:100vh;background:linear-gradient(180deg,#0b0b1a 0%,#101024 100%);color:#f0f0f5}.dash-body{max-width:1120px;margin:0 auto;padding:40px 40px 80px}.dash-top{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:28px}.dash-eyebrow{font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#6f76a0;margin-bottom:8px}.dash-h1{font-size:30px;font-weight:700;letter-spacing:-.5px;color:#f5f6fb;margin:0}.dash-sub{font-size:13px;color:#7a7f9a;margin-top:6px}.dash-actions{display:flex;align-items:center;gap:10px;position:relative}.dash-btn{padding:11px 18px;font-size:14px;font-weight:600;border-radius:11px;cursor:pointer;color:#fff;border:none;font-family:inherit;background:linear-gradient(90deg,#1196fc,#5d0dfa);box-shadow:0 8px 24px rgba(74,108,247,.30)}.bell{position:relative;width:42px;height:42px;border-radius:11px;border:1px solid #2a2d40;background:#131327;color:#cdd2e4;cursor:pointer}.bell-dot{position:absolute;right:7px;top:7px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:#ff6b75;color:white;font-size:9px;display:flex;align-items:center;justify-content:center}.bell-pop{position:absolute;right:0;top:50px;width:min(330px,88vw);z-index:30;background:#15152b;border:1px solid #2a2d40;border-radius:14px;box-shadow:0 18px 60px rgba(0,0,0,.45);padding:8px}.bell-item{padding:11px;border-radius:9px}.bell-item:hover{background:#1b1b35}.bell-title{font-size:12px;color:#e8e9f1}.bell-meta{font-size:10px;color:#676d87;margin-top:3px}.bell-empty{padding:18px;text-align:center;color:#6f76a0;font-size:12px}.error{padding:14px 16px;border:1px solid rgba(239,68,68,.25);background:rgba(239,68,68,.07);border-radius:12px;color:#ff9d9d;font-size:13px;margin-bottom:18px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:18px}.kpi{position:relative;overflow:hidden;background:linear-gradient(180deg,#14142b,#101023);border:1px solid #23233c;border-radius:16px;padding:20px}.kpi::after{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#1196fc,#5d0dfa);opacity:.55}.kpi-val{font-size:32px;font-weight:700;line-height:1;color:#f5f6fb}.kpi-lab{font-size:12px;color:#8a90a8;margin-top:8px}.kpi-sub{font-size:10px;color:#646a86;margin-top:8px}.alert{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 15px;border-radius:12px;margin-bottom:18px;border:1px solid rgba(246,196,69,.25);background:rgba(246,196,69,.07)}.alert strong{font-size:12px;color:#f6c445}.alert span{font-size:11px;color:#8f8b70;margin-left:8px}.alert button{border:0;background:transparent;color:#d8d9e6;font:600 11px inherit;cursor:pointer}.charts{display:grid;grid-template-columns:1.35fr .85fr;gap:16px;margin-bottom:18px}.card{background:linear-gradient(180deg,#14142b,#101023);border:1px solid #23233c;border-radius:16px;padding:22px 24px}.card-h{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px}.card-t{font-size:15px;font-weight:600;color:#eef1f6}.card-sub{font-size:10px;color:#666d88;margin-top:4px}.card-link{border:0;background:transparent;color:#8ea7ff;font:600 11px inherit;cursor:pointer}.vbars{display:flex;align-items:flex-end;gap:10px;height:180px;padding-top:16px}.vbar{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center}.vbar-area{width:100%;flex:1;display:flex;align-items:flex-end;justify-content:center}.vbar-fill{position:relative;width:58%;max-width:42px;min-height:3px;border-radius:8px 8px 2px 2px;background:linear-gradient(180deg,#1196fc,#5d0dfa)}.vbar-num{position:absolute;top:-19px;left:0;right:0;text-align:center;color:#c8ccdb;font-size:11px}.vbar-lab{font-size:10px;color:#727892;margin-top:8px;text-transform:capitalize}.status-wrap{display:flex;align-items:center;gap:22px;min-height:180px}.donut{width:126px;height:126px;border-radius:50%;position:relative;flex:0 0 auto}.donut::after{content:"";position:absolute;inset:24px;border-radius:50%;background:#121226}.donut-center{position:absolute;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;flex-direction:column}.donut-center strong{font-size:25px}.donut-center span{font-size:9px;color:#6f76a0}.legend{display:flex;flex-direction:column;gap:11px;flex:1}.legend-row{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:11px;color:#aeb2c5}.legend-left{display:flex;align-items:center;gap:7px}.dot{width:8px;height:8px;border-radius:50%}.dot.a{background:#5b6ee1}.dot.b{background:#f6c445}.dot.c{background:#53c98b}.lists{display:grid;grid-template-columns:1fr 1fr;gap:16px}.list-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid #202238}.list-row:last-child{border-bottom:0}.list-title{font-size:12px;color:#e1e3ed;font-weight:600}.list-meta{font-size:10px;color:#696f89;margin-top:4px}.status-pill{padding:4px 8px;border-radius:999px;background:rgba(74,108,247,.12);color:#9fb0ff;font-size:9px;font-weight:650}.status-pill.warn{background:rgba(246,196,69,.11);color:#f6c445}.empty{padding:28px 8px;text-align:center;color:#6f76a0;font-size:12px}@media(max-width:900px){.kpis{grid-template-columns:repeat(2,1fr)}.charts,.lists{grid-template-columns:1fr}}@media(max-width:640px){.dash-body{padding:74px 18px 60px}.kpis{grid-template-columns:1fr 1fr;gap:10px}.kpi{padding:16px}.kpi-val{font-size:27px}.status-wrap{align-items:flex-start}.dash-actions{width:100%;justify-content:flex-end}}@media(max-width:430px){.kpis{grid-template-columns:1fr}.status-wrap{flex-direction:column}.donut{align-self:center}}
    `}</style>
    <main className="dash-body">
      <div className="dash-top">
        <div><div className="dash-eyebrow">Painel</div><h1 className="dash-h1">Sua visão geral</h1><div className="dash-sub">{nome ? `Bem-vindo(a) de volta, ${nome}.` : email}</div></div>
        <div className="dash-actions">
          <button className="bell" onClick={abrirSino} aria-label="Notificações" aria-expanded={sinoAberto}>♢{naoLidas>0&&<span className="bell-dot">{naoLidas}</span>}</button>
          <button className="dash-btn" onClick={()=>router.push("/upload")}>+ Nova galeria</button>
          {sinoAberto&&<div className="bell-pop">{notificacoes.length===0?<div className="bell-empty">Nenhuma notificação recente.</div>:notificacoes.slice(0,5).map((n)=><div className="bell-item" key={n.id}><div className="bell-title">Seleção finalizada em {n.titulo}</div><div className="bell-meta">{n.qtd} foto{n.qtd===1?"":"s"} · {relativo(n.quando)}</div></div>)}</div>}
        </div>
      </div>

      {erro&&<div className="error">{erro}</div>}
      <section className="kpis">
        <div className="kpi"><div className="kpi-val">{totalGalerias}</div><div className="kpi-lab">Total de galerias</div>{variacao!==null&&<div className="kpi-sub">{variacao>0?"+":""}{variacao}% vs. 6 meses anteriores</div>}</div>
        <div className="kpi"><div className="kpi-val">{pendentes}</div><div className="kpi-lab">Seleções aguardando conclusão</div></div>
        <div className="kpi"><div className="kpi-val">{finalizadas}</div><div className="kpi-lab">Seleções finalizadas</div></div>
        <div className="kpi"><div className="kpi-val">{expirando.length}</div><div className="kpi-lab">Galerias expirando em 7 dias</div></div>
      </section>

      {expirando.length>0?<div className="alert"><div><strong>{expirando.length} galeria{expirando.length===1?"":"s"} perto de expirar</strong><span>Revise os links antes do vencimento.</span></div><button onClick={()=>router.push("/dashboard/galerias")}>Ver galerias →</button></div>:pendentes>0?<div className="alert"><div><strong>{pendentes} seleção{pendentes===1?"":"ões"} em andamento</strong><span>Há clientes que ainda não finalizaram a escolha.</span></div><button onClick={()=>router.push("/dashboard/selecoes")}>Ver seleções →</button></div>:null}

      <section className="charts">
        <div className="card"><div className="card-h"><div><div className="card-t">Galerias por mês</div><div className="card-sub">{atual6} criadas nos últimos 6 meses</div></div><span className="card-sub">6 meses</span></div><div className="vbars">{galPorMes.map((m)=><div className="vbar" key={m.label}><div className="vbar-area"><div className="vbar-fill" style={{height:`${m.qtd===0?2:Math.max(10,(m.qtd/maxMes)*100)}%`}}><span className="vbar-num">{m.qtd}</span></div></div><div className="vbar-lab">{m.label}</div></div>)}</div></div>
        <div className="card"><div className="card-h"><div><div className="card-t">Status das seleções</div><div className="card-sub">Somente galerias em modo prova</div></div></div>{totalStatus===0?<div className="empty">Nenhuma galeria em modo prova ainda.</div>:<div className="status-wrap"><div className="donut" style={{background:`conic-gradient(#5b6ee1 0 ${(semInteracao/totalStatus)*100}%,#f6c445 ${(semInteracao/totalStatus)*100}% ${((semInteracao+emAndamento)/totalStatus)*100}%,#53c98b ${((semInteracao+emAndamento)/totalStatus)*100}% 100%)`}}><div className="donut-center"><strong>{totalStatus}</strong><span>provas</span></div></div><div className="legend"><div className="legend-row"><span className="legend-left"><i className="dot a"/>Aguardando cliente</span><strong>{semInteracao}</strong></div><div className="legend-row"><span className="legend-left"><i className="dot b"/>Em andamento</span><strong>{emAndamento}</strong></div><div className="legend-row"><span className="legend-left"><i className="dot c"/>Finalizadas</span><strong>{provasFinalizadas}</strong></div></div></div>}</div>
      </section>

      <section className="lists">
        <div className="card"><div className="card-h"><div className="card-t">Seleções aguardando cliente</div><button className="card-link" onClick={()=>router.push("/dashboard/selecoes")}>Ver todas</button></div>{pendentesLista.length===0?<div className="empty">Nenhuma seleção em andamento.</div>:pendentesLista.map((g)=>{const s=selecoes[g.id];const comentarios=Object.values(s.comentarios).filter((x)=>(x??"").trim()).length;return <div className="list-row" key={g.id}><div><div className="list-title">{g.titulo}</div><div className="list-meta">{s.fotos.length} escolhida{s.fotos.length===1?"":"s"} · {comentarios} comentário{comentarios===1?"":"s"} · {relativo(s.atualizadoEm)}</div></div><button className="card-link" onClick={()=>router.push(`/dashboard/selecoes?galeria=${g.id}`)}>Ver seleção</button></div>})}</div>
        <div className="card"><div className="card-h"><div className="card-t">Últimas galerias</div><button className="card-link" onClick={()=>router.push("/dashboard/galerias")}>Ver todas</button></div>{recentes.length===0?<div className="empty">Nenhuma galeria criada ainda.</div>:recentes.map((g)=>{const dias=diasPara(g.linkAte);return <div className="list-row" key={g.id}><div><div className="list-title">{g.titulo}</div><div className="list-meta">Criada em {dataCurta(g.criadoEm)}</div></div><span className={"status-pill"+(dias!==null&&dias>0&&dias<=7?" warn":"")}>{dias!==null&&dias>0&&dias<=7?`Expira em ${dias}d`:g.prova?"Prova":"Entrega"}</span></div>})}</div>
      </section>
    </main>
  </div>;
}
