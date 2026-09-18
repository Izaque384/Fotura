import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Termos de Uso do Fotura, plataforma de galerias profissionais e prova online para fotógrafos.",
  alternates: {
    canonical: "/termos",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function TermosLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
