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
        "/pt/admin/","/en/admin/","/es/admin/",
        "/pt/dashboard/","/en/dashboard/","/es/dashboard/",
        "/pt/upload","/en/upload","/es/upload",
        "/pt/configuracoes","/en/configuracoes","/es/configuracoes",
        "/pt/perfil","/en/perfil","/es/perfil",
        "/pt/login","/en/login","/es/login",
        "/pt/esqueci-senha","/en/esqueci-senha","/es/esqueci-senha",
        "/pt/redefinir-senha","/en/redefinir-senha","/es/redefinir-senha",
      ],
    },
    sitemap: "https://foturax.com.br/sitemap.xml",
    host: "https://foturax.com.br",
  };
}
