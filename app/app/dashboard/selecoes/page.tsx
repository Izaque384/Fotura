"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase-client";
import MenuFotografo from "../../MenuFotografo";
import ModalSelecao from "../../components/ModalSelecao";

type Cliente = { id: string; nome: string };
type Etapa = "prova" | "selecao_finalizada" | "preparando_entrega" | "entrega";
type Galeria = {
  id: string;
  titulo: string;
  limite: number;
  prova: boolean;
  etapa: Etapa;
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
type Status = "sem_interacao" | "andamento" | "finalizada" | "preparando_entrega";
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

function statusDaGaleria(g: Galeria, selecao: Selecao | null): Status {
  if (g.etapa === "preparando_entrega") return "preparando_entrega";
  if (selecao?.finalizada || g.etapa === "selecao_finalizada") return "finalizada";
  if (selecao) return "andamento";
  return "sem_interacao";
}

function rotuloStatus(status: Status) {
  if (status === "preparando_entrega") return "Preparando entrega";
  if (status === "finalizada") return "Seleção finalizada";
  if (status === "andamento") return "Em andamento";
  return "Sem interação";
}

function SearchIcon(){return <svg className="search-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>}

export default function SelecoesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [uid, setUid] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState("");
  const [itens, setItens] = useState<Item[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState<string | null>(null);

  useEffect(() => {
    const inicial = new URLSearchParams(window.location.search).get("filtro");
    if (
      inicial === "sem_interacao" ||
      inicial === "andamento" ||
      inicial === "finalizada" ||
      inicial === "preparando_entrega"
    ) setFiltro(inicial);
  }, []);

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
      supabase.from("galerias").select("id,titulo,limite,prova,etapa,cliente_id,criado_em").eq("user_id", meuId),
      supabase.from("clientes").select("id,nome").eq("user_id", meuId),
      supabase.rpc("resumo_storage_galerias"),
    ]);

    if (eGal || eCli) {
      setErro("Não foi possível carregar suas seleções agora.");
      setCarregando(false);
      setAtualizando(false);
      return;
    }

    const bases = (galerias ?? []) as Array<{
      id:string; titulo:string|null; limite:number|null; prova:boolean|null; etapa:string|null;
      cliente_id:string|null; criado_em:string|null;
    }>;
    const idsTodas = bases.map(g => g.id);
    let selecoes: Array<{galeria:string;fotos:string[]|null;finalizada:boolean|null;comentarios:Record<string,string>|null;atualizado_em:string|null}> = [];
    if (idsTodas.length) {
      const { data, error } = await supabase.from("selecoes").select("galeria,fotos,finalizada,comentarios,atualizado_em").in("galeria", idsTodas);
      if (error) {
        setErro("Não foi possível carregar suas seleções agora.");
        setCarregando(false);
        setAtualizando(false);
        return;
      }
      selecoes = (data ?? []) as typeof selecoes;
    }

    const selecaoPorGaleria = new Map(selecoes.map((s) => [s.galeria, s]));
    const galeriasRelevantes = bases.filter(g => g.etapa !== "entrega" && (Boolean(g.prova) || selecaoPorGaleria.has(g.id)));
    const resumoPorId = new Map(((resumos ?? []) as {galeria_id:string;arquivo_capa:string|null}[]).map(r=>[r.galeria_id,r.arquivo_capa]));
    const capas = galeriasRelevantes.map(g=>({id:g.id,nome:resumoPorId.get(g.id)??null})).filter(x=>Boolean(x.nome)) as {id:string;nome:string}[];
    const caminhos = capas.flatMap(c=>[`${meuId}/${c.id}/thumbs/${c.nome}`,`${meuId}/${c.id}/${c.nome}`]);
    const mapaUrls = new Map<string,string>();
    for(let i=0;i<caminhos.length;i+=200){
      const {data:signed}=await supabase.storage.from("fotos").createSignedUrls(caminhos.slice(i,i+200),3600);
      for(const u of signed??[]) if(u.path&&u.signedUrl) mapaUrls.set(u.path as string,u.signedUrl as string);
    }

    const clientePorId = new Map(((clientes ?? []) as Cliente[]).map((c) => [c.id, c.nome]));
    const lista: Item[] = galeriasRelevantes.map((g) => {
      const id=g.id;
      const nome=resumoPorId.get(id)??null;
      const raw=selecaoPorGaleria.get(id);
      const selecao:Selecao|null=raw?{
        fotos:raw.fotos??[],
        finalizada:Boolean(raw.finalizada),
        comentarios:raw.comentarios??{},
        atualizadoEm:raw.atualizado_em??undefined,
      }:null;
      const galeria:Galeria={
        id,
        titulo:g.titulo||"Galeria",
        limite:g.limite??0,
        prova:Boolean(g.prova),
        etapa:((g.etapa as Etapa|null)??(g.prova?"prova":"entrega")),
        clienteId:g.cliente_id??null,
        criadoEm:g.criado_em??undefined,
        capaUrl:nome?(mapaUrls.get(`${meuId}/${id}/thumbs/${nome}`)??mapaUrls.get(`${meuId}/${id}/${nome}`)):undefined,
      };
      const comentarios=selecao?Object.values(selecao.comentarios).filter(t=>(t??"").trim()).length:0;
      return {
        ...galeria,
        selecao,
        comentarios,
        clienteNome:galeria.clienteId?clientePorId.get(galeria.clienteId)??null:null,
        status:statusDaGaleria(galeria,selecao),
      };
    }).sort((a,b)=>(b.selecao?.atualizadoEm??b.criadoEm??"").localeCompare(a.selecao?.atualizadoEm??a.criadoEm??""));

    setItens(lista);
    setModal((atual) => atual && lista.some((x) => x.id === atual && x.selecao) ? atual : null);
    setCarregando(false);
    setAtualizando(false);

    if (!silencioso) {
      const params = new URLSearchParams(window.location.search);
      const foco = params.get("galeria");
      if (foco && lista.some((x) => x.id === foco && x.selecao)) setModal(foco);
      const filtroInicial = params.get("filtro");
      if (["sem_interacao","andamento","finalizada","preparando_entrega"].includes(filtroInicial ?? "")) {
        setFiltro(filtroInicial as Filtro);
      }
    }
  }, [router, supabase]);

  useEffect(() => { void carregar(false); }, [carregar]);
  useEffect(() => {
    const id=window.setInterval(()=>void carregar(true),60_000);
    const aoVisivel=()=>{if(document.visibilityState==="visible")void carregar(true)};
    document.addEventListener("visibilitychange",aoVisivel);
    return()=>{window.clearInterval(id);document.removeEventListener("visibilitychange",aoVisivel)};
  },[carregar]);

  const contagens=useMemo(()=>({
    sem_interacao:itens.filter(x=>x.status==="sem_interacao").length,
    andamento:itens.filter(x=>x.status==="andamento").length,
    finalizada:itens.filter(x=>x.status==="finalizada").length,
    preparando_entrega:itens.filter(x=>x.status==="preparando_entrega").length,
  }),[itens]);
  const visiveis=useMemo(()=>{const termo=busca.trim().toLocaleLowerCase("pt-BR");return itens.filter(x=>(filtro==="todas"||x.status===filtro)&&(!termo||x.titulo.toLocaleLowerCase("pt-BR").includes(termo)||(x.clienteNome??"").toLocaleLowerCase("pt-BR").includes(termo)))},[busca,filtro,itens]);
  const itemModal=modal?itens.find(x=>x.id===modal):null;

  function acaoItem(x:Item){
    if(x.status==="preparando_entrega") return <button className="sel-btn primary-stage" onClick={()=>router.push(`/dashboard/entrega/${x.id}`)}>Continuar entrega</button>;
    return <button className="sel-btn" disabled={!x.selecao} onClick={()=>x.selecao&&setModal(x.id)}>{x.selecao?"Ver seleção":"Aguardando"}</button>;
  }

  return <div className="dash mf-shift"><MenuFotografo/><style>{`
    .dash{min-height:100vh;background:linear-gradient(180deg,#F0EDF7 0%,#ECE8F4 100%);color:#21253A}.dash-body{max-width:1120px;margin:0 auto;padding:40px 40px 80px}.dash-top{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:22px}.dash-eyebrow{font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#6f76a0;margin-bottom:8px}.dash-h1{font-size:30px;font-weight:700;letter-spacing:-.5px;color:#21253A;margin:0}.dash-sub{font-size:13px;color:#7a7f9a;margin-top:6px}.sel-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.sel-refresh{height:38px;padding:0 12px;border:1px solid #30334d;border-radius:10px;background:#FAF8FD;color:#596079;font:600 12px inherit;cursor:pointer}.sel-refresh:disabled{opacity:.55}.selection-toolbar{display:flex;justify-content:flex-start;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px}.search-box{position:relative;display:inline-flex;align-items:center;width:min(320px,100%);flex:0 1 320px}.search-icon{position:absolute;left:10px;width:14px;height:14px;color:#747a96;pointer-events:none}.sel-search{width:100%;min-width:0;height:34px;padding:7px 10px 7px 31px;border:1px solid #D7D0E7;border-radius:9px;background:#F3EFF9;color:#21253A;font-family:inherit;font-size:12px;font-weight:500;outline:none;box-sizing:border-box}.sel-search:focus{border-color:#BFB4D7;background:#F7F4FB}.filter-wrap{position:relative;display:inline-flex}.filter-trigger{height:34px;display:inline-flex;align-items:center;gap:7px;padding:0 11px;border:1px solid #D7D0E7;border-radius:9px;background:#FAF8FD;color:#555b73;font-family:inherit;font-size:11px;font-weight:700;line-height:1;cursor:pointer;white-space:nowrap}.filter-trigger:hover,.filter-trigger.open{border-color:#BFB4D7;background:#F3EFF9}.filter-chevron{font-size:12px;color:#7a7f9a;transform:translateY(-1px)}.filter-menu{position:absolute;left:0;top:calc(100% + 6px);z-index:40;min-width:168px;padding:5px;border:1px solid #D7D0E7;border-radius:10px;background:#FAF8FD;box-shadow:0 12px 28px rgba(49,42,79,.13)}.filter-option{width:100%;display:flex;align-items:center;justify-content:space-between;gap:14px;border:0;border-radius:7px;background:transparent;color:#555b73;padding:8px 9px;font-family:inherit;font-size:12px;font-weight:650;cursor:pointer;text-align:left}.filter-option:hover{background:#F0EBF7}.filter-option.on{color:#514780;background:#ECE7F6}.filter-check{font-size:10px}.sel-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:18px 0}.sel-mini{background:linear-gradient(180deg,#FAF8FD,#F3EFF9);border:1px solid #DCD6EE;border-radius:14px;padding:15px;box-shadow:0 8px 24px rgba(65,52,111,.05)}.sel-mini strong{display:block;font-size:24px;color:#21253A}.sel-mini span{font-size:11px;color:#73758D}.sel-list{display:flex;flex-direction:column;gap:10px}.sel-row{display:grid;grid-template-columns:66px minmax(180px,1.45fr) repeat(3,minmax(92px,.58fr)) auto;gap:13px;align-items:center;padding:13px 15px;border:1px solid #DCD6EE;border-radius:14px;background:#FAF8FD;box-shadow:0 7px 20px rgba(65,52,111,.045)}.sel-row.preparing{border-color:rgba(17,150,252,.66)}.sel-cover{width:66px;height:52px;border-radius:9px;overflow:hidden;background:#E7E2F1}.sel-cover img{width:100%;height:100%;object-fit:cover}.sel-title-line{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.sel-title{font-size:14px;font-weight:650;color:#21253A}.mode-stage{display:inline-flex;padding:3px 7px;border-radius:999px;font-size:9px;font-weight:750;color:#f7b84a;background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.40)}.mode-stage.prepare{color:#8acfff;background:rgba(17,150,252,.08);border-color:rgba(17,150,252,.40)}.sel-meta{font-size:11px;color:#73758D;margin-top:4px}.sel-client{color:#73758D}.sel-k{font-size:10px;text-transform:uppercase;letter-spacing:.9px;color:#7B7D92}.sel-v{font-size:12px;color:#353B53;margin-top:4px}.sel-status{display:inline-flex;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:650;white-space:nowrap}.sel-status.sem{background:rgba(111,118,160,.12);color:#9299b4}.sel-status.and{background:rgba(246,196,69,.12);color:#9A6D10}.sel-status.fin{background:rgba(34,197,94,.12);color:#3F7C5B}.sel-status.prep{background:rgba(17,150,252,.12);color:#8acfff}.sel-btn{padding:9px 12px;border-radius:9px;border:1px solid #D7D0E7;background:#F3EFF9;color:#4E556D;font:600 12px inherit;cursor:pointer;white-space:nowrap}.sel-btn:hover{border-color:#4a6cf7}.sel-btn:disabled{opacity:.42;cursor:default}.sel-btn.primary-stage{border-color:rgba(17,150,252,.42);background:rgba(17,150,252,.08);color:#356A8E}.sel-empty,.sel-error{padding:42px 24px;text-align:center;border:1px solid #DCD6EE;border-radius:16px;background:linear-gradient(180deg,#FAF8FD,#F3EFF9);color:#73758D;font-size:13px;box-shadow:0 8px 24px rgba(65,52,111,.045)}.sel-error{color:#B95C66;background:#FFF0F1;border-color:#F0C7CC}.sk{height:72px;border-radius:14px;background:linear-gradient(90deg,#E8E3F0,#F3EFF9,#E8E3F0);background-size:200% 100%;animation:sk 1.2s infinite}@keyframes sk{to{background-position:-200% 0}}@media(max-width:1050px){.sel-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:920px){.sel-row{grid-template-columns:58px 1fr 1fr}.sel-row>div:nth-child(n+4){display:none}.dash-body{padding:74px 18px 60px}}@media(max-width:600px){.sel-summary{grid-template-columns:1fr 1fr}.sel-row{grid-template-columns:54px 1fr}.sel-row>div:nth-child(3){display:none}.sel-row>button{grid-column:1/-1}.sel-tools{width:100%}.selection-toolbar{width:100%}.search-box{width:100%;flex-basis:100%}.sel-search{min-width:0;width:100%}.filter-wrap{width:auto}.sel-refresh{margin-left:auto}}
  `}</style><main className="dash-body"><div className="dash-top"><div><div className="dash-eyebrow">Seleções</div><h1 className="dash-h1">Ciclo de prova e preparação</h1><div className="dash-sub">Acompanhe a seleção do cliente até a preparação da entrega final. Galerias já entregues ficam em Galerias.</div></div><div className="sel-tools"><button className="sel-refresh" onClick={()=>void carregar(true)} disabled={atualizando}>{atualizando?"Atualizando…":"Atualizar"}</button></div></div>{carregando?<div className="sel-list"><div className="sk"/><div className="sk"/><div className="sk"/></div>:erro?<div className="sel-error">{erro}</div>:<><div className="sel-summary"><div className="sel-mini"><strong>{contagens.sem_interacao}</strong><span>Sem interação</span></div><div className="sel-mini"><strong>{contagens.andamento}</strong><span>Em andamento</span></div><div className="sel-mini"><strong>{contagens.finalizada}</strong><span>Seleção finalizada</span></div><div className="sel-mini"><strong>{contagens.preparando_entrega}</strong><span>Preparando entrega</span></div></div><div className="selection-toolbar"><label className="search-box"><SearchIcon/><input className="sel-search" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar galeria ou cliente" aria-label="Buscar seleções"/></label><div className="filter-wrap"><button type="button" className={"filter-trigger"+(filtroAberto?" open":"")} aria-haspopup="menu" aria-expanded={filtroAberto} onClick={()=>setFiltroAberto(v=>!v)}>Filtrar por <span className="filter-chevron">⌄</span></button>{filtroAberto&&<div className="filter-menu" role="menu">{([["todas","Todas"],["sem_interacao","Sem interação"],["andamento","Em andamento"],["finalizada","Finalizadas"],["preparando_entrega","Preparando"]] as [Filtro,string][]).map(([valor,rotulo])=><button type="button" role="menuitem" key={valor} className={"filter-option"+(filtro===valor?" on":"")} onClick={()=>{setFiltro(valor);setFiltroAberto(false)}}><span>{rotulo}</span>{filtro===valor&&<span className="filter-check">✓</span>}</button>)}</div>}</div></div>{visiveis.length===0?<div className="sel-empty">{itens.length===0?"Nenhuma prova ou seleção ativa registrada agora.":"Nenhuma seleção encontrada neste filtro."}</div>:<div className="sel-list">{visiveis.map(x=>{const classe=x.status==="preparando_entrega"?" preparing":"";const modo=x.status==="preparando_entrega"?"Preparando entrega":"Prova";const modoClasse=x.status==="preparando_entrega"?" prepare":"";const statusClasse=x.status==="preparando_entrega"?"prep":x.status==="finalizada"?"fin":x.status==="andamento"?"and":"sem";return <article className={"sel-row"+classe} key={x.id}><div className="sel-cover">{x.capaUrl&&<img src={x.capaUrl} alt=""/>}</div><div><div className="sel-title-line"><div className="sel-title">{x.titulo}</div><span className={"mode-stage"+modoClasse}>{modo}</span></div><div className="sel-meta">{x.clienteNome&&<span className="sel-client">{x.clienteNome} · </span>}{x.selecao?`Atualizada ${relativo(x.selecao.atualizadoEm)}`:"Cliente ainda não interagiu"}</div></div><div><div className="sel-k">Escolhidas</div><div className="sel-v">{x.selecao?.fotos.length??0}{x.limite>0?` / ${x.limite}`:""}</div></div><div><div className="sel-k">Comentários</div><div className="sel-v">{x.comentarios}</div></div><div><div className="sel-k">Status</div><div className={"sel-status "+statusClasse}>{rotuloStatus(x.status)}</div></div>{acaoItem(x)}</article>})}</div>}</>}</main>{itemModal?.selecao&&<ModalSelecao uid={uid} galeriaId={itemModal.id} titulo={itemModal.titulo} selecao={itemModal.selecao} onFechar={()=>setModal(null)}/>}</div>;
}
