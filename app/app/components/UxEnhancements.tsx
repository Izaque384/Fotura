"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "../../lib/supabase-client";
import { desinscreverPush, definirPreferenciaPush, inscreverPush, notificacoesPushAtivadas } from "../../lib/push-client";

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
    if(pathname!=="/dashboard/galerias")return;
    const aplicar=()=>{
      const toolbar=document.querySelector(".dash-body .card .toolbar");
      const busca=toolbar?.querySelector("input.input") as HTMLInputElement|null;
      if(busca)busca.classList.add("ux-gallery-search");
      document.querySelectorAll(".dash-body .row").forEach(row=>{
        if(row.querySelector(".ux-mode"))return;
        const info=row.children.item(1) as HTMLElement|null;
        const nome=info?.querySelector(".name");
        const meta=info?.querySelector(".meta")?.textContent?.toLowerCase()??"";
        if(!nome)return;
        const badge=document.createElement("span");
        badge.className="ux-mode "+(meta.includes("modo prova")?"proof":"delivery");
        badge.textContent=meta.includes("modo prova")?"Prova":"Entrega";
        nome.appendChild(badge);
      });
    };
    aplicar();
    const obs=new MutationObserver(aplicar);obs.observe(document.body,{childList:true,subtree:true});
    return()=>obs.disconnect();
  },[pathname]);

  useEffect(()=>{
    if(pathname!=="/dashboard/clientes")return;
    const aplicar=()=>document.querySelectorAll(".client-card").forEach(card=>{
      const main=card.querySelector(".client-main");
      const contact=card.querySelector(".contact-line");
      if(!main||!contact||contact.classList.contains("ux-contact-lower"))return;
      contact.classList.add("ux-contact-lower");
      main.insertAdjacentElement("afterend",contact);
    });
    aplicar();const obs=new MutationObserver(aplicar);obs.observe(document.body,{childList:true,subtree:true});return()=>obs.disconnect();
  },[pathname]);

  useEffect(()=>{
    if(pathname!=="/dashboard")return;
    let cancelado=false;
    void(async()=>{
      const supabase=createClient();
      const {data:auth}=await supabase.auth.getUser();if(!auth.user||cancelado)return;
      const uid=auth.user.id;
      const {data:rows}=await supabase.from("galerias").select("id,titulo,capa,criado_em").eq("user_id",uid).order("criado_em",{ascending:false}).limit(4);
      if(!rows?.length||cancelado)return;
      const itens=await Promise.all(rows.map(async g=>{
        let nome=(g.capa as string|null)??null;
        if(!nome){const{data}=await supabase.storage.from("fotos").list(`${uid}/${g.id}`,{limit:1,sortBy:{column:"created_at",order:"asc"}});nome=(data??[]).find(f=>f.id!==null)?.name??null}
        if(!nome)return{titulo:g.titulo as string,url:""};
        const caminhos=[`${uid}/${g.id}/thumbs/${nome}`,`${uid}/${g.id}/${nome}`];
        const{data:signed}=await supabase.storage.from("fotos").createSignedUrls(caminhos,3600);
        const url=signed?.find(x=>x.path===caminhos[0])?.signedUrl||signed?.find(x=>x.path===caminhos[1])?.signedUrl||"";
        return{titulo:g.titulo as string,url};
      }));
      if(cancelado)return;
      const aplicar=()=>{
        const card=[...document.querySelectorAll(".lists .card")].find(c=>c.querySelector(".card-t")?.textContent?.includes("Últimas galerias"));
        if(!card)return false;
        const rowsDom=[...card.querySelectorAll(".list-row")];
        rowsDom.forEach((row,i)=>{const item=itens[i];if(!item?.url||row.querySelector(".ux-dash-cover"))return;const img=document.createElement("img");img.className="ux-dash-cover";img.src=item.url;img.alt="";row.prepend(img)});return true;
      };
      if(!aplicar()){const obs=new MutationObserver(()=>{if(aplicar())obs.disconnect()});obs.observe(document.body,{childList:true,subtree:true});setTimeout(()=>obs.disconnect(),5000)}
    })();
    return()=>{cancelado=true};
  },[pathname]);

  useEffect(()=>{
    if(pathname!=="/configuracoes")return;
    let ocupado=false;
    const secao=()=>[...document.querySelectorAll("section.card")].find(s=>s.querySelector(".title")?.textContent?.trim()==="Notificações") as HTMLElement|undefined;
    const atualizar=()=>{
      const s=secao();if(!s)return;
      const b=s.querySelector("button") as HTMLButtonElement|null;const v=s.querySelector(".value") as HTMLElement|null;if(!b)return;
      const ativa=notificacoesPushAtivadas()&&typeof Notification!=="undefined"&&Notification.permission==="granted";
      b.disabled=ocupado||typeof Notification==="undefined";
      b.textContent=ocupado?"Salvando…":ativa?"Desativar":"Ativar";
      b.classList.toggle("ux-notif-off",ativa);
      if(v)v.textContent=ativa?"Ativas neste navegador":"Desativadas neste navegador";
    };
    const onClick=async(e:Event)=>{
      const s=secao();const b=s?.querySelector("button");if(!s||!b||e.target!==b||ocupado)return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();ocupado=true;atualizar();
      const supabase=createClient();const{data}=await supabase.auth.getUser();if(!data.user){ocupado=false;atualizar();return}
      const ativa=notificacoesPushAtivadas()&&typeof Notification!=="undefined"&&Notification.permission==="granted";
      if(ativa)await desinscreverPush(data.user.id);else{definirPreferenciaPush(true);const ok=await inscreverPush(data.user.id);if(!ok&&Notification.permission!=="granted")definirPreferenciaPush(false)}
      ocupado=false;atualizar();
    };
    const id=setInterval(atualizar,250);document.addEventListener("click",onClick,true);atualizar();
    return()=>{clearInterval(id);document.removeEventListener("click",onClick,true)};
  },[pathname]);

  return <style>{`
    .ux-gallery-search{min-width:360px!important;width:360px!important}
    .ux-mode{display:inline-flex;align-items:center;margin-left:9px;padding:3px 7px;border-radius:999px;font-size:9px;font-weight:700;vertical-align:2px;letter-spacing:.2px}
    .ux-mode.proof{color:#aebaff;background:rgba(93,109,250,.14);border:1px solid rgba(93,109,250,.28)}
    .ux-mode.delivery{color:#9fe0ba;background:rgba(83,201,139,.10);border:1px solid rgba(83,201,139,.22)}
    .client-card .name{font-size:16px!important;font-weight:720!important;letter-spacing:-.15px}.ux-contact-lower{margin:13px 0 0 61px!important;padding-top:10px;border-top:1px solid #202238}.ux-contact-lower .contact-chip{font-size:11px!important;padding:6px 9px!important}
    .ux-dash-cover{width:48px;height:40px;object-fit:cover;border-radius:8px;flex:0 0 auto;border:1px solid #282a42;background:#0d0d1b}.lists .card:last-child .list-row{gap:11px}.lists .card:last-child .list-row>div{flex:1;min-width:0}
    .ux-notif-off{background:#17172d!important;border:1px solid #343750!important;color:#cfd5ea!important}
    @media(max-width:640px){.ux-gallery-search{min-width:100%!important;width:100%!important}.ux-contact-lower{margin-left:0!important}.ux-dash-cover{width:44px;height:38px}}
  `}</style>;
}
