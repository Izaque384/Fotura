import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Política de Privacidade do Fotura e informações sobre o tratamento de dados na plataforma.",
  alternates: {
    canonical: "/privacidade",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacidadeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
