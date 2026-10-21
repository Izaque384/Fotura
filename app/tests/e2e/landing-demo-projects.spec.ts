import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test.describe("landing: demonstração da arquitetura atual", () => {
  test("não apresenta a antiga navegação de galerias nem formulário de nova galeria", () => {
    const home = fs.readFileSync(path.join(process.cwd(), "app", "HomeClient.tsx"), "utf8");
    expect(home).toContain('["Painel","Projetos","Clientes","Vendas","Planos","Configurações","Ajuda e feedback"]');
    expect(home).not.toContain('["Painel","Galerias"');
    expect(home).not.toContain("Nova galeria");
    expect(home).not.toContain("<small>GALERIAS</small>");
    expect(home).toContain("lp2-real-projects");
    expect(home).toContain("lp2-real-project-folders");
    expect(home).toContain("lp2-real-selections");
  });

  test("o fluxo mostra projetos, pastas, seleção pública e seleções por pasta", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("https://images.unsplash.com/**", route => route.abort());
    await page.goto("/pt");
    const demo = page.locator(".lp2-demo");
    await expect(demo.getByText("Seus trabalhos em um só lugar")).toBeVisible();
    await expect(demo.locator(".lp2-demo-side")).not.toContainText("Galerias");
    await expect(demo.locator(".lp2-demo-side")).toContainText("Projetos");

    await demo.getByRole("button", { name: /Envie, organize e compartilhe/ }).click();
    await expect(demo.locator(".lp2-real-folders-head").getByText("Pastas de fotos")).toBeVisible();
    await expect(demo.getByText("Making of")).toBeVisible();

    await demo.getByRole("button", { name: /O cliente faz a seleção/ }).click();
    await expect(demo.getByText("Cerimônia", { exact: false }).first()).toBeVisible();

    await demo.getByRole("button", { name: /Siga até a entrega final/ }).click();
    await expect(demo.getByText("Escolhas do cliente", { exact: true })).toBeVisible();
    await expect(demo.getByText("Ver seleção →").first()).toBeVisible();
  });
});
