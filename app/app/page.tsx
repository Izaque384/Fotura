import type { Metadata } from "next";
import { headers } from "next/headers";
import HomeClient from "./HomeClient";
import { type Locale, normalizeLocale, ogLocale } from "../lib/i18n";

const seo: Record<Locale, { title: string; description: string; imageAlt: string }> = {
  pt: {
    title: "Fotura — Galeria de fotos e prova online para fotógrafos",
    description: "Crie galerias profissionais para entregar fotos, receber seleções e comentários dos clientes e organizar provas online com a identidade do seu estúdio.",
    imageAlt: "Fotura — Galerias profissionais para fotógrafos",
  },
  en: {
    title: "Fotura — Photo delivery and proofing galleries for photographers",
    description: "Create professional galleries to deliver photos, collect client selections and comments, and organize online proofing with your studio identity.",
    imageAlt: "Fotura — Professional galleries for photographers",
  },
  es: {
    title: "Fotura — Galerías de entrega y selección para fotógrafos",
    description: "Crea galerías profesionales para entregar fotos, recibir selecciones y comentarios de clientes y organizar pruebas online con la identidad de tu estudio.",
    imageAlt: "Fotura — Galerías profesionales para fotógrafos",
  },
};

async function requestLocale(): Promise<Locale> {
  const requestHeaders = await headers();
  return normalizeLocale(requestHeaders.get("x-fotura-locale"));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  const copy = seo[locale];
  const canonical = `/${locale}`;
  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical,
      languages: {
        "pt-BR": "/pt",
        en: "/en",
        es: "/es",
        "x-default": "/en",
      },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      title: copy.title,
      description: copy.description,
      url: canonical,
      siteName: "Fotura",
      locale: ogLocale(locale),
      alternateLocale: ["pt_BR", "en_US", "es_ES"].filter((item) => item !== ogLocale(locale)),
      type: "website",
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: copy.imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.description,
      images: ["/opengraph-image"],
    },
  };
}

export default async function HomePage() {
  const locale = await requestLocale();
  const copy = seo[locale];
  const url = `https://foturax.com.br/${locale}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://foturax.com.br/#organization",
        name: "Fotura",
        url: "https://foturax.com.br/",
        logo: { "@type": "ImageObject", url: "https://foturax.com.br/icon-512.png" },
        sameAs: ["https://www.producthunt.com/products/fotura"],
      },
      {
        "@type": "WebSite",
        "@id": `${url}#website`,
        url,
        name: "Fotura",
        description: copy.description,
        inLanguage: locale === "pt" ? "pt-BR" : locale,
        publisher: { "@id": "https://foturax.com.br/#organization" },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${url}#software`,
        name: "Fotura",
        url,
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Web",
        inLanguage: locale === "pt" ? "pt-BR" : locale,
        description: copy.description,
        publisher: { "@id": "https://foturax.com.br/#organization" },
        offers: [
          { "@type": "Offer", name: locale === "en" ? "Free" : locale === "es" ? "Gratis" : "Grátis", price: "0.00", priceCurrency: "BRL" },
          { "@type": "Offer", name: locale === "en" ? "Essential" : locale === "es" ? "Esencial" : "Essencial", price: "14.90", priceCurrency: "BRL" },
          { "@type": "Offer", name: locale === "en" ? "Professional" : locale === "es" ? "Profesional" : "Profissional", price: "29.90", priceCurrency: "BRL" },
          { "@type": "Offer", name: "Studio", price: "59.90", priceCurrency: "BRL" },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <HomeClient />
    </>
  );
}
