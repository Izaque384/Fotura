"use client";
import {useEffect} from "react";

type Pasta={id:string;titulo:string;visivel:boolean;etapa:string;qtd:number};
type Props={
 aberto:boolean;fechar:()=>void;nome:string;url:string;cliente:string|null;
 protegido:boolean;linkAte:string|null;prova:boolean;downloadAtivo:boolean;
 downloadIndividual:boolean;downloadCompleto:boolean;downloadTamanho:"web"|"original";
 downloadPin:boolean;pastas:Pasta[];copiar:()=>void;configurar:()=>void;
};
export default function ProjectShareCenter(p:Props){
 useEffect(()=>{if(!p.aberto)return;const f=(e:KeyboardEvent)=>{if(e.key==="Escape")p.fechar()};window.addEventListener("keydown",f);return()=>window.removeEventListener("keydown",f)},[p.aberto,p.fechar]);
 if(!p.aberto)return null;
 const publicadas=p.pastas.filter(x=>x.visivel),vazias=publicadas.filter(x=>x.qtd===0);
 const expirado=!!p.linkAte && new Date(p.linkAte+"T23:59:59").getTime()<Date.now();
 const pronto=!!p.url && publicadas.some(x=>x.qtd>0) && !expirado;
 const mensagem=`Suas fotos estão no Fotura: ${p.url}${p.protegido?"\\nO projeto é protegido por senha.":""}${p.downloadPin?"\\nO download exige o PIN fornecido separadamente.":""}`;
 const whatsapp="https://wa.me/?text="+encodeURIComponent(mensagem);
 const email="mailto:?subject="+encodeURIComponent(p.nome)+"&body="+encodeURIComponent(mensagem);
 return <div className="ft-share-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)p.fechar()}} role="presentation">
   <section className="ft-share-card" role="dialog" aria-modal="true" aria-label="Revisar e compartilhar projeto">
    <header><div><small>REVISÃO DE ENTREGA</small><h2>Compartilhar projeto</h2><p>Confira como o cliente acessará <strong>{p.nome}</strong>.</p></div><button onClick={p.fechar} type="button" aria-label="Fechar">✕</button></header>
    <div className="ft-share-ready"><strong>{pronto?"Tudo pronto para compartilhar":"Revise antes de compartilhar"}</strong><span>{pronto?"O link reúne as pastas publicadas e os controles de acesso.":"Publique ao menos uma pasta com fotos e confirme a validade do link."}</span></div>
    <div className="ft-share-details">
      <div><span>CLIENTE</span><b>{p.cliente||"Sem cliente vinculado"}</b></div>
      <div><span>ACESSO</span><b>{p.protegido?"Com senha":"Pelo link"}</b></div>
      <div><span>VALIDADE</span><b>{p.linkAte?new Date(p.linkAte+"T12:00:00").toLocaleDateString("pt-BR"):"Sem prazo"}</b></div>
      <div><span>DOWNLOADS</span><b>{p.downloadAtivo?`${p.downloadTamanho==="original"?"Originais":"Web"} · ${p.downloadCompleto?"pasta completa":p.downloadIndividual?"individuais":"desativados"}`:"Desativados"}</b></div>
      <div><span>SELEÇÃO</span><b>{p.prova?"Ativada":"Entrega direta"}</b></div>
      <div><span>PIN DE DOWNLOAD</span><b>{p.downloadPin?"Configurado":"Não configurado"}</b></div>
    </div>
    <div className="ft-share-folders"><strong>Pastas visíveis para o cliente ({publicadas.length})</strong><div>{p.pastas.map(x=><span key={x.id} className={!x.visivel?"muted":""}>{x.visivel?"✓":"—"} {x.titulo} · {x.qtd} foto{x.qtd===1?"":"s"}{!x.visivel?" · oculta":""}</span>)}</div></div>
    {expirado&&<p className="ft-share-warning">O link expirou. Atualize a validade nas configurações.</p>}
    {vazias.length>0&&<p className="ft-share-warning">{vazias.length} pasta(s) pública(s) ainda não têm fotos.</p>}
    {!p.downloadAtivo&&<p className="ft-share-note">Os downloads estão desativados. Você pode habilitá-los nas configurações.</p>}
    <label className="ft-share-link">LINK DO PROJETO<input value={p.url} readOnly onFocus={e=>e.currentTarget.select()}/></label>
    <div className="ft-share-actions"><button className="secondary" onClick={p.configurar}>Configurações</button><button className="secondary" disabled={!p.url} onClick={()=>window.open(p.url,"_blank","noopener,noreferrer")}>Ver como cliente</button><button className="primary" onClick={p.copiar} disabled={!pronto}>Copiar link</button></div>
    <div className="ft-share-channels"><a href={whatsapp} target="_blank" rel="noreferrer" aria-disabled={!pronto} onClick={e=>{if(!pronto)e.preventDefault()}}>WhatsApp ↗</a><a href={email} aria-disabled={!pronto} onClick={e=>{if(!pronto)e.preventDefault()}}>E-mail ↗</a></div>
   </section>
   <style>{`
.ft-share-backdrop{position:fixed;inset:0;z-index:140;display:grid;place-items:center;padding:18px;background:#151321aa;backdrop-filter:blur(5px);overflow-y:auto}
.ft-share-card{width:min(660px,100%);max-height:min(92vh,850px);overflow:auto;padding:22px;border:1px solid #ddd6ee;border-radius:20px;background:#fff;color:#24283e;box-shadow:0 25px 75px #15132155}
.ft-share-card header{display:flex;justify-content:space-between;gap:18px;margin-bottom:18px}.ft-share-card header small{font:800 10px inherit;letter-spacing:1px;color:#7366b2}.ft-share-card h2{margin:5px 0 4px;font-size:23px}.ft-share-card header p{margin:0;color:#797f97;font-size:12px}.ft-share-card header button{border:1px solid #ddd7e9;background:#f9f7fc;border-radius:50%;height:32px;width:32px;cursor:pointer}
.ft-share-ready{display:grid;gap:5px;padding:15px;border:1px solid #d9d1ef;border-radius:12px;background:#f3effc}.ft-share-ready strong{font-size:14px}.ft-share-ready span{font-size:12px;color:#666b80}
.ft-share-details{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:13px 0}.ft-share-details div{padding:12px;border:1px solid #e8e4f0;border-radius:10px}.ft-share-details span{display:block;font-size:9px;letter-spacing:.5px;color:#787f94}.ft-share-details b{display:block;font-size:12px;margin-top:5px;overflow-wrap:anywhere}
.ft-share-folders{padding:14px;border:1px solid #e5deef;border-radius:12px}.ft-share-folders>strong{font-size:12px}.ft-share-folders>div{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.ft-share-folders span{font-size:11px;padding:6px 9px;border-radius:7px;background:#eeeafb;color:#50459a}.ft-share-folders span.muted{background:#f2f1f3;color:#888}
.ft-share-warning{padding:9px 12px;border-radius:8px;background:#fff2e0;color:#945f14;font-size:11px}.ft-share-note{font-size:11px;color:#686f87}
.ft-share-link{display:block;margin-top:14px;color:#6b6e84;font-size:10px;font-weight:800}.ft-share-link input{box-sizing:border-box;width:100%;padding:12px;margin-top:6px;border:1px solid #ddd5e9;border-radius:10px;color:#3b4160;font-size:12px;background:#faf9fd}
.ft-share-actions,.ft-share-channels{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.ft-share-actions button,.ft-share-channels a{min-height:38px;padding:10px 14px;border-radius:10px;border:1px solid #d9d3e7;background:#fff;color:#514674;font:700 12px inherit;cursor:pointer;text-decoration:none}.ft-share-actions .primary{border:0;color:white;background:linear-gradient(90deg,#1594f7,#6615eb)}.ft-share-actions button:disabled,.ft-share-channels a[aria-disabled=true]{opacity:.45;cursor:default}.ft-share-channels{padding-top:12px;border-top:1px solid #eee8f4}.ft-share-channels a{background:#f7f4fc}
@media(max-width:640px){.ft-share-card{padding:16px}.ft-share-details{grid-template-columns:repeat(2,minmax(0,1fr))}.ft-share-actions button{flex:1}.ft-share-card h2{font-size:20px}}
   `}</style>
 </div>
}
