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
import GlobalLanguageAccess from "./components/GlobalLanguageAccess";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://foturax.com.br"),
  title: {
    default: "Fotura — Galeria de fotos e prova online para fotógrafos",
    template: "%s | Fotura",
  },
  description:
    "Crie galerias profissionais para entregar fotos, receber seleções e comentários dos clientes e organizar provas online com a identidade do seu estúdio.",
  applicationName: "Fotura",
  category: "photography",
  manifest: "/manifest.json",
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const requestHeaders = await headers();
  const locale = normalizeLocale(requestHeaders.get("x-fotura-locale"));
  return (
    <html
      lang={htmlLang(locale)}
      className={`${sora.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col"><I18nProvider locale={locale}><GlobalLanguageAccess/>{children}<ClientShortcuts/><BellOutsideDismiss/></I18nProvider></body>
    </html>
  );
}
