import type { MetadataRoute } from "next";

const BASE_URL = "https://foturax.com.br";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${BASE_URL}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/termos`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${BASE_URL}/privacidade`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}
