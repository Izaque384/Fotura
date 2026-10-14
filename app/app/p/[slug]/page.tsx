"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { GaleriaClienteView } from "../../g/[slug]/page";
import type { ProjectClientContext } from "../../g/[slug]/gallery-types";
import PublicProjectHero from "../../components/PublicProjectHero";
import { loadGalleryGrid } from "../../g/[slug]/gallery-image-cache";
import { ArrowRightIcon } from "../../components/FoturaIcons";

type ProjetoPublico = {
  id:string;
  nome:string;
  descricao:string|null;
  publicRef:string;
  capaUrl:string|null;
  temSenha:boolean;
  desbloqueado:boolean;
  linkExpirado:boolean;
};
type Perfil={nome:string|null;logo:string|null;cor:string|null};
type Pasta={id:string;titulo:string;ordem:number;etapa:string;thumbnailUrl:string|null};
type Payload={projeto:ProjetoPublico;perfil:Perfil;pastas:Pasta[]};

export default function ProjetoClientePage(){
  const routeRef=useParams().slug as string;
  const[dados,setDados]=useState<Payload|null>(null);
  const[carregando,setCarregando]=useState(true);
  const[erro,setErro]=useState("");
  const[senha,setSenha]=useState("");
  const[senhaErro,setSenhaErro]=useState("");
  const[validando,setValidando]=useState(false);
  const[pastaAtiva,setPastaAtiva]=useState("");
  const scrollPastas=useRef<Map<string,number>>(new Map());

  async function carregar(){
    setCarregando(true);setErro("");
    try{
      const r=await fetch(`/api/projeto/publico?ref=${encodeURIComponent(routeRef)}`,{cache:"no-store"});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||"Não foi possível abrir o projeto.");
      const payload=d as Payload;
      setDados(payload);
      const query=new URLSearchParams(window.location.search);
      const solicitada=query.get("pasta");
      const ativa=payload.pastas.some(p=>p.id===solicitada)?solicitada!:"";
      setPastaAtiva(ativa);
      if(payload.projeto.publicRef&&window.location.pathname!==`/p/${payload.projeto.publicRef}`){
        if(ativa)query.set("pasta",ativa);else query.delete("pasta");
        window.history.replaceState(window.history.state,"",`/p/${payload.projeto.publicRef}${query.toString()?`?${query.toString()}`:""}`);
      }
    }catch(e){setErro(e instanceof Error?e.message:"Projeto indisponível.")}
    finally{setCarregando(false)}
  }

  useEffect(()=>{void carregar()},[routeRef]);

  useEffect(()=>{
    if(!dados)return;
    if(!pastaAtiva){
      const primeira=dados.pastas[0]?.id;
      if(primeira)void loadGalleryGrid(primeira);
      return;
    }
    const indice=dados.pastas.findIndex(p=>p.id===pastaAtiva);
    const vizinhas=[dados.pastas[indice-1]?.id,dados.pastas[indice+1]?.id].filter(Boolean) as string[];
    for(const id of vizinhas)void loadGalleryGrid(id);
    const y=scrollPastas.current.get(pastaAtiva)??0;
    const frame=window.requestAnimationFrame(()=>window.scrollTo({top:y,behavior:"auto"}));
    return()=>{
      window.cancelAnimationFrame(frame);
      scrollPastas.current.set(pastaAtiva,window.scrollY);
    };
  },[dados,pastaAtiva]);

  async function entrar(){
    if(!dados||!senha.trim()||validando)return;
    setValidando(true);setSenhaErro("");
    try{
      const r=await fetch("/api/projeto/acesso",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({projeto:dados.projeto.id,senha})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok){setSenhaErro(d.error||"Senha incorreta.");return}
      setSenha("");
      await carregar();
    }finally{setValidando(false)}
  }

  function trocarPasta(id:string){
    if(!dados||id===pastaAtiva)return;
    if(id)void loadGalleryGrid(id);
    setPastaAtiva(id);
    const q=new URLSearchParams();
    if(id)q.set("pasta",id);
    window.history.replaceState(window.history.state,"",`/p/${dados.projeto.publicRef}${q.toString()?`?${q.toString()}`:""}`);
  }

  const context=useMemo<ProjectClientContext|null>(()=>{
    if(!dados||!pastaAtiva)return null;
    return{
      id:dados.projeto.id,
      nome:dados.projeto.nome,
      descricao:dados.projeto.descricao,
      capaUrl:dados.projeto.capaUrl,
      studioName:dados.perfil.nome,
      heroColor:dados.perfil.cor||"#F0EDF7",
      publicUrl:typeof window==="undefined"?"":`${window.location.origin}/p/${dados.projeto.publicRef}`,
      pastas:dados.pastas.map(p=>({id:p.id,titulo:p.titulo})),
      pastaAtivaId:pastaAtiva,
      onFolderChange:trocarPasta,
    };
  },[dados,pastaAtiva]);

  if(carregando)return <Estado texto="Carregando projeto…"/>;
  if(erro||!dados)return <Estado texto={erro||"Projeto indisponível."}/>;
  if(dados.projeto.linkExpirado)return <Estado titulo="Este link expirou" texto="O prazo de acesso a este projeto terminou. Entre em contato com o fotógrafo para reabri-lo."/>;
  if(dados.projeto.temSenha&&!dados.projeto.desbloqueado)return <div className="pc-gate"><style>{css}</style><div className="pc-gate-card">{dados.perfil.logo&&<img className="pc-logo" src={dados.perfil.logo} alt=""/>}<span>PROJETO PROTEGIDO</span><h1>{dados.projeto.nome}</h1><p>Digite a senha enviada pelo fotógrafo para acessar todas as galerias deste projeto.</p><input type="password" value={senha} onChange={e=>{setSenha(e.target.value);setSenhaErro("")}} onKeyDown={e=>{if(e.key==="Enter")void entrar()}} autoFocus placeholder="Senha"/>{senhaErro&&<div className="pc-error">{senhaErro}</div>}<button onClick={()=>void entrar()} disabled={validando}>{validando?"Verificando…":"Entrar"}</button><small>Feito com <b>Fotura</b></small></div></div>;
  if(!dados.pastas.length)return <Estado titulo={dados.projeto.nome} texto="Este projeto ainda não possui galerias de fotos publicadas."/>;
  if(!pastaAtiva)return <ProjetoHome dados={dados} onOpen={trocarPasta} onPrefetch={id=>void loadGalleryGrid(id)}/>;
  if(!context)return <Estado texto="Preparando projeto…"/>;

  return <GaleriaClienteView key={pastaAtiva} routeRefOverride={pastaAtiva} projectContext={context}/>;
}

