"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "../../lib/supabase-client";
import { desinscreverPush, definirPreferenciaPush, inscreverPush, notificacoesPushAtivadas } from "../../lib/push-client";

type GalleryVisual={id:string;titulo:string;prova:boolean;url:string};

async function carregarVisuaisGalerias():Promise<GalleryVisual[]>{
  const supabase=createClient();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)return[];
  const uid=auth.user.id;
  const [{data:rows},{data:resumos}]=await Promise.all([
    supabase.from("galerias").select("id,titulo,capa,prova,criado_em").eq("user_id",uid).order("criado_em",{ascending:false}),
    supabase.rpc("resumo_storage_galerias")
  ]);
  const resumo=new Map(((resumos??[]) as {galeria_id:string;arquivo_capa:string|null}[]).map(r=>[r.galeria_id,r.arquivo_capa]));
  const bases=(rows??[]).map(g=>({id:g.id as string,titulo:(g.titulo as string)||"Galeria",prova:Boolean(g.prova),nome:(g.capa as string|null)||resumo.get(g.id as string)||null}));
  const caminhos=bases.filter(x=>x.nome).flatMap(x=>[`${uid}/${x.id}/thumbs/${x.nome}`,`${uid}/${x.id}/${x.nome}`]);
  const mapa=new Map<string,string>();
  for(let i=0;i<caminhos.length;i+=200){
    const {data}=await supabase.storage.from("fotos").createSignedUrls(caminhos.slice(i,i+200),3600);
    for(const u of data??[])if(u.path&&u.signedUrl)mapa.set(u.path as string,u.signedUrl as string);
  }
  return bases.map(x=>({id:x.id,titulo:x.titulo,prova:x.prova,url:x.nome?(mapa.get(`${uid}/${x.id}/thumbs/${x.nome}`)||mapa.get(`${uid}/${x.id}/${x.nome}`)||""):""}));
}

function acharPorTitulo(lista:GalleryVisual[],titulo:string){return lista.find(x=>x.titulo.trim()===titulo.trim())}
function aplicarModo(el:Element,prova:boolean){el.classList.toggle("ux-proof-card",prova);el.classList.toggle("ux-delivery-card",!prova)}
function criarCapa(url:string,classe="ux-gallery-cover"){
  const img=document.createElement("img");img.className=classe;img.src=url;img.alt="";img.loading="lazy";return img;
}

