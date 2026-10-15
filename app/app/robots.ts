import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin/",
        "/dashboard/",
        "/upload",
        "/configuracoes",
        "/perfil",
        "/login",
        "/esqueci-senha",
        "/redefinir-senha",
      ],
    },
    sitemap: "https://foturax.com.br/sitemap.xml",
    host: "https://foturax.com.br",
  };
}