function ProjetoHome({dados,onOpen,onPrefetch}:{dados:Payload;onOpen:(id:string)=>void;onPrefetch:(id:string)=>void}){
  const cor=dados.perfil.cor||"#F0EDF7";
  const statusGaleria=(etapa:string)=>etapa==="entrega"?"Entrega disponível":etapa==="preparando_entrega"?"Em preparação":etapa==="selecao_finalizada"?"Seleção concluída":"Galeria";
  return <div className="pc-home"><style>{css}</style><PublicProjectHero color={cor} imageUrl={dados.projeto.capaUrl} studioName={dados.perfil.nome} title={dados.projeto.nome} description={dados.projeto.descricao}/><main className="pc-home-main"><div className="pc-home-head"><div className="pc-home-strip-identity">{dados.perfil.logo&&<img className="pc-strip-logo" src={dados.perfil.logo} alt={dados.perfil.nome||"Logo do fotógrafo"}/>}<div><span>{dados.perfil.nome||"GALERIAS DO PROJETO"}</span><h2>Escolha uma galeria</h2><p>Navegue pelos diferentes momentos deste projeto.</p></div></div><small>{dados.pastas.length} {dados.pastas.length===1?"galeria":"galerias"}</small></div><div className={"pc-galleries"+(dados.pastas.length===1?" single":"")}>{dados.pastas.map((p,i)=><button className="pc-gallery-card" key={p.id} onPointerEnter={()=>onPrefetch(p.id)} onFocus={()=>onPrefetch(p.id)} onTouchStart={()=>onPrefetch(p.id)} onClick={()=>onOpen(p.id)} aria-label={`Abrir galeria ${p.titulo}`}><div className="pc-gallery-thumb">{p.thumbnailUrl?<img src={p.thumbnailUrl} alt="" loading="lazy" draggable={false}/>:<div className="pc-gallery-placeholder"><span>{String(i+1).padStart(2,"0")}</span><b>{dados.projeto.nome}</b></div>}<div className="pc-gallery-shade"/><span className="pc-gallery-status">{statusGaleria(p.etapa)}</span><span className="pc-gallery-index">{String(i+1).padStart(2,"0")}</span></div><div className="pc-gallery-copy"><div><strong>{p.titulo}</strong><span>Ver galeria</span></div><i aria-hidden="true"><ArrowRightIcon size={15}/></i></div></button>)}</div><div className="pc-home-footer">Feito com <b>Fotura</b></div></main></div>
}

