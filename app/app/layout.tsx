import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import "./premium.css";
import "./premium-tuning.css";
import "./ux-refinements.css";
import "./gallery-hero-presets.css";
import "./gallery-hero-legibility.css";
import "./gallery-mobile.css";
import "./mobile-density.css";
import "./lavanda-moderna.css";
import ClientShortcuts from "./components/ClientShortcuts";
import BellOutsideDismiss from "./components/BellOutsideDismiss";
import LandingPlanStorageSync from "./components/LandingPlanStorageSync";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#F5F3FB",
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${sora.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">{children}<LandingPlanStorageSync/><ClientShortcuts/><BellOutsideDismiss/></body>
    </html>
  );
}
