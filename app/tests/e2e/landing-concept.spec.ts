import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test.describe("Landing conceitual isolada", () => {
  test("a página atual segue independente e a prévia não pode ser indexada", () => {
    const home = readFileSync("app/HomeClient.tsx", "utf8");
    const preview = readFileSync("app/lp-conceito/page.tsx", "utf8");
    expect(home).toContain('import "./landing-editorial.css"');
    expect(home).not.toContain("ConceptClient");
    expect(preview).toContain("index: false");
    expect(preview).toContain("defaultPricingCurrencyForCountry");
  });

  test("mostra marca, experiência interativa, benefícios e quatro planos verdadeiros", async ({ page }) => {
    await page.goto("/pt/lp-conceito");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Sua fotografia merece uma");
    await expect(page.getByRole("heading", { name: /Veja como tudo/ })).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(3);
    await expect(page.locator(".fnc-plan")).toHaveCount(4);
    await expect(page.locator(".fnc-plan.is-featured")).toContainText("Profissional");
    await expect(page.getByText("CONCEITO VISUAL 01")).toBeVisible();
    const linkAtual = page.getByRole("link", { name: /Comparar com a LP atual/ });
    await expect(linkAtual).toHaveAttribute("href", "https://foturax.com.br/pt");
    await expect(linkAtual).toHaveAttribute("target", "_blank");
  });

  test("troca o protótipo entre projeto, seleção e entrega sem elementos de seleção na entrega", async ({ page }) => {
    await page.goto("/pt/lp-conceito");
    const projetos = page.getByRole("tab", { name: /Organize os projetos/ });
    const selecao = page.getByRole("tab", { name: /Receba as escolhas/ });
    const entrega = page.getByRole("tab", { name: /Entregue com sua marca/ });
    await expect(projetos).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".fnc-mock-row")).toHaveCount(3);
    await selecao.click();
    await expect(selecao).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".fnc-mock-photo-grid")).toBeVisible();
    await expect(page.locator(".fnc-mock-photo-check.checked")).toHaveCount(3);
    await entrega.click();
    await expect(entrega).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".fnc-mock-delivery-card")).toBeVisible();
    await expect(page.locator(".fnc-mock-photo-check")).toHaveCount(0);
    await entrega.press("ArrowLeft");
    await expect(selecao).toHaveAttribute("aria-selected", "true");
  });

  test("no celular não há rolagem horizontal nem sobreposição do painel", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/pt/lp-conceito");
    await expect(page.locator(".fnc-hero")).toBeVisible();
    await page.locator("#experimente").scrollIntoViewIfNeeded();
    await page.getByRole("tab", { name: /Entregue com sua marca/ }).click();
    await expect(page.locator(".fnc-mock-delivery-card")).toBeVisible();
    const dimensoes = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      documento: document.documentElement.scrollWidth,
      painel: document.querySelector(".fnc-demo-window-wrap")?.getBoundingClientRect().width,
    }));
    expect(dimensoes.documento).toBeLessThanOrEqual(dimensoes.viewport + 1);
    expect(dimensoes.painel).toBeGreaterThan(200);
  });

  test("movimento reduzido desliga a transição de troca da demonstração", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/pt/lp-conceito");
    await page.getByRole("tab", { name: /Receba as escolhas/ }).click();
    await expect(page.locator(".fnc-window-scene")).toHaveCSS("animation-name", "none");
  });

  test("prévia de vídeo abre e fecha com Escape", async ({ page }) => {
    await page.goto("/pt/lp-conceito");
    await page.getByRole("button", { name: /Assistir à prévia em vídeo/ }).click();
    await expect(page.getByRole("dialog", { name: /Prévia de abertura em vídeo/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /Prévia de abertura em vídeo/ })).toHaveCount(0);
  });
});
