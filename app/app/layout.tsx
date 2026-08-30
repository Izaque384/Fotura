import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import UxEnhancements from "./components/UxEnhancements";

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
  title: "Fotura — A forma mais bonita de entregar fotos",
  description:
    "Plataforma simples e bonita para fotógrafos entregarem suas fotos: link com sua marca, visualização, favoritas e download.",
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
      <body className="min-h-full flex flex-col">{children}<UxEnhancements/></body>
    </html>
  );
}
