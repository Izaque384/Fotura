import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const app = path.join(process.cwd(), "app");
const read = (relative:string) => fs.readFileSync(path.join(app, relative), "utf8");

test.describe("SEO indexability and UX polish", () => {
  test("private, auth and client-gallery routes explicitly opt out of indexing", () => {
    const layouts = [
      "dashboard/layout.tsx",
      "login/layout.tsx",
      "upload/layout.tsx",
      "configuracoes/layout.tsx",
      "esqueci-senha/layout.tsx",
      "redefinir-senha/layout.tsx",
      "perfil/layout.tsx",
      "admin/layout.tsx",
      "g/[slug]/layout.tsx",
    ];
    for (const file of layouts) {
      const source = read(file);
      expect(source, file).toContain("robots:");
      expect(source, file).toContain("index: false");
      expect(source, file).toContain("follow: false");
    }
  });

  test("public legal pages remain indexable and canonical", () => {
    const termos = read("termos/layout.tsx");
    const privacidade = read("privacidade/layout.tsx");
    expect(termos).toContain('canonical: "/termos"');
    expect(privacidade).toContain('canonical: "/privacidade"');
    expect(termos).toContain("index: true");
    expect(privacidade).toContain("index: true");
  });

  test("sitemap stays restricted to intentional public pages", () => {
    const sitemap = read("sitemap.ts");
    expect(sitemap).toContain('url: `${BASE_URL}/`');
    expect(sitemap).toContain('url: `${BASE_URL}/termos`');
    expect(sitemap).toContain('url: `${BASE_URL}/privacidade`');
    expect(sitemap).not.toContain("/dashboard");
    expect(sitemap).not.toContain("/login");
    expect(sitemap).not.toContain("/g/");
  });

  test("dashboard expiry labels use the shared Brazil calendar rule", () => {
    const dashboard = read("dashboard/page.tsx");
    expect(dashboard).toContain("diasAteDataCalendario");
    expect(dashboard).not.toContain("T23:59:59");
  });

  test("legal and upload surfaces do not regress to low-contrast light-theme leftovers", () => {
    for (const file of ["termos/page.tsx", "privacidade/page.tsx"]) {
      const source = read(file).toLowerCase();
      expect(source, file).not.toContain("#c8cad4");
      expect(source, file).not.toContain("#e0e0ea");
    }
    const upload = read("upload/page.tsx").toLowerCase();
    expect(upload).not.toContain("color:#c3c7db");
    expect(upload).not.toContain("border:1px solid #25283d");

    const onboarding = read("dashboard/onboarding/page.tsx").toLowerCase();
    expect(onboarding).not.toContain("color:#8ea7ff");
    expect(onboarding).not.toContain("color:#a7d9ba");

    const galerias = read("dashboard/galerias/page.tsx").toLowerCase();
    expect(galerias).not.toContain("color:#dfe6ff");
    expect(galerias).not.toContain("color:#c9cede");

    const selecoes = read("dashboard/selecoes/page.tsx").toLowerCase();
    expect(selecoes).not.toContain("color:#a9dcff");
  });
});