export default function UxEnhancements(){
  const pathname=usePathname();

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      const alvo=e.target as HTMLElement|null;
      if(!(alvo instanceof HTMLTextAreaElement)||!alvo.matches(".gc-com textarea"))return;
      if(e.key!=="Enter"||e.shiftKey)return;
      e.preventDefault();
      const botao=alvo.closest(".gc-com")?.querySelector("button") as HTMLButtonElement|null;
      if(botao&&!botao.disabled)botao.click();
    };
    document.addEventListener("keydown",onKey);
    return()=>document.removeEventListener("keydown",onKey);
  },[]);

  useEffect(()=>{
    const medir=(input:HTMLInputElement)=>{
      const texto=input.placeholder.trim();if(!texto||!texto.toLocaleLowerCase("pt-BR").includes("buscar"))return;
      input.classList.add("ux-search-input");
      const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");
      if(!ctx)return;
      const st=getComputedStyle(input);ctx.font=`${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
      const largura=Math.ceil(ctx.measureText(texto).width+48);
      input.style.width=`${largura}px`;input.style.minWidth=`${largura}px`;input.style.maxWidth="100%";
    };
    const aplicar=()=>document.querySelectorAll<HTMLInputElement>('input[placeholder]').forEach(medir);
    aplicar();const obs=new MutationObserver(aplicar);obs.observe(document.body,{childList:true,subtree:true});
    return()=>obs.disconnect();
  },[pathname]);

  useEffect(()=>{
    if(pathname!=="/dashboard/clientes")return;
    const aplicar=()=>document.querySelectorAll(".client-card").forEach(card=>{
      const main=card.querySelector(".client-main") as HTMLElement|null;
      const contact=card.querySelector(".contact-line") as HTMLElement|null;
      const actions=card.querySelector(".client-actions") as HTMLElement|null;
      if(!main||!contact||!actions)return;
      contact.querySelectorAll<HTMLElement>(".contact-chip").forEach((chip,i)=>{
        if(chip.dataset.uxLabel)return;chip.dataset.uxLabel="1";
        const valor=chip.textContent?.trim()||"";
        chip.textContent=`${i===0?"E-mail":"Telefone"}: ${valor}`;
      });
      let footer=card.querySelector(".ux-client-footer") as HTMLElement|null;
      if(!footer){footer=document.createElement("div");footer.className="ux-client-footer";card.appendChild(footer)}
      if(contact.parentElement!==footer)footer.appendChild(contact);
      if(actions.parentElement!==footer)footer.appendChild(actions);
    });
    aplicar();const obs=new MutationObserver(aplicar);obs.observe(document.body,{childList:true,subtree:true});return()=>obs.disconnect();
  },[pathname]);

  useEffect(()=>{
    if(pathname!=="/dashboard/galerias")return;
    let cancelado=false;let visuais:GalleryVisual[]=[];
    void carregarVisuaisGalerias().then(v=>{visuais=v;if(!cancelado)aplicar()});
    const aplicar=()=>{
      document.querySelectorAll(".dash-body .row").forEach(row=>{
        const titulo=row.querySelector(".name")?.childNodes[0]?.textContent?.trim()||row.querySelector(".name")?.textContent?.trim()||"";
        const item=acharPorTitulo(visuais,titulo);if(!item)return;
        aplicarModo(row,item.prova);
        const nome=row.querySelector(".name");
        if(nome&&!nome.querySelector(".ux-mode")){const b=document.createElement("span");b.className=`ux-mode ${item.prova?"proof":"delivery"}`;b.textContent=item.prova?"Prova":"Entrega";nome.appendChild(b)}
        const actions=row.querySelector(".actions");if(!actions)return;
        const botoes=[...actions.querySelectorAll("button")];const abrir=botoes[0] as HTMLButtonElement|undefined;const gerenciar=botoes[1] as HTMLButtonElement|undefined;
        if(abrir){abrir.textContent="Ver galeria";abrir.classList.add("ux-view-gallery")}
        let copiar=actions.querySelector(".ux-copy-link") as HTMLButtonElement|null;
        if(!copiar){copiar=document.createElement("button");copiar.className="act ux-copy-link";copiar.textContent="Copiar link";copiar.onclick=async()=>{try{await navigator.clipboard.writeText(`${location.origin}/g/${item.id}`);copiar!.textContent="Copiado";setTimeout(()=>{if(copiar)copiar.textContent="Copiar link"},1200)}catch{}};actions.insertBefore(copiar,gerenciar||null)}
        if(gerenciar){gerenciar.textContent="⋯";gerenciar.classList.add("ux-more");gerenciar.title="Mais opções";gerenciar.setAttribute("aria-label","Mais opções")}
      });
    };
    aplicar();const obs=new MutationObserver(aplicar);obs.observe(document.body,{childList:true,subtree:true});return()=>{cancelado=true;obs.disconnect()};
  },[pathname]);

  useEffect(()=>{
    if(pathname!=="/dashboard/selecoes")return;
    let cancelado=false;let visuais:GalleryVisual[]=[];
    const aplicar=()=>document.querySelectorAll(".sel-row").forEach(row=>{
      const titulo=row.querySelector(".sel-title")?.textContent?.trim()||"";const item=acharPorTitulo(visuais,titulo);if(!item)return;
      aplicarModo(row,true);
      const primeiro=row.firstElementChild as HTMLElement|null;if(!primeiro)return;
      primeiro.classList.add("ux-selection-main");
      if(item.url&&!row.querySelector(".ux-selection-cover")){primeiro.prepend(criarCapa(item.url,"ux-selection-cover"))}
      const title=row.querySelector(".sel-title");if(title&&!title.querySelector(".ux-mode")){const b=document.createElement("span");b.className="ux-mode proof";b.textContent="Prova";title.appendChild(b)}
    });
    void carregarVisuaisGalerias().then(v=>{visuais=v;if(!cancelado)aplicar()});
    aplicar();const obs=new MutationObserver(aplicar);obs.observe(document.body,{childList:true,subtree:true});return()=>{cancelado=true;obs.disconnect()};
  },[pathname]);

  useEffect(()=>{
    if(pathname!=="/dashboard")return;
    let cancelado=false;let visuais:GalleryVisual[]=[];
    const aplicar=()=>{
      const cards=[...document.querySelectorAll(".lists .card")];
      cards.forEach(card=>card.querySelectorAll(".list-row").forEach(row=>{
        const titulo=row.querySelector(".list-title")?.textContent?.trim()||"";const item=acharPorTitulo(visuais,titulo);if(!item)return;
        aplicarModo(row,item.prova);
        if(item.url&&!row.querySelector(".ux-dash-cover"))row.prepend(criarCapa(item.url,"ux-dash-cover"));
        const title=row.querySelector(".list-title");if(title&&!title.querySelector(".ux-mode")){const b=document.createElement("span");b.className=`ux-mode ${item.prova?"proof":"delivery"}`;b.textContent=item.prova?"Prova":"Entrega";title.appendChild(b)}
      }));
    };
    void carregarVisuaisGalerias().then(v=>{visuais=v;if(!cancelado)aplicar()});
    aplicar();const obs=new MutationObserver(aplicar);obs.observe(document.body,{childList:true,subtree:true});return()=>{cancelado=true;obs.disconnect()};
  },[pathname]);

  useEffect(()=>{
    if(pathname!=="/dashboard/clientes")return;
    const aplicar=()=>document.querySelectorAll(".pill").forEach(p=>{const t=p.textContent?.toLowerCase()||"";if(t.includes("entrega")){p.classList.add("ux-delivery-pill")}else{p.classList.add("ux-proof-pill")}});
    aplicar();const obs=new MutationObserver(aplicar);obs.observe(document.body,{childList:true,subtree:true});return()=>obs.disconnect();
  },[pathname]);

  useEffect(()=>{
    if(pathname!=="/configuracoes")return;
    let ocupado=false;
    const secao=()=>[...document.querySelectorAll("section.card")].find(s=>s.querySelector(".title")?.textContent?.trim()==="Notificações") as HTMLElement|undefined;
    const atualizar=()=>{
      const s=secao();if(!s)return;const b=s.querySelector("button") as HTMLButtonElement|null;const v=s.querySelector(".value") as HTMLElement|null;if(!b)return;
      const ativa=notificacoesPushAtivadas()&&typeof Notification!=="undefined"&&Notification.permission==="granted";
      b.disabled=ocupado||typeof Notification==="undefined";b.textContent=ocupado?"Salvando…":ativa?"Desativar":"Ativar";b.classList.toggle("ux-notif-off",ativa);if(v)v.textContent=ativa?"Ativas neste navegador":"Desativadas neste navegador";
    };
    const onClick=async(e:Event)=>{
      const s=secao();const b=s?.querySelector("button");if(!s||!b||e.target!==b||ocupado)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();ocupado=true;atualizar();
      const supabase=createClient();const{data}=await supabase.auth.getUser();if(!data.user){ocupado=false;atualizar();return}
      const ativa=notificacoesPushAtivadas()&&typeof Notification!=="undefined"&&Notification.permission==="granted";
      if(ativa)await desinscreverPush(data.user.id);else{definirPreferenciaPush(true);const ok=await inscreverPush(data.user.id);if(!ok&&Notification.permission!=="granted")definirPreferenciaPush(false)}
      ocupado=false;atualizar();
    };
    const id=setInterval(atualizar,250);document.addEventListener("click",onClick,true);atualizar();return()=>{clearInterval(id);document.removeEventListener("click",onClick,true)};
  },[pathname]);

  return <style>{`
    .ux-search-input{padding-left:34px!important;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%237a7f9a' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-4-4'/%3E%3C/svg%3E")!important;background-repeat:no-repeat!important;background-position:12px center!important;background-size:14px 14px!important}
    .ux-mode{display:inline-flex;align-items:center;margin-left:9px;padding:3px 7px;border-radius:999px;font-size:9px;font-weight:750;vertical-align:2px;letter-spacing:.2px}
    .ux-mode.proof{color:#ffc56c;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.38)}
    .ux-mode.delivery{color:#71c7ff;background:rgba(17,150,252,.12);border:1px solid rgba(17,150,252,.38)}
    .ux-proof-card{border-color:rgba(245,158,11,.68)!important;box-shadow:inset 0 0 0 1px rgba(245,158,11,.13)!important}
    .ux-delivery-card{border-color:rgba(17,150,252,.62)!important;box-shadow:inset 0 0 0 1px rgba(17,150,252,.12)!important}
    .client-card{padding-bottom:13px!important}.client-card .name{font-size:16px!important;font-weight:720!important;letter-spacing:-.15px}.ux-client-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 0 0 61px;padding-top:9px;border-top:1px solid #202238}.ux-client-footer .contact-line{margin:0!important;display:flex;align-items:center;gap:7px;min-width:0}.ux-client-footer .contact-chip{font-size:10px!important;padding:5px 8px!important}.ux-client-footer .client-actions{margin:0!important;justify-content:flex-end!important;flex:none}
    .ux-gallery-cover,.ux-dash-cover,.ux-selection-cover{object-fit:cover;border-radius:9px;flex:0 0 auto;border:1px solid #282a42;background:#0d0d1b}.ux-dash-cover{width:48px;height:40px}.ux-selection-cover{width:58px;height:48px;margin-right:12px}.ux-selection-main{display:flex;align-items:center;min-width:0}.ux-selection-main>div:not(.ux-selection-cover){min-width:0}.lists .list-row{gap:11px}.lists .list-row>div{flex:1;min-width:0}.lists .list-row.ux-proof-card,.lists .list-row.ux-delivery-card{padding-left:10px!important;padding-right:10px!important;border-style:solid!important;border-width:1px!important;border-radius:10px!important;margin:4px 0!important}
    .ux-view-gallery{border-color:transparent!important;background:transparent!important;font-weight:750!important;background-image:linear-gradient(90deg,#1196fc,#5d0dfa)!important;background-clip:text!important;-webkit-background-clip:text!important;color:transparent!important;padding-left:7px!important;padding-right:7px!important}.ux-copy-link{white-space:nowrap}.ux-more{width:34px!important;min-width:34px!important;padding:6px 0!important;font-size:20px!important;line-height:1!important;letter-spacing:2px}.ux-notif-off{background:#17172d!important;border:1px solid #343750!important;color:#cfd5ea!important}
    .ux-delivery-pill{border-color:rgba(17,150,252,.48)!important;color:#71c7ff!important}.ux-proof-pill{border-color:rgba(245,158,11,.48)!important;color:#ffc56c!important}
    @media(max-width:640px){.ux-client-footer{margin-left:0;align-items:flex-start;flex-direction:column}.ux-client-footer .client-actions{justify-content:flex-start!important}.ux-dash-cover{width:44px;height:38px}.ux-selection-cover{width:52px;height:44px}.ux-search-input{max-width:100%!important}.ux-view-gallery,.ux-copy-link{font-size:10px!important}}
  `}</style>;
}
