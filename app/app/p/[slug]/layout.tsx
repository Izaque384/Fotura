import type { ReactNode } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { resolvePublicProjectRef } from "../../../lib/project-public-ref.server";
import { createServiceClient } from "../../../lib/supabase-server";
import { normalizeLocale, ogLocale, withLocalePath } from "../../../lib/i18n";

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const{slug}=await params;
  const locale=normalizeLocale((await headers()).get("x-fotura-locale"));
  const genericTitle=locale==="en"?"Project — Fotura":locale==="es"?"Proyecto — Fotura":"Projeto — Fotura";
  const podeResolver=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
  if(!podeResolver)return{title:genericTitle,robots:{index:false,follow:false,googleBot:{index:false,follow:false}}};
  const projeto=await resolvePublicProjectRef(slug);
  if(!projeto)return{title:genericTitle,robots:{index:false,follow:false,googleBot:{index:false,follow:false}}};

  const supabase=createServiceClient();
  const{data:perfil}=await supabase.from("perfis").select("nome_estudio").eq("id",projeto.userId).maybeSingle();
  const estudio=String(perfil?.nome_estudio||"Fotura");
  const title=`${projeto.nome} — ${estudio}`;
  const description=locale==="en"
    ?`View the photo project ${projeto.nome}, shared by ${estudio}.`
    :locale==="es"
      ?`Mira el proyecto fotográfico ${projeto.nome}, compartido por ${estudio}.`
      :`Veja o projeto fotográfico ${projeto.nome}, compartilhado por ${estudio}.`;
  const path=withLocalePath(`/p/${projeto.publicRef}`,locale);
  const url=`https://foturax.com.br${path}`;
  return{
    title,description,alternates:{canonical:url},
    openGraph:{title,description,url,siteName:"Fotura",locale:ogLocale(locale),type:"website"},
    twitter:{card:"summary_large_image",title,description},
    robots:{index:false,follow:false,googleBot:{index:false,follow:false}},
  };
}

export default function ProjectLayout({children}:{children:ReactNode}){return children}
