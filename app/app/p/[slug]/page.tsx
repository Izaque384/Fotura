"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { GaleriaClienteView, type ProjectClientContext } from "../../g/[slug]/page";

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
type Pasta={id:string;titulo:string;ordem:number;etapa:string};
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
      const ativa=payload.pastas.some(p=>p.id===solicitada)?solicitada!:payload.pastas[0]?.id||"";
      setPastaAtiva(ativa);
      if(payload.projeto.publicRef&&window.location.pathname!==`/p/${payload.projeto.publicRef}`){
        if(ativa)query.set("pasta",ativa);
        window.history.replaceState(window.history.state,"",`/p/${payload.projeto.publicRef}${query.toString()?`?${query.toString()}`:""}`);
      }
    }catch(e){setErro(e instanceof Error?e.message:"Projeto indisponível.")}
    finally{setCarregando(false)}
  }

  useEffect(()=>{void carregar()},[routeRef]);

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
    setPastaAtiva(id);
    const q=new URLSearchParams();
    q.set("pasta",id);
    window.history.replaceState(window.history.state,"",`/p/${dados.projeto.publicRef}?${q.toString()}`);
  }

  const context=useMemo<ProjectClientContext|null>(()=>{
    if(!dados||!pastaAtiva)return null;
    return{
      id:dados.projeto.id,
      nome:dados.projeto.nome,
      capaUrl:dados.projeto.capaUrl,
      publicUrl:`${window.location.origin}/p/${dados.projeto.publicRef}`,
      pastas:dados.pastas.map(p=>({id:p.id,titulo:p.titulo})),
      pastaAtivaId:pastaAtiva,
      onFolderChange:trocarPasta,
    };
  },[dados,pastaAtiva]);

  if(carregando)return <Estado texto="Carregando projeto…"/>;
  if(erro||!dados)return <Estado texto={erro||"Projeto indisponível."}/>;
  if(dados.projeto.linkExpirado)return <Estado titulo="Este link expirou" texto="O prazo de acesso a este projeto terminou. Entre em contato com o fotógrafo para reabri-lo."/>;
  if(dados.projeto.temSenha&&!dados.projeto.desbloqueado)return <div className="pc-gate"><style>{css}</style><div className="pc-gate-card">{dados.perfil.logo&&<img className="pc-logo" src={dados.perfil.logo} alt=""/>}<span>PROJETO PROTEGIDO</span><h1>{dados.projeto.nome}</h1><p>Digite a senha enviada pelo fotógrafo para acessar todas as pastas deste projeto.</p><input type="password" value={senha} onChange={e=>{setSenha(e.target.value);setSenhaErro("")}} onKeyDown={e=>{if(e.key==="Enter")void entrar()}} autoFocus placeholder="Senha"/>{senhaErro&&<div className="pc-error">{senhaErro}</div>}<button onClick={()=>void entrar()} disabled={validando}>{validando?"Verificando…":"Entrar"}</button><small>Feito com <b>Fotura</b></small></div></div>;
  if(!dados.pastas.length)return <Estado titulo={dados.projeto.nome} texto="Este projeto ainda não possui pastas de fotos publicadas."/>;
  if(!context)return <Estado texto="Preparando projeto…"/>;

  return <GaleriaClienteView key={pastaAtiva} routeRefOverride={pastaAtiva} projectContext={context}/>;
}

function Estado({titulo,texto}:{titulo?:string;texto:string}){
  return <div className="pc-state"><style>{css}</style><div><h1>{titulo||"Fotura"}</h1><p>{texto}</p><small>Feito com <b>Fotura</b></small></div></div>
}

const css=`
.pc-state,.pc-gate{min-height:100vh;display:grid;place-items:center;padding:22px;box-sizing:border-box;background:linear-gradient(180deg,#F0EDF7,#ECE8F4);color:#21253A}
.pc-state>div,.pc-gate-card{width:min(410px,100%);box-sizing:border-box;padding:32px 28px;text-align:center;border:1px solid #DCD6EE;border-radius:18px;background:#FAF8FD;box-shadow:0 18px 50px rgba(65,52,111,.07)}
.pc-state h1,.pc-gate-card h1{margin:7px 0 9px;font-size:25px;letter-spacing:-.5px}.pc-state p,.pc-gate-card p{margin:0;color:#767B91;font-size:12px;line-height:1.6}.pc-state small,.pc-gate-card small{display:block;margin-top:20px;color:#85899C;font-size:10px}.pc-gate-card>span{display:block;color:#6B5BAE;font-size:9px;font-weight:800;letter-spacing:1.6px}.pc-logo{display:block;max-width:130px;max-height:72px;object-fit:contain;margin:0 auto 17px}.pc-gate-card input{width:100%;height:43px;box-sizing:border-box;margin-top:18px;padding:0 12px;border:1px solid #D7D0E7;border-radius:10px;background:#F3EFF9;color:#21253A;text-align:center;outline:none}.pc-gate-card input:focus{border-color:#BFB4D7;background:#F7F4FB}.pc-gate-card button{width:100%;height:43px;margin-top:10px;border:0;border-radius:10px;background:linear-gradient(90deg,#1196fc,#5d0dfa);color:#fff;font-weight:800;cursor:pointer}.pc-gate-card button:disabled{opacity:.6}.pc-error{margin-top:9px;color:#B95C66;font-size:11px}
`;
