import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test.describe("landing: demonstração da arquitetura atual", () => {
  test("não apresenta a antiga navegação e mostra galerias no contexto do projeto", () => {
    const home = fs.readFileSync(path.join(process.cwd(), "app", "HomeClient.tsx"), "utf8");
    expect(home).toContain('["Painel","Projetos","Clientes","Vendas","Planos","Configurações","Ajuda e feedback"]');
    expect(home).not.toContain('["Painel","Galerias"');
    expect(home).toContain("+ Nova galeria");
    expect(home).not.toContain("<small>GALERIAS</small>");
    expect(home).toContain("lp2-real-projects");
    expect(home).toContain("lp2-real-project-folders");
    expect(home).toContain("lp2-real-selections");
    expect(home).toContain("Galerias e fotos");
    expect(home).toContain("ESPAÇO DE TRABALHO");
    expect(home).toContain("Acompanhe cada galeria até a publicação");
    expect(home).not.toContain('<span className="on">Galerias</span>');
    expect(home).not.toContain("lp2-real-public-hint");
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
    await expect(demo.locator(".lp2-real-folders-head").getByText("Organize suas galerias")).toBeVisible();
    await expect(demo.locator(".lp2-real-workspace-tabs .on").getByText("Galerias e fotos")).toBeVisible();
    await expect(demo.locator(".lp2-real-workspace-overview-card.link")).toContainText("Link do projeto");
    await expect(demo.getByText("Making of")).toBeVisible();

    await demo.getByRole("button", { name: /O cliente faz a seleção/ }).click();
    await expect(demo.getByText("Cerimônia", { exact: false }).first()).toBeVisible();
    await expect(demo.locator(".lp2-real-public-grid .lp2-real-check.on")).toHaveCount(3);
    await expect(demo.locator(".lp2-real-public-hint")).toHaveCount(0);
    await expect(demo.locator(".lp2-real-selection-bar")).toContainText("3 selecionadas");

    await demo.getByRole("button", { name: /Siga até a entrega final/ }).click();
    await expect(demo.getByText("Acompanhe cada galeria até a publicação")).toBeVisible();
    await expect(demo.locator(".lp2-real-workspace-tabs .on").getByText("Entrega")).toBeVisible();
    await expect(demo.locator(".lp2-real-delivery-list")).toContainText("Preparando entrega");
    await expect(demo.locator(".lp2-real-delivery-list")).toContainText("Fotos finais publicadas");
  });
});
