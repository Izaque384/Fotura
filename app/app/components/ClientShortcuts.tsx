"use client";

import { useEffect } from "react";

export default function ClientShortcuts(){
  useEffect(()=>{
    const onKeyDown=(event:KeyboardEvent)=>{
      const target=event.target;
      if(!(target instanceof HTMLTextAreaElement))return;
      if(!target.matches(".gc-com textarea"))return;
      if(event.key!=="Enter"||event.shiftKey||event.isComposing)return;
      event.preventDefault();
      const button=target.closest(".gc-com")?.querySelector("button") as HTMLButtonElement|null;
      if(button&&!button.disabled)button.click();
    };
    document.addEventListener("keydown",onKeyDown);
    return()=>document.removeEventListener("keydown",onKeyDown);
  },[]);
  return null;
}
