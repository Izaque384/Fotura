import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Sora } from "next/font/google";
import "./globals.css";
import "./gallery-hero-presets.css";
import "./gallery-hero-legibility.css";
import "./gallery-mobile.css";
import "./mobile-density.css";
import "./lavanda-moderna.css";
import ClientShortcuts from "./components/ClientShortcuts";
import BellOutsideDismiss from "./components/BellOutsideDismiss";
import I18nProvider from "./components/I18nProvider";
import { htmlLang, normalizeLocale } from "../lib/i18n";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#F0EDF7",
  width: "device-width",
  initialScale: 1,
};

const SEO = {
  pt: {
    title: "Fotura — Galeria de fotos e prova online para fotógrafos",
    description: "Crie galerias profissionais para entregar fotos, receber seleções e comentários dos clientes e organizar provas online com a identidade do seu estúdio.",
  },
  en: {
    title: "Fotura — Online photo galleries and proofing for photographers",
    description: "Create professional galleries to deliver photos, collect client selections and comments, and manage online proofing with your studio identity.",
  },
  es: {
    title: "Fotura — Galerías de fotos y selección online para fotógrafos",
    description: "Crea galerías profesionales para entregar fotos, recibir selecciones y comentarios de clientes y organizar pruebas online con la identidad de tu estudio.",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const locale = normalizeLocale(requestHeaders.get("x-fotura-locale"));
  const seo = SEO[locale];
  return {
    metadataBase: new URL("https://foturax.com.br"),
    title: {
      default: seo.title,
      template: "%s | Fotura",
    },
    description: seo.description,
    applicationName: "Fotura",
    category: "photography",
    manifest: "/manifest.json",
    alternates: {
      canonical: `/${locale}`,
      languages: {
        "pt-BR": "/pt",
        en: "/en",
        es: "/es",
        "x-default": "/en",
      },
    },
    openGraph: {
      type: "website",
      siteName: "Fotura",
      title: seo.title,
      description: seo.description,
      locale: locale === "pt" ? "pt_BR" : locale === "en" ? "en_US" : "es_ES",
      alternateLocale: locale === "pt" ? ["en_US", "es_ES"] : locale === "en" ? ["pt_BR", "es_ES"] : ["pt_BR", "en_US"],
      url: `/${locale}`,
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Fotura",
    },
    icons: {
      icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
      shortcut: "/favicon.svg",
      apple: "/apple-touch-icon.png",
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const requestHeaders = await headers();
  const locale = normalizeLocale(requestHeaders.get("x-fotura-locale"));
  return (
    <html
      lang={htmlLang(locale)}
      className={`${sora.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col"><I18nProvider locale={locale}>{children}<ClientShortcuts/><BellOutsideDismiss/></I18nProvider></body>
    </html>
  );
}