function Estado({titulo,texto}:{titulo?:string;texto:string}){
  return <div className="pc-state"><style>{css}</style><div><h1>{titulo||"Fotura"}</h1><p>{texto}</p><small>Feito com <b>Fotura</b></small></div></div>
}

const css=`
.pc-home-strip-identity{display:flex;align-items:center;gap:18px;min-width:0}.pc-strip-logo{width:56px;height:56px;flex:none;object-fit:contain;border-radius:14px;border:1px solid #ddd6eb;background:#fff}.pc-home-strip-identity>div{min-width:0}

.pc-home{min-height:100vh;background:linear-gradient(180deg,var(--ft-bg-start),var(--ft-bg-end));color:var(--ft-text)}.pc-home-hero{position:relative;overflow:hidden;background:var(--ft-bg-start)}.pc-home-hero-bg{position:absolute;inset:0;background-size:cover;background-position:center}.pc-home-hero-bg:after{content:"";position:absolute;inset:0;background:rgba(7,7,16,.58)}.pc-home-hero-wrap{position:relative;max-width:1120px;min-height:40vh;margin:auto;padding:58px 32px;display:flex;align-items:center;gap:52px}.pc-home-brand{min-width:260px;text-align:center;color:#fff}.pc-home-brand img{max-height:160px;max-width:280px;object-fit:contain}.pc-home-brand strong{font-size:46px;font-weight:800}.pc-home-info{flex:1;color:#fff}.pc-home-info>div{opacity:.72}.pc-home-info h1{margin:12px 0;font-size:clamp(30px,5vw,58px);font-weight:500;letter-spacing:-.035em}.pc-home-info p{max-width:620px;margin:0;font-size:12px;line-height:1.55;opacity:.82}.pc-home-main{max-width:1080px;margin:0 auto;padding:44px clamp(16px,4vw,44px) 64px}.pc-home-head{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-bottom:22px}.pc-home-head>div{max-width:620px}.pc-home-head span{display:block;color:#6f76a0;font-size:var(--ft-font-xs);font-weight:800;letter-spacing:1.8px}.pc-home-head h2{margin:6px 0 5px;font-size:26px;letter-spacing:-.45px}.pc-home-head p{margin:0;color:#797d91;font-size:var(--ft-font-sm);line-height:1.55}.pc-home-head small{flex:none;padding:6px 9px;border:1px solid #D8D1E7;border-radius:999px;background:rgba(250,248,253,.72);color:#74788d;font-size:var(--ft-font-xs);font-weight:700}.pc-galleries{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.pc-galleries.single{max-width:520px}.pc-gallery-card{display:block;min-width:0;padding:0;border:1px solid #D9D2E7;border-radius:16px;overflow:hidden;background:var(--ft-surface);color:#272C42;text-align:left;cursor:pointer;box-shadow:0 7px 22px rgba(57,46,91,.035);transition:transform .2s,border-color .2s,box-shadow .2s}.pc-gallery-card:hover{transform:translateY(-3px);border-color:#C5BADD;box-shadow:0 15px 34px rgba(57,46,91,.08)}.pc-gallery-card:focus-visible{outline:2px solid #8E7BC4;outline-offset:3px}.pc-gallery-thumb{position:relative;aspect-ratio:16/9;overflow:hidden;background:linear-gradient(145deg,#E9E3F1,#DCD5E8)}.pc-gallery-thumb>img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .45s ease}.pc-gallery-card:hover .pc-gallery-thumb>img{transform:scale(1.025)}.pc-gallery-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(12,12,25,.03),rgba(12,12,25,.24))}.pc-gallery-placeholder{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#77718E}.pc-gallery-placeholder span{font-size:10px;font-weight:800;letter-spacing:1.6px}.pc-gallery-placeholder b{max-width:75%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.pc-gallery-status,.pc-gallery-index{position:absolute;top:12px;z-index:2;display:inline-flex;align-items:center;min-height:25px;box-sizing:border-box;border:1px solid rgba(255,255,255,.34);border-radius:999px;background:rgba(20,20,35,.46);color:#fff;font-size:var(--ft-font-xs);font-weight:800;backdrop-filter:blur(10px)}.pc-gallery-status{left:12px;padding:0 9px}.pc-gallery-index{right:12px;padding:0 8px;letter-spacing:.08em}.pc-gallery-copy{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 15px 15px}.pc-gallery-copy>div{min-width:0}.pc-gallery-copy strong,.pc-gallery-copy span{display:block}.pc-gallery-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;letter-spacing:-.15px}.pc-gallery-copy span{margin-top:4px;color:#7F8396;font-size:var(--ft-font-xs);font-weight:600}.pc-gallery-copy i{flex:none;width:30px;height:30px;display:grid;place-items:center;border:1px solid #DDD6E9;border-radius:50%;background:#F1EDF7;color:#675F8B;font-style:normal;font-size:13px;transition:transform .18s,background .18s}.pc-gallery-card:hover .pc-gallery-copy i{transform:translateX(2px);background:#E9E3F4}.pc-gallery-card:focus-visible{outline:3px solid #7868b6;outline-offset:3px}.pc-gallery-card{content-visibility:auto;contain-intrinsic-size:420px}.pc-home-footer{text-align:center;margin-top:32px;color:#8A8D9E;font-size:var(--ft-font-xs)}@media(min-width:721px){.pc-home-hero-wrap{min-height:min(68vh,760px);box-sizing:border-box}}@media(max-width:720px){.pc-home-hero-wrap{min-height:34vh;padding:44px 20px;flex-direction:column;text-align:center;gap:22px}.pc-home-brand{min-width:0}.pc-home-brand img{max-height:110px;max-width:210px}.pc-home-info h1{font-size:clamp(30px,9vw,46px)}.pc-home-main{padding-top:30px}.pc-home-head{align-items:flex-start}.pc-home-head h2{font-size:22px}.pc-galleries{grid-template-columns:1fr}.pc-galleries.single{max-width:none}}@media(max-width:430px){.pc-home-head{gap:12px}.pc-home-strip-identity{align-items:flex-start}.pc-strip-logo{width:48px;height:48px;border-radius:var(--ft-radius-card)}.pc-home-head small{display:none}.pc-gallery-card{border-radius:var(--ft-radius-card)}.pc-gallery-copy{padding:12px 13px 13px}.pc-gallery-copy strong{font-size:14px}.pc-gallery-copy i{width:34px;height:34px}.pc-gallery-status,.pc-gallery-index{top:9px}.pc-gallery-status{left:9px}.pc-gallery-index{right:9px}}
.pc-state,.pc-gate{min-height:100vh;display:grid;place-items:center;padding:22px;box-sizing:border-box;background:linear-gradient(180deg,var(--ft-bg-start),var(--ft-bg-end));color:var(--ft-text)}
.pc-state>div,.pc-gate-card{width:min(410px,100%);box-sizing:border-box;padding:32px 28px;text-align:center;border:1px solid var(--ft-border-soft);border-radius:var(--ft-radius-panel);background:var(--ft-surface);box-shadow:0 18px 50px rgba(65,52,111,.07)}
.pc-state h1,.pc-gate-card h1{margin:7px 0 9px;font-size:25px;letter-spacing:-.5px}.pc-state p,.pc-gate-card p{margin:0;color:#767B91;font-size:12px;line-height:1.6}.pc-state small,.pc-gate-card small{display:block;margin-top:20px;color:#85899C;font-size:10px}.pc-gate-card>span{display:block;color:#6B5BAE;font-size:var(--ft-font-xs);font-weight:800;letter-spacing:1.6px}.pc-logo{display:block;max-width:130px;max-height:72px;object-fit:contain;margin:0 auto 17px}.pc-gate-card input{width:100%;height:43px;box-sizing:border-box;margin-top:18px;padding:0 12px;border:1px solid var(--ft-border);border-radius:10px;background:var(--ft-surface-muted);color:var(--ft-text);text-align:center;outline:none}.pc-gate-card input:focus{border-color:#BFB4D7;background:var(--ft-surface-soft)}.pc-gate-card button{width:100%;height:43px;margin-top:10px;border:0;border-radius:10px;background:linear-gradient(90deg,var(--ft-brand-blue),var(--ft-brand-purple));color:#fff;font-weight:800;cursor:pointer}.pc-gate-card button:disabled{opacity:.6}.pc-error{margin-top:9px;color:var(--ft-danger);font-size:var(--ft-font-sm)}
`;
