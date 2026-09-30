import type { ReactNode } from "react";
import type { Metadata } from "next";
import GalleryAnalytics from "./GalleryAnalytics";
import { resolvePublicGalleryRef } from "../../../lib/gallery-public-ref.server";
import { createServiceClient } from "../../../lib/supabase-server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const podeResolver = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!podeResolver) {
    return {
      title: "Galeria — Fotura",
      robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
    };
  }
  const galeria = await resolvePublicGalleryRef(slug);
  if (!galeria) {
    return {
      title: "Galeria — Fotura",
      robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
    };
  }

  const supabase = createServiceClient();
  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome_estudio")
    .eq("id", galeria.userId)
    .maybeSingle();

  const estudio = String(perfil?.nome_estudio || "Fotura");
  const title = `${galeria.titulo} — ${estudio}`;
  const description = galeria.prova
    ? `Veja as fotos de ${galeria.titulo} e faça sua seleção na galeria compartilhada por ${estudio}.`
    : `Veja a galeria ${galeria.titulo}, compartilhada por ${estudio}.`;
  const url = `https://foturax.com.br/g/${galeria.publicRef}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Fotura",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
  };
}

export default async function GalleryLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const podeResolver = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const galeria = podeResolver ? await resolvePublicGalleryRef(slug) : null;
  return (
    <>
      <GalleryAnalytics galeriaId={galeria?.id ?? slug} />
      {children}
    </>
  );
}
