import type { MetadataRoute } from "next";

const BASE_URL = "https://foturax.com.br";
const locales = ["pt", "en", "es"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((locale) => [
    {
      url: `${BASE_URL}/${locale}`,
      changeFrequency: "weekly" as const,
      priority: locale === "en" ? 1 : 0.9,
      alternates: {
        languages: {
          "pt-BR": `${BASE_URL}/pt`,
          en: `${BASE_URL}/en`,
          es: `${BASE_URL}/es`,
        },
      },
    },
    {
      url: `${BASE_URL}/${locale}/termos`,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    },
    {
      url: `${BASE_URL}/${locale}/privacidade`,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    },
  ]);
}
