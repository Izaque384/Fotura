import { expect, test } from "@playwright/test";
import fs from "node:fs";

const metadata = fs.readFileSync("app/p/[slug]/layout.tsx", "utf8");
const resolver = fs.readFileSync("lib/project-social-preview.server.ts", "utf8");
const imageRoute = fs.readFileSync("app/p/[slug]/share-image/route.ts", "utf8");

test("link de projeto publica título, capa e imagem social estável", () => {
  expect(metadata).toContain("export async function generateMetadata");
  expect(metadata).toContain("loadProjectSocialPreview(slug)");
  expect(metadata).toContain("openGraph:");
  expect(metadata).toContain("images,");
  expect(metadata).toContain('"summary_large_image"');
  expect(metadata).toContain("/share-image");
  expect(imageRoute).toContain("resize(1200, 630");
  expect(imageRoute).toContain('"Content-Type": "image/jpeg"');
  expect(imageRoute).toContain('"Cache-Control": "private, no-store"');
});

test("capa nunca é exposta em projetos protegidos, expirados ou pastas ocultas", () => {
  expect(resolver).toContain("if (!protegido && !expirado && project.capa_galeria_id && project.capa_arquivo)");
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
