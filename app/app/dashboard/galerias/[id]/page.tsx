"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase-client";

export default function GalleryWorkspaceLegacyRedirect(){
  const id=useParams().id as string;
  const router=useRouter();
  const supabase=useMemo(()=>createClient(),[]);

  useEffect(()=>{let ativo=true;(async()=>{
    const{data:auth}=await supabase.auth.getUser();
    if(!auth.user){router.replace("/login");return}
    const{data}=await supabase.from("galerias").select("projeto_id").eq("id",id).eq("user_id",auth.user.id).maybeSingle();
    if(!ativo)return;
    router.replace(data?.projeto_id?`/dashboard/projetos/${data.projeto_id}`:"/dashboard/projetos");
  })();return()=>{ativo=false}},[id,router,supabase]);

  return <div style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"var(--ft-app-bg)",color:"var(--ft-text-muted)"}}>Abrindo projeto…</div>;
}
