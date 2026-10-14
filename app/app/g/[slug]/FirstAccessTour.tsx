"use client";

import { useEffect, useState, type RefObject } from "react";
import { ChevronRightIcon } from "../../components/FoturaIcons";

type Rect={top:number;left:number;width:number;height:number};

export default function FirstAccessTour({
  open,step,selectorRef,menuRef,downloadRef,onNext,onClose,
}:{
  open:boolean;
  step:1|2;
  selectorRef:RefObject<HTMLLabelElement|null>;
  menuRef:RefObject<HTMLDetailsElement|null>;
  downloadRef:RefObject<HTMLButtonElement|null>;
  onNext:()=>void;
  onClose:()=>void;
}){
  const[rect,setRect]=useState<Rect|null>(null);

  useEffect(()=>{
    if(!open){setRect(null);return}
    let raf=0;
    const medir=()=>{
      if(step===2)menuRef.current?.setAttribute("open","");
      else menuRef.current?.removeAttribute("open");
      cancelAnimationFrame(raf);
      raf=requestAnimationFrame(()=>{
        const alvo=step===1?selectorRef.current:downloadRef.current;
        if(!alvo){setRect(null);return}
        const r=alvo.getBoundingClientRect();
        setRect({top:r.top,left:r.left,width:r.width,height:r.height});
      });
    };
    medir();
    window.addEventListener("resize",medir);
    window.addEventListener("scroll",medir,true);
    return()=>{
      cancelAnimationFrame(raf);
      window.removeEventListener("resize",medir);
      window.removeEventListener("scroll",medir,true);
    };
  },[open,step,selectorRef,menuRef,downloadRef]);

  if(!open)return null;
  return <div className="gc-tour" role="dialog" aria-modal="true" aria-label="Tutorial rápido" onPointerDown={e=>e.stopPropagation()}>
    {rect&&<div className="gc-tour-spotlight" style={{top:Math.max(6,rect.top-7),left:Math.max(6,rect.left-7),width:rect.width+14,height:rect.height+14}}/>}
    <div className={"gc-tour-card gc-tour-step-"+step}>
      <div className="gc-tour-progress"><span>PASSO {step} DE 2</span><div><i className="on"/><i className={step>=2?"on":""}/></div></div>
      <h2>{step===1?"Troque de galeria aqui":"Baixe a galeria inteira"}</h2>
      <p>{step===1?"Use este seletor para navegar entre as pastas do projeto sem voltar para a visão geral.":"Use “Baixar todas” para salvar todas as fotos desta galeria de uma só vez."}</p>
      <div className="gc-tour-actions">
        <button type="button" className="gc-tour-skip" onClick={onClose}>Pular</button>
        <button type="button" className="gc-tour-next" onClick={onNext}>{step===1?"Próximo":"Concluir"} <span><ChevronRightIcon size={16}/></span></button>
      </div>
    </div>
  </div>;
}
