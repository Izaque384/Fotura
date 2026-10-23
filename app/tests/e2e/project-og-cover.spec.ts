import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { podeExibirCapaOG } from "../../lib/project-og-cover";

const base = {
  temSenha: false,
  autorizada: false,
  expirada: false,
  capaConfigurada: true,
  pastaPublicada: true,
};

test("capa de projeto sem senha pode aparecer na prévia", () => {
  expect(podeExibirCapaOG(base)).toBe(true);
  expect(podeExibirCapaOG({ ...base, capaConfigurada: false })).toBe(false);
  expect(podeExibirCapaOG({ ...base, pastaPublicada: false })).toBe(false);
  expect(podeExibirCapaOG({ ...base, expirada: true })).toBe(false);
});

test("capa de projeto protegido só aparece com autorização explícita", () => {
  expect(podeExibirCapaOG({ ...base, temSenha: true })).toBe(false);
  expect(podeExibirCapaOG({ ...base, temSenha: true, autorizada: true })).toBe(true);
  expect(podeExibirCapaOG({ ...base, temSenha: true, autorizada: true, expirada: true })).toBe(false);
  expect(podeExibirCapaOG({ ...base, temSenha: true, autorizada: true, pastaPublicada: false })).toBe(false);
});

test("geração Open Graph usa somente thumb autorizada, nunca URL pública do Storage", () => {
  const fonte = fs.readFileSync("app/p/[slug]/opengraph-image.tsx", "utf8");
  const workspace = fs.readFileSync("app/api/projeto/workspace/route.ts", "utf8");
  const painel = fs.readFileSync("app/dashboard/projetos/[id]/page.tsx", "utf8");
  expect(fonte).toContain('export const dynamic = "force-dynamic"');
  expect(fonte).toContain("podeExibirCapaOG({");
  expect(fonte).toContain('.eq("visivel", true)');
  expect(fonte).toContain('storage.from("fotos").download(caminho)');
  expect(fonte).toContain('.resize(1200, 630, { fit: "cover", position: "attention" })');
  expect(fonte).toContain('let capa: string | null = null');
  expect(workspace).toContain("og_capa_autorizada");
  expect(painel).toContain("Mostrar capa no compartilhamento, mesmo com senha");
});

test("metadados do projeto continuam anunciando imagem de compartilhamento", () => {
  const layout = fs.readFileSync("app/p/[slug]/layout.tsx", "utf8");
  expect(layout).toContain("openGraph:{title,description,url");
  expect(layout).toContain('twitter:{card:"summary_large_image"');
  expect(fs.existsSync("app/p/[slug]/opengraph-image.tsx")).toBe(true);
});
