"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "../../lib/supabase-client";
type Preset={id:string;nome:string};
export default function ProjectPresetSave({projetoId}:{projetoId:string}){
 const supabase=useMemo(()=>createClient(),[]);
 const [nome,setNome]=useState(""),[lista,setLista]=useState<Preset[]>([]),[busy,setBusy]=useState(false),[aviso,setAviso]=useState("");
 async function access(){return (await supabase.auth.getSession()).data.session?.access_token??""}
 async function carregar(){const token=await access();if(!token)return;const r=await fetch("/api/projeto/presets",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});if(!r.ok)return;const data=await r.json();setLista((data.presets??[]).map((p:Preset)=>({id:p.id,nome:p.nome})))}
 useEffect(()=>{void carregar()},[projetoId]);
 async function salvar(){if(!nome.trim()||busy)return;setBusy(true);setAviso("");try{const token=await access();const r=await fetch("/api/projeto/presets",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({projetoId,nome:nome.trim()})});const d=await r.json();if(!r.ok)throw Error(d.error||"Não foi possível salvar.");setNome("");setAviso("Modelo salvo. Ele aparecerá na criação de novos projetos.");await carregar()}catch(e){setAviso(e instanceof Error?e.message:"Não foi possível salvar.")}finally{setBusy(false)}}
 async function excluir(id:string){if(busy)return;setBusy(true);setAviso("");try{const token=await access();const r=await fetch("/api/projeto/presets",{method:"DELETE",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({id})});if(!r.ok)throw Error("Não foi possível excluir.");setAviso("Modelo excluído.");await carregar()}catch(e){setAviso(e instanceof Error?e.message:"Erro.")}finally{setBusy(false)}}
 return <section className="ft-preset"><header><span>MODELOS REUTILIZÁVEIS</span><h3>Repetir configurações sem refazer tudo</h3><p>Salve as configurações <strong>já aplicadas</strong> deste projeto e escolha o modelo ao criar seu próximo trabalho. Senhas e dados de clientes não são copiados.</p></header><div className="ft-preset-input"><input value={nome} onChange={e=>setNome(e.target.value.slice(0,70))} placeholder="Ex.: Casamentos do estúdio" aria-label="Nome do novo modelo"/><button type="button" disabled={busy||!nome.trim()} onClick={()=>void salvar()}>{busy?"Salvando…":"Salvar como modelo"}</button></div>{aviso&&<p role="status">{aviso}</p>}{lista.length>0&&<div className="ft-preset-list">{lista.map(x=><div key={x.id}><span>{x.nome}</span><button type="button" onClick={()=>void excluir(x.id)} disabled={busy} aria-label={`Excluir modelo ${x.nome}`}>Excluir</button></div>)}</div>}<style>{`
.ft-preset{margin-top:18px;padding:20px;border-radius:16px;border:1px solid #dcd4ed;background:#faf8fd;color:#2c3047}
.ft-preset header span{font-size:9px;font-weight:800;letter-spacing:1.2px;color:#7364a9}.ft-preset h3{margin:5px 0;font-size:17px}.ft-preset header p{margin:0;color:#777c92;font-size:12px;line-height:1.55}
.ft-preset-input{display:flex;gap:8px;margin-top:14px}.ft-preset-input input{flex:1;min-width:0;border:1px solid #d9d3e7;background:#fff;border-radius:9px;padding:10px;color:#30354a}
.ft-preset-input button{border:0;border-radius:9px;padding:10px 14px;background:#5d48c1;color:#fff;font-weight:750;font-size:11px;cursor:pointer}.ft-preset-input button:disabled{opacity:.5}
.ft-preset>p{font-size:12px;color:#61528d}.ft-preset-list{display:grid;gap:6px;margin-top:12px}.ft-preset-list>div{display:flex;justify-content:space-between;align-items:center;padding:9px;border:1px solid #e5e0ed;border-radius:8px;background:#fff;font-size:12px}
.ft-preset-list button{border:0;background:transparent;color:#8c5270;cursor:pointer;font-size:11px;font-weight:700}
@media(max-width:600px){.ft-preset-input{flex-direction:column}.ft-preset-input button{min-height:42px}}
`}</style></section>;
}
