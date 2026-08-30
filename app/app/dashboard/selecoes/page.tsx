"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase-client";
import MenuFotografo from "../../MenuFotografo";
import ModalSelecao from "../../components/ModalSelecao";

type Cliente = { id: string; nome: string };
type Galeria = {
  id: string;
  titulo: string;
  limite: number;
  prova: boolean;
  clienteId: string | null;
  criadoEm?: string;
  capaUrl?: string;
};
type Selecao = {
  fotos: string[];
  finalizada: boolean;
  comentarios: Record<string, string>;
  atualizadoEm?: string;
};
type Status = "sem_interacao" | "andamento" | "finalizada";
type Item = Galeria & {
  selecao: Selecao | null;
  comentarios: number;
  clienteNome: string | null;
  status: Status;
};
type Filtro = "todas" | Status;

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

export default function SelecoesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [uid, setUid] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState("");
  const [itens, setItens] = useState<Item[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState<string | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (silencioso) setAtualizando(true);
    else setCarregando(true);
    setErro("");

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.replace("/login");
      return;
    }
    const meuId = auth.user.id;
    setUid(meuId);

    const [{ data: galerias, error: eGal }, { data: clientes, error: eCli }, { data: resumos }] = await Promise.all([
      supabase.from("galerias").select("id,titulo,limite,prova,cliente_id,criado_em").eq("user_id", meuId).eq("prova", true),
      supabase.from("clientes").select("id,nome").eq("user_id", meuId),
      supabase.rpc("resumo_storage_galerias"),
    ]);

    if (eGal || eCli) {
      setErro("Não foi possível carregar suas seleções agora.");
      setCarregando(false);
      setAtualizando(false);
      return;
    }

    const resumoPorId = new Map(((resumos ?? []) as {galeria_id:string;arquivo_capa:string|null}[]).map(r=>[r.galeria_id,r.arquivo_capa]));
    const capas = (galerias ?? []).map(g=>({id:g.id as string,nome:resumoPorId.get(g.id as string)??null})).filter(x=>Boolean(x.nome)) as {id:string;nome:string}[];
    const caminhos = capas.flatMap(c=>[`${meuId}/${c.id}/thumbs/${c.nome}`,`${meuId}/${c.id}/${c.nome}`]);
    const mapaUrls = new Map<string,string>();
    if(caminhos.length){
      for(let i=0;i<caminhos.length;i+=200){
        const {data:signed}=await supabase.storage.from("fotos").createSignedUrls(caminhos.slice(i,i+200),3600);
        for(const u of signed??[]) if(u.path&&u.signedUrl) mapaUrls.set(u.path as string,u.signedUrl as string);
      }
    }

    const listaGalerias = (galerias ?? []).map((g) => {
      const id=g.id as string;
      const nome=resumoPorId.get(id)??null;
      return {
        id,
        titulo: (g.titulo as string) || "Galeria",
        limite: (g.limite as number) ?? 0,
        prova: Boolean(g.prova),
        clienteId: (g.cliente_id as string | null) ?? null,
        criadoEm: (g.criado_em as string | null) ?? undefined,
        capaUrl:nome?(mapaUrls.get(`${meuId}/${id}/thumbs/${nome}`)??mapaUrls.get(`${meuId}/${id}/${nome}`)):undefined,
      };
    }) satisfies Galeria[];

    const ids = listaGalerias.map((g) => g.id);
    let selecoes: Array<{galeria:string;fotos:string[]|null;finalizada:boolean|null;comentarios:Record<string,string>|null;atualizado_em:string|null}> = [];

    if (ids.length) {
      const { data, error } = await supabase.from("selecoes").select("galeria,fotos,finalizada,comentarios,atualizado_em").in("galeria", ids);
      if (error) {
        setErro("Não foi possível carregar suas seleções agora.");
        setCarregando(false);
        setAtualizando(false);
        return;
      }
      selecoes = (data ?? []) as typeof selecoes;
    }

    const clientePorId = new Map(((clientes ?? []) as Cliente[]).map((c) => [c.id, c.nome]));
    const selecaoPorGaleria = new Map(selecoes.map((s) => [s.galeria, s]));

    const lista: Item[] = listaGalerias.map((g) => {
      const s = selecaoPorGaleria.get(g.id);
      if (!s) return {...g,selecao:null,comentarios:0,clienteNome:g.clienteId?clientePorId.get(g.clienteId)??null:null,status:"sem_interacao" as const};
      const comentarios=s.comentarios??{};
      const selecao:Selecao={fotos:s.fotos??[],finalizada:Boolean(s.finalizada),comentarios,atualizadoEm:s.atualizado_em??undefined};
      return {...g,selecao,comentarios:Object.values(comentarios).filter(t=>(t??"").trim()).length,clienteNome:g.clienteId?clientePorId.get(g.clienteId)??null:null,status:selecao.finalizada?"finalizada" as const:"andamento" as const};
    }).sort((a,b)=>(b.selecao?.atualizadoEm??b.criadoEm??"").localeCompare(a.selecao?.atualizadoEm??a.criadoEm??""));

    setItens(lista);
    setModal((atual) => atual && lista.some((x) => x.id === atual && x.selecao) ? atual : null);
    setCarregando(false);
    setAtualizando(false);

    if (!silencioso) {
      const foco = new URLSearchParams(window.location.search).get("galeria");
      if (foco && lista.some((x) => x.id === foco && x.selecao)) setModal(foco);
    }
  }, [router, supabase]);

  const atualizarSelecoes = useCallback(async () => {
    if (!itens.length) return;
    setAtualizando(true);
    const ids = itens.map((x) => x.id);
    const { data, error } = await supabase.from("selecoes").select("galeria,fotos,finalizada,comentarios,atualizado_em").in("galeria", ids);
    if (error) { setAtualizando(false); return; }
    const porGaleria = new Map((data ?? []).map((s) => [s.galeria as string, s]));
    setItens((atuais) => atuais.map((item) => {
      const s = porGaleria.get(item.id);
      if (!s) return { ...item, selecao: null, comentarios: 0, status: "sem_interacao" as const };
      const comentarios = (s.comentarios as Record<string, string> | null) ?? {};
      const selecao: Selecao = {fotos:(s.fotos as string[])??[],finalizada:Boolean(s.finalizada),comentarios,atualizadoEm:(s.atualizado_em as string|null)??undefined};
      return {...item,selecao,comentarios:Object.values(comentarios).filter(t=>(t??"").trim()).length,status:selecao.finalizada?"finalizada" as const:"andamento" as const};
    }).sort((a,b)=>(b.selecao?.atualizadoEm??b.criadoEm??"").localeCompare(a.selecao?.atualizadoEm??a.criadoEm??"")));
    setAtualizando(false);
  }, [itens, supabase]);

  useEffect(() => { void carregar(false); }, [carregar]);
  useEffect(() => {const id=window.setInterval(()=>void atualizarSelecoes(),60_000);const aoVisivel=()=>{if(document.visibilityState==="visible")void atualizarSelecoes()};document.addEventListener("visibilitychange",aoVisivel);return()=>{window.clearInterval(id);document.removeEventListener("visibilitychange",aoVisivel)}},[atualizarSelecoes]);

  const contagens=useMemo(()=>({sem_interacao:itens.filter(x=>x.status==="sem_interacao").length,andamento:itens.filter(x=>x.status==="andamento").length,finalizada:itens.filter(x=>x.status==="finalizada").length}),[itens]);
  const visiveis=useMemo(()=>{const termo=busca.trim().toLocaleLowerCase("pt-BR");return itens.filter(x=>(filtro==="todas"||x.status===filtro)&&(!termo||x.titulo.toLocaleLowerCase("pt-BR").includes(termo)||(x.clienteNome??"").toLocaleLowerCase("pt-BR").includes(termo)))},[busca,filtro,itens]);
  const itemModal=modal?itens.find(x=>x.id===modal):null;

  return <div className="dash mf-shift"><MenuFotografo/><style>{`
    .dash{min-height:100vh;background:linear-gradient(180deg,#090917 0%,#0e0e20 100%);color:#f0f0f5}.dash-body{max-width:1120px;margin:0 auto;padding:40px 40px 80px}.dash-top{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:22px}.dash-eyebrow{font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#6f76a0;margin-bottom:8px}.dash-h1{font-size:30px;font-weight:700;letter-spacing:-.5px;color:#f5f6fb;margin:0}.dash-sub{font-size:13px;color:#7a7f9a;margin-top:6px}.sel-tools{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.sel-refresh{height:38px;padding:0 12px;border:1px solid #30334d;border-radius:10px;background:#111124;color:#aeb3c8;font:600 12px inherit;cursor:pointer}.sel-refresh:disabled{opacity:.55}.sel-search{field-sizing:content;width:auto;min-width:calc(25ch + 46px);max-width:100%;height:40px;border:1px solid #272a43;border-radius:10px;background:#0f0f1e;color:#eef1f6;padding:0 13px 0 35px;font:500 13px inherit;outline:none;box-sizing:border-box;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237a7f9a' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:12px center;background-size:14px}.sel-search:focus{border-color:#43507c}.sel-tabs{display:flex;gap:6px;padding:4px;border:1px solid #23233c;border-radius:11px;background:#111124;overflow:auto}.sel-tab{white-space:nowrap;border:0;background:transparent;color:#7a7f9a;padding:8px 12px;border-radius:8px;font:600 12px inherit;cursor:pointer}.sel-tab.on{color:#fff;background:linear-gradient(90deg,rgba(17,150,252,.18),rgba(93,13,250,.14))}.sel-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:18px 0}.sel-mini{background:linear-gradient(180deg,#14142b,#101023);border:1px solid #23233c;border-radius:14px;padding:16px}.sel-mini strong{display:block;font-size:25px;color:#f5f6fb}.sel-mini span{font-size:12px;color:#7a7f9a}.sel-list{display:flex;flex-direction:column;gap:10px}.sel-row{display:grid;grid-template-columns:66px minmax(180px,1.45fr) repeat(3,minmax(92px,.58fr)) auto;gap:13px;align-items:center;padding:13px 15px;border:1px solid rgba(245,158,11,.78);border-radius:14px;background:linear-gradient(180deg,#14142b,#101023);box-shadow:inset 0 0 0 1px rgba(245,158,11,.05)}.sel-cover{width:66px;height:52px;border-radius:9px;overflow:hidden;background:#0d0d1b}.sel-cover img{width:100%;height:100%;object-fit:cover}.sel-title-line{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.sel-title{font-size:14px;font-weight:650;color:#eef1f6}.mode-proof{display:inline-flex;padding:3px 7px;border-radius:999px;font-size:9px;font-weight:750;color:#f7b84a;background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.46)}.sel-meta{font-size:11px;color:#6f76a0;margin-top:4px}.sel-client{color:#9299b4}.sel-k{font-size:10px;text-transform:uppercase;letter-spacing:.9px;color:#626985}.sel-v{font-size:12px;color:#c9ccda;margin-top:4px}.sel-status{display:inline-flex;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:650}.sel-status.sem{background:rgba(111,118,160,.12);color:#9299b4}.sel-status.and{background:rgba(246,196,69,.12);color:#f6c445}.sel-status.fin{background:rgba(34,197,94,.12);color:#8fe3b0}.sel-btn{padding:9px 12px;border-radius:9px;border:1px solid #30334d;background:rgba(255,255,255,.025);color:#d9dbea;font:600 12px inherit;cursor:pointer}.sel-btn:hover{border-color:#4a6cf7}.sel-btn:disabled{opacity:.42;cursor:default}.sel-empty,.sel-error{padding:42px 24px;text-align:center;border:1px solid #23233c;border-radius:16px;background:linear-gradient(180deg,#14142b,#101023);color:#7a7f9a;font-size:13px}.sel-error{color:#ff9d9d}.sk{height:72px;border-radius:14px;background:linear-gradient(90deg,#131329,#1a1a34,#131329);background-size:200% 100%;animation:sk 1.2s infinite}@keyframes sk{to{background-position:-200% 0}}@media(max-width:920px){.sel-row{grid-template-columns:58px 1fr 1fr}.sel-row>div:nth-child(n+4){display:none}.dash-body{padding:74px 18px 60px}}@media(max-width:600px){.sel-summary{grid-template-columns:1fr}.sel-row{grid-template-columns:54px 1fr}.sel-row>div:nth-child(3){display:none}.sel-row>button{grid-column:1/-1}.sel-tools,.sel-tabs{width:100%}.sel-search{field-sizing:fixed;min-width:0;width:100%}.sel-refresh{margin-left:auto}}
  `}</style><main className="dash-body"><div className="dash-top"><div><div className="dash-eyebrow">Seleções</div><h1 className="dash-h1">Provas dos seus clientes</h1><div className="dash-sub">Acompanhe desde galerias ainda não abertas até seleções finalizadas.</div></div><div className="sel-tools"><button className="sel-refresh" onClick={()=>void carregar(true)} disabled={atualizando}>{atualizando?"Atualizando…":"Atualizar"}</button></div></div>{carregando?<div className="sel-list"><div className="sk"/><div className="sk"/><div className="sk"/></div>:erro?<div className="sel-error">{erro}</div>:<><div className="sel-summary"><div className="sel-mini"><strong>{contagens.sem_interacao}</strong><span>Sem interação</span></div><div className="sel-mini"><strong>{contagens.andamento}</strong><span>Em andamento</span></div><div className="sel-mini"><strong>{contagens.finalizada}</strong><span>Finalizadas</span></div></div><div className="sel-tools" style={{marginBottom:16}}><input className="sel-search" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar galeria ou cliente" aria-label="Buscar seleções"/><div className="sel-tabs" role="group" aria-label="Filtrar seleções"><button className={"sel-tab"+(filtro==="todas"?" on":"")} onClick={()=>setFiltro("todas")}>Todas</button><button className={"sel-tab"+(filtro==="sem_interacao"?" on":"")} onClick={()=>setFiltro("sem_interacao")}>Sem interação</button><button className={"sel-tab"+(filtro==="andamento"?" on":"")} onClick={()=>setFiltro("andamento")}>Em andamento</button><button className={"sel-tab"+(filtro==="finalizada"?" on":"")} onClick={()=>setFiltro("finalizada")}>Finalizadas</button></div></div>{visiveis.length===0?<div className="sel-empty">{itens.length===0?"Nenhuma galeria em modo prova ainda.":"Nenhuma seleção encontrada neste filtro."}</div>:<div className="sel-list">{visiveis.map(x=><article className="sel-row" key={x.id}><div className="sel-cover">{x.capaUrl&&<img src={x.capaUrl} alt=""/>}</div><div><div className="sel-title-line"><div className="sel-title">{x.titulo}</div><span className="mode-proof">Prova</span></div><div className="sel-meta">{x.clienteNome&&<span className="sel-client">{x.clienteNome} · </span>}{x.selecao?`Atualizada ${relativo(x.selecao.atualizadoEm)}`:"Cliente ainda não interagiu"}</div></div><div><div className="sel-k">Escolhidas</div><div className="sel-v">{x.selecao?.fotos.length??0}{x.limite>0?` / ${x.limite}`:""}</div></div><div><div className="sel-k">Comentários</div><div className="sel-v">{x.comentarios}</div></div><div><div className="sel-k">Status</div><div className={"sel-status "+(x.status==="finalizada"?"fin":x.status==="andamento"?"and":"sem")}>{x.status==="finalizada"?"Finalizada":x.status==="andamento"?"Em andamento":"Sem interação"}</div></div><button className="sel-btn" disabled={!x.selecao} onClick={()=>x.selecao&&setModal(x.id)}>{x.selecao?"Ver seleção":"Aguardando"}</button></article>)}</div>}</>}</main>{itemModal?.selecao&&<ModalSelecao uid={uid} galeriaId={itemModal.id} titulo={itemModal.titulo} selecao={itemModal.selecao} onFechar={()=>setModal(null)}/>}</div>;
}
