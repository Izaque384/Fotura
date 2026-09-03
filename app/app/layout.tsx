import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import "./premium.css";
import "./premium-tuning.css";
import "./ux-refinements.css";
import "./gallery-hero-presets.css";
import ClientShortcuts from "./components/ClientShortcuts";
import BellOutsideDismiss from "./components/BellOutsideDismiss";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#4a6cf7",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Fotura — Galerias profissionais para fotógrafos",
  description:
    "Crie galerias profissionais, envie fotos, receba seleções e entregue aos seus clientes com uma experiência premium e com a sua marca.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fotura",
  },
  icons: {
    icon: "/icon-192.png",
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
      <body className="min-h-full flex flex-col">{children}<ClientShortcuts/><BellOutsideDismiss/></body>
    </html>
  );
}
