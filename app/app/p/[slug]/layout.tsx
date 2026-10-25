import type { ReactNode } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { createServiceClient } from "../../../lib/supabase-server";
import { loadProjectSocialPreview } from "../../../lib/project-social-preview.server";
import { normalizeLocale, ogLocale, withLocalePath } from "../../../lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const locale = normalizeLocale((await headers()).get("x-fotura-locale"));
  const genericTitle = locale === "en" ? "Project — Fotura" : locale === "es" ? "Proyecto — Fotura" : "Projeto — Fotura";
  const preview = await loadProjectSocialPreview(slug);
  if (!preview || preview.expirado) {
    return {
      title: { absolute: genericTitle },
      robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
      openGraph: { title: genericTitle, images: [] },
      twitter: { card: "summary", images: [] },
    };
  }

  const { data: perfil } = await createServiceClient().from("perfis")
    .select("nome_estudio").eq("id", preview.userId).maybeSingle();
  const estudio = String(perfil?.nome_estudio || "Fotura");
  const title = `${preview.nome} — ${estudio}`;
  const description = preview.protegido
    ? locale === "en"
      ? "Password-protected photo gallery. Open using the access details shared by the photographer."
      : locale === "es"
        ? "Galería de fotos protegida por contraseña. Accede con los datos enviados por el fotógrafo."
        : "Galeria de fotos protegida por senha. Entre com os dados enviados pelo fotógrafo."
    : preview.descricao?.trim() || (locale === "en"
      ? `View the photo project ${preview.nome}, shared by ${estudio}.`
      : locale === "es"
        ? `Mira el proyecto fotográfico ${preview.nome}, compartido por ${estudio}.`
        : `Veja o projeto fotográfico ${preview.nome}, compartilhado por ${estudio}.`);

  const path = withLocalePath(`/p/${preview.publicRef}`, locale);
  const url = `https://foturax.com.br${path}`;
  const imageUrl = preview.capaPath
    ? `https://foturax.com.br/p/${encodeURIComponent(preview.publicRef)}/share-image`
    : null;
  const images = imageUrl
    ? [{ url: imageUrl, width: 1200, height: 630, alt: `Capa do projeto ${preview.nome}`, type: "image/jpeg" }]
    : [];

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "Fotura", locale: ogLocale(locale), type: "website", images },
    twitter: { card: imageUrl ? "summary_large_image" : "summary", title, description, images: imageUrl ? [imageUrl] : [] },
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  };
}

export default function ProjectLayout({ children }: { children: ReactNode }) { return children; }
