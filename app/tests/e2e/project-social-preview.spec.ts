import { expect, test } from "@playwright/test";
import fs from "node:fs";

const metadata = fs.readFileSync("app/p/[slug]/layout.tsx", "utf8");
const resolver = fs.readFileSync("lib/project-social-preview.server.ts", "utf8");
const imageRoute = fs.readFileSync("app/p/[slug]/share-image/route.ts", "utf8");

test("link de projeto publica título, capa e imagem social estável", () => {
  expect(metadata).toContain("export async function generateMetadata");
  expect(metadata).toContain("loadProjectSocialPreview(slug)");
  expect(metadata).toContain("openGraph:");
  expect(metadata).toContain("type: preview.capaPath");
  expect(metadata).toContain('"summary_large_image"');
  expect(metadata).toContain("/share-image");
  expect(imageRoute).toContain("resize(1200, 630");
  expect(imageRoute).toContain('"Content-Type": "image/jpeg"');
  expect(imageRoute).toContain('"Cache-Control": "private, no-store"');
});

test("capa nunca é exposta em projetos protegidos, expirados ou pastas ocultas", () => {
  expect(resolver).toContain("if ((!protegido || Boolean(project.og_capa_autorizada)) && !expirado && project.capa_galeria_id && project.capa_arquivo)");
  expect(resolver).toContain('.eq("projeto_id", String(project.id))');
  expect(resolver).toContain('.eq("visivel", true)');
  expect(resolver).toContain('!arquivo.includes("..")');
  expect(metadata).toContain("if (!preview || preview.expirado)");
  expect(imageRoute).toContain("if (!preview?.capaPath) return unavailable()");
});

test("rota da capa rejeita referências inválidas ou inexistentes", async ({ request }) => {
  const malformed = await request.get("/p/abc%20invalido/share-image");
  expect(malformed.status()).toBe(404);
  const unknown = await request.get("/p/nao-existe-este-projeto-00000000/share-image");
  expect(unknown.status()).toBe(404);
});

test("WhatsApp recebe metadados no head sem depender da renderização do navegador", async ({ request }) => {
  const response = await request.get("/p/projeto-inexistente-00000000", {
    headers: { "user-agent": "WhatsApp/2.24.16.10 A" },
  });
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  const head = html.split("</head>")[0];
  expect(head).toContain('property="og:title"');
  expect(head).toContain('property="og:image"');
  expect(head).not.toContain('<body');
});

test("bot de compartilhamento reconhecido e limite JPEG configurados", () => {
  const nextConfig = fs.readFileSync("next.config.ts", "utf8");
  expect(nextConfig).toContain("htmlLimitedBots:");
  expect(nextConfig).toContain("WhatsApp");
  expect(imageRoute).toContain("image.length > 600_000");
  expect(metadata).toContain('"https://foturax.com.br/opengraph-image"');
});
