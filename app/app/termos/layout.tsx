import type { Metadata } from "next";
import { headers } from "next/headers";
import { normalizeLocale } from "../../lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const locale = normalizeLocale((await headers()).get("x-fotura-locale"));
  const copy = locale === "en"
    ? {
        title: "Terms of Use",
        description: "Fotura Terms of Use for the professional photo gallery and online proofing platform.",
      }
    : locale === "es"
      ? {
          title: "Términos de Uso",
          description: "Términos de Uso de Fotura, plataforma de galerías profesionales y selección online para fotógrafos.",
        }
      : {
          title: "Termos de Uso",
          description: "Termos de Uso do Fotura, plataforma de galerias profissionais e prova online para fotógrafos.",
        };
  const path = "termos";
  return {
    ...copy,
    alternates: {
      canonical: `/${locale}/${path}`,
      languages: {
        "pt-BR": `/pt/${path}`,
        en: `/en/${path}`,
        es: `/es/${path}`,
      },
    },
    robots: { index: true, follow: true },
  };
}

export default function TermosLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
