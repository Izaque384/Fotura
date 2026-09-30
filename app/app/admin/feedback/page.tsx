"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase-client";

type Status = "novo" | "analisando" | "planejado" | "resolvido";
type Feedback = {
  id: string;
  user_id: string;
  tipo: "problema" | "sugestao" | "feedback";
  categoria: string;
  assunto: string;
  mensagem: string;
  nota: number | null;
  pagina_origem: string | null;
  navegador: string | null;
  screenshot_nome: string | null;
  screenshot_bytes: number | null;
  status: Status;
  admin_nota: string | null;
  criado_em: string;
  atualizado_em: string;
  nomeEstudio: string;
  email: string;
  screenshotUrl: string | null;
};

const labelsStatus: Record<Status,string> = { novo:"Novo", analisando:"Analisando", planejado:"Planejado", resolvido:"Resolvido" };
const labelsTipo = { problema:"Problema", sugestao:"Sugestão", feedback:"Feedback" };

export default function AdminFeedbackPage() {
  const router = useRouter();
  const supabase = useMemo(()=>createClient(),[]);
  const [items,setItems]=useState<Feedback[]>([]);
  const [erro,setErro]=useState("");
  const [carregando,setCarregando]=useState(true);
  const [busca,setBusca]=useState("");
  const [status,setStatus]=useState<"todos"|Status>("todos");
  const [tipo,setTipo]=useState<"todos"|"problema"|"sugestao"|"feedback">("todos");
  const [salvando,setSalvando]=useState("");
  const [notas,setNotas]=useState<Record<string,string>>({});

  useEffect(()=>{
    let ativo=true;
    void (async()=>{
      const {data}=await supabase.auth.getSession();
      if(!data.session){router.replace("/login");return}
      const r=await fetch("/api/admin/feedback",{headers:{Authorization:`Bearer ${data.session.access_token}`},cache:"no-store"});
      if(!ativo)return;
      if(r.status===403){setErro("Esta conta não possui acesso administrativo.");setCarregando(false);return}
      if(!r.ok){setErro("Não foi possível carregar os feedbacks.");setCarregando(false);return}
      const body=await r.json() as {feedbacks:Feedback[]};
      setItems(body.feedbacks??[]);
      setNotas(Object.fromEntries((body.feedbacks??[]).map(f=>[f.id,f.admin_nota??""])));
      setCarregando(false);
    })();
    return()=>{ativo=false};
  },[router,supabase]);

  async function atualizar(item:Feedback, novoStatus:Status) {
    if(salvando)return;
    const anterior=item.status;
    setSalvando(item.id);setErro("");
    setItems(atual=>atual.map(f=>f.id===item.id?{...f,status:novoStatus}:f));
    try{
      const {data}=await supabase.auth.getSession();
      const token=data.session?.access_token;
      if(!token){router.replace("/login");return}
      const r=await fetch("/api/admin/feedback",{method:"PATCH",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({id:item.id,status:novoStatus,adminNota:notas[item.id]??""})});
      const body=await r.json().catch(()=>({error:"Não foi possível atualizar."})) as {error?:string};
      if(!r.ok)throw new Error(body.error||"Não foi possível atualizar.");
    }catch(error){
      setItems(atual=>atual.map(f=>f.id===item.id?{...f,status:anterior}:f));
      setErro(error instanceof Error?error.message:"Não foi possível atualizar.");
    }finally{setSalvando("")}
  }

  async function salvarNota(item:Feedback) {
    await atualizar(item,item.status);
  }

  const filtrados=items.filter(item=>{
    if(status!=="todos"&&item.status!==status)return false;
    if(tipo!=="todos"&&item.tipo!==tipo)return false;
    const termo=busca.trim().toLowerCase();
    if(!termo)return true;
    return [item.assunto,item.mensagem,item.email,item.nomeEstudio,item.categoria,item.pagina_origem??""].some(v=>String(v).toLowerCase().includes(termo));
  });

  const novos=items.filter(i=>i.status==="novo").length;
  const data=(v:string)=>new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(v));
  const tamanho=(bytes:number|null)=>bytes===null?"":bytes<1024*1024?`${(bytes/1024).toFixed(0)} KB`:`${(bytes/1024/1024).toFixed(1)} MB`;

  return <main className="af"><style>{`
    .af{min-height:100vh;background:linear-gradient(180deg,#F0EDF7,#ECE8F4);color:#21253A;padding:42px 5vw 75px;font-family:Sora,sans-serif}.wrap{max-width:1180px;margin:auto}.top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.ey{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#70779B}.af h1{margin:7px 0 5px;font-size:29px}.sub{margin:0;color:#7A7F98;font-size:11px;line-height:1.55}.back{border:1px solid #CEC6E1;border-radius:10px;background:#F3EFF9;color:#4E556D;padding:9px 11px;font:600 10px inherit;cursor:pointer}.summary{display:flex;gap:8px;margin-top:20px;flex-wrap:wrap}.chip{padding:7px 10px;border-radius:999px;border:1px solid #D8D1E5;background:#F7F4FA;color:#636982;font-size:10px}.chip strong{color:#313750}.filters{display:grid;grid-template-columns:1fr 170px 170px;gap:9px;margin-top:15px}.filters input,.filters select{border:1px solid #D7D0E7;border-radius:10px;background:#F7F4FA;color:#30364D;padding:10px 11px;font:500 10.5px inherit;outline:0}
    .list{display:grid;gap:10px;margin-top:14px}.item{border:1px solid #DCD6E7;border-radius:14px;background:#FAF8FD;overflow:hidden}.head{display:grid;grid-template-columns:minmax(0,1fr) 130px 120px;gap:12px;align-items:center;padding:14px 15px}.who{font-size:9.5px;color:#8A8DA2;margin-bottom:4px}.subject{font-size:12px;font-weight:750;color:#30354D}.meta{font-size:9px;color:#9193A3;margin-top:5px}.pill{display:inline-flex;padding:4px 7px;border-radius:999px;border:1px solid #D9D2E5;background:#F1EDF6;color:#636A82;font-size:9px;margin-right:5px}.pill.problem{color:#A6535E;background:#FAF0F2;border-color:#E9CCD1}.pill.suggestion{color:#7A641B;background:#FFF8E7;border-color:#E6D698}.pill.feedback{color:#4E5F8B;background:#EEF3FB;border-color:#CED8EC}.status{width:100%;border:1px solid #D6CEE3;border-radius:9px;background:#F4F0F8;color:#555C73;padding:8px;font:600 9.5px inherit}.detail{border-top:1px solid #E5E0EC;padding:14px 15px;background:#F7F4FA}.detail p{white-space:pre-wrap;margin:0;color:#555C73;font-size:10.5px;line-height:1.65}.detail-grid{display:grid;grid-template-columns:1fr 310px;gap:16px}.facts{display:grid;gap:6px;margin-top:12px;font-size:9px;color:#82859A}.facts a{color:#6552A0;text-decoration:none}.note{display:grid;gap:6px}.note label{font-size:9px;font-weight:700;color:#5C6279}.note textarea{min-height:92px;border:1px solid #D7D0E7;border-radius:10px;background:#FAF8FD;padding:10px;color:#30364D;font:500 10px inherit;resize:vertical}.save{justify-self:end;border:1px solid #CFC6E6;border-radius:9px;background:#EEE9F8;color:#51466F;padding:8px 10px;font:700 9px inherit;cursor:pointer}.empty{padding:30px;text-align:center;color:#81859A;font-size:11px}.err{margin-top:12px;padding:10px;border-radius:10px;background:#FAF0F2;border:1px solid #E7C7CC;color:#A6535E;font-size:10px}details>summary{list-style:none;cursor:pointer}details>summary::-webkit-details-marker{display:none}
    @media(max-width:760px){.af{padding:30px 16px 60px}.top{flex-direction:column}.filters{grid-template-columns:1fr}.head{grid-template-columns:1fr}.detail-grid{grid-template-columns:1fr}.back{width:100%}}
  `}</style><div className="wrap">
    <div className="top"><div><div className="ey">Fotura interno</div><h1>Ajuda e feedback</h1><p className="sub">Problemas, sugestões e opiniões enviados voluntariamente pelos fotógrafos.</p></div><button className="back" onClick={()=>router.push("/admin")}>← Voltar ao admin</button></div>
    <div className="summary"><span className="chip"><strong>{items.length}</strong> mensagens recentes</span><span className="chip"><strong>{novos}</strong> novas</span></div>
    <div className="filters"><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por assunto, mensagem, conta ou categoria"/><select value={tipo} onChange={e=>setTipo(e.target.value as typeof tipo)}><option value="todos">Todos os tipos</option><option value="problema">Problemas</option><option value="sugestao">Sugestões</option><option value="feedback">Feedback</option></select><select value={status} onChange={e=>setStatus(e.target.value as typeof status)}><option value="todos">Todos os status</option>{Object.entries(labelsStatus).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></div>
    {erro&&<div className="err" role="alert">{erro}</div>}
    <div className="list">
      {carregando&&<div className="empty">Carregando mensagens…</div>}
      {!carregando&&filtrados.map(item=><details className="item" key={item.id}><summary className="head"><div><div className="who">{item.nomeEstudio||"Estúdio não configurado"} · {item.email||"sem e-mail"}</div><div className="subject">{item.assunto}</div><div className="meta">{data(item.criado_em)} · {item.categoria}{item.nota?` · avaliação ${item.nota}/5`:""}</div></div><div><span className={"pill "+(item.tipo==="problema"?"problem":item.tipo==="sugestao"?"suggestion":"feedback")}>{labelsTipo[item.tipo]}</span></div><select className="status" value={item.status} disabled={salvando===item.id} onClick={e=>e.stopPropagation()} onChange={e=>void atualizar(item,e.target.value as Status)}>{Object.entries(labelsStatus).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></summary><div className="detail"><div className="detail-grid"><div><p>{item.mensagem}</p><div className="facts">{item.pagina_origem&&<span>Origem: {item.pagina_origem}</span>}{item.screenshotUrl&&<a href={item.screenshotUrl} target="_blank" rel="noreferrer">Abrir screenshot{item.screenshot_nome?` · ${item.screenshot_nome}`:""}{item.screenshot_bytes?` · ${tamanho(item.screenshot_bytes)}`:""}</a>}<span title={item.navegador||""}>Navegador registrado: {item.navegador?"sim":"não"}</span></div></div><div className="note"><label>Nota administrativa</label><textarea value={notas[item.id]??""} maxLength={2000} onChange={e=>setNotas(v=>({...v,[item.id]:e.target.value}))} placeholder="Contexto interno, decisão ou próximo passo…"/><button className="save" disabled={salvando===item.id} onClick={()=>void salvarNota(item)}>{salvando===item.id?"Salvando…":"Salvar nota"}</button></div></div></div></details>)}
      {!carregando&&!filtrados.length&&<div className="empty">Nenhuma mensagem encontrada com estes filtros.</div>}
    </div>
  </div></main>;
}
