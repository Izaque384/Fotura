import type { Metadata } from "next";
import { headers } from "next/headers";
import { normalizeLocale } from "../../lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const locale = normalizeLocale((await headers()).get("x-fotura-locale"));
  const copy = locale === "en"
    ? {
        title: "Privacy Policy",
        description: "Fotura Privacy Policy and information about personal data processing on the platform.",
      }
    : locale === "es"
      ? {
          title: "Política de Privacidad",
          description: "Política de Privacidad de Fotura e información sobre el tratamiento de datos personales en la plataforma.",
        }
      : {
          title: "Política de Privacidade",
          description: "Política de Privacidade do Fotura e informações sobre o tratamento de dados na plataforma.",
        };
  const path = "privacidade";
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

export default function PrivacidadeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
