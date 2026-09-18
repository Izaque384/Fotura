import type { Metadata } from "next";
import HomeClient from "./HomeClient";

const titulo = "Fotura — Galeria de fotos e prova online para fotógrafos";
const descricao =
  "Crie galerias profissionais para entregar fotos, receber seleções e comentários dos clientes e organizar provas online com a identidade do seu estúdio.";

export const metadata: Metadata = {
  title: titulo,
  description: descricao,
  alternates: {
    canonical: "/",
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
    title: titulo,
    description: descricao,
    url: "/",
    siteName: "Fotura",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Fotura — Galerias profissionais para fotógrafos",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: titulo,
    description: descricao,
    images: ["/opengraph-image"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://foturax.com.br/#organization",
      name: "Fotura",
      url: "https://foturax.com.br/",
      logo: {
        "@type": "ImageObject",
        url: "https://foturax.com.br/icon-512.png",
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://foturax.com.br/#website",
      url: "https://foturax.com.br/",
      name: "Fotura",
      description: descricao,
      inLanguage: "pt-BR",
      publisher: {
        "@id": "https://foturax.com.br/#organization",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://foturax.com.br/#software",
      name: "Fotura",
      url: "https://foturax.com.br/",
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      inLanguage: "pt-BR",
      description: descricao,
      publisher: {
        "@id": "https://foturax.com.br/#organization",
      },
      offers: [
        {
          "@type": "Offer",
          name: "Essencial",
          price: "14.90",
          priceCurrency: "BRL",
        },
        {
          "@type": "Offer",
          name: "Profissional",
          price: "29.90",
          priceCurrency: "BRL",
        },
        {
          "@type": "Offer",
          name: "Studio",
          price: "59.90",
          priceCurrency: "BRL",
        },
      ],
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <HomeClient />
    </>
  );
}
