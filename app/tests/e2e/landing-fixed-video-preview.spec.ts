import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test.describe("Prévia: landing original com vídeo fixo global", () => {
  test("não substitui a landing de produção e não permite indexação da rota", () => {
    const home = readFileSync("app/HomeClient.tsx", "utf8");
    const page = readFileSync("app/lp-fundo-video/page.tsx", "utf8");
    expect(home).toContain('import "./landing-editorial.css"');
    expect(home).toContain('videoAsPageBackground = false');
    expect(home).toContain("if (videoAsPageBackground) return;");
    expect(page).toContain("index: false");
    expect(page).toContain("defaultPricingCurrencyForCountry");
  });

  test("conserva a LP atual, com uma única camada de vídeo fora do hero", async ({ page }) => {
    await page.goto("/pt/lp-fundo-video");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Sua fotografia merece");
    await expect(page.locator(".lp2-hero")).toBeVisible();
    await expect(page.locator(".lp2-demo")).toBeVisible();
    await expect(page.locator(".lp2-pricing")).toBeVisible();
    await expect(page.locator(".lp2-faq")).toBeVisible();
    await expect(page.locator(".lp2-final")).toBeVisible();
    await expect(page.locator(".lp2-plan")).toHaveCount(4);
    await expect(page.locator(".lp-video-preview-backdrop .lp2-hero-media")).toHaveCount(1);
    await expect(page.locator(".lp2-hero .lp2-hero-media")).toHaveCount(0);
    await expect(page.locator(".lp-video-preview-backdrop .lp2-hero-poster")).toHaveCount(1);
    await expect(page.getByRole("link", { name: /Comparar com a landing atual/ })).toHaveAttribute("href", "https://foturax.com.br/pt");
    await expect(page.locator(".lp-video-preview-backdrop")).toHaveCSS("position", "fixed");
  });

  test("o vídeo fica imóvel no viewport enquanto o conteúdo se desloca", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/pt/lp-fundo-video");
    const backdrop = page.locator(".lp-video-preview-backdrop");
    const hero = page.locator(".lp2-hero");
    const inicial = await page.evaluate(() => ({
      topBackdrop: document.querySelector(".lp-video-preview-backdrop")!.getBoundingClientRect().top,
      topHero: document.querySelector(".lp2-hero")!.getBoundingClientRect().top,
    }));
    await page.locator(".lp2-pricing").scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(900);
    const final = await page.evaluate(() => ({
      topBackdrop: document.querySelector(".lp-video-preview-backdrop")!.getBoundingClientRect().top,
      topHero: document.querySelector(".lp2-hero")!.getBoundingClientRect().top,
    }));
    expect(Math.abs(inicial.topBackdrop - final.topBackdrop)).toBeLessThan(2);
    expect(final.topHero).toBeLessThan(inicial.topHero - 500);
    await expect(backdrop).toHaveCSS("position", "fixed");
    await expect(hero).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  });

  test("planos, FAQ e CTA final possuem superfícies legíveis sobre o vídeo", async ({ page }) => {
    await page.goto("/pt/lp-fundo-video");
    await expect(page.locator(".lp2-pricing")).toHaveCSS("backdrop-filter", /blur/);
    await expect(page.locator(".lp2-faq")).toHaveCSS("backdrop-filter", /blur/);
    await expect(page.locator(".lp2-final")).toHaveCSS("background-image", "none");
    await page.locator(".lp2-faq details").first().locator("summary").click();
    await expect(page.locator(".lp2-faq details").first()).toHaveAttribute("open", "");
  });

  test("no celular permanece sem overflow horizontal e o vídeo continua fixo", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/pt/lp-fundo-video");
    await expect(page.locator(".lp2-hero")).toBeVisible();
    await expect(page.locator(".lp-video-preview-backdrop")).toHaveCSS("position", "fixed");
    await page.locator(".lp2-faq").scrollIntoViewIfNeeded();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      backdropTop: document.querySelector(".lp-video-preview-backdrop")!.getBoundingClientRect().top,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
    expect(Math.abs(dimensions.backdropTop)).toBeLessThan(2);
  });

  test("preferência por movimento reduzido conserva poster e não reproduz vídeo", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/pt/lp-fundo-video");
    await expect(page.locator(".lp-video-preview-backdrop .lp2-hero-poster")).toBeVisible();
    await expect(page.locator(".lp-video-preview-backdrop video")).toHaveCount(0);
  });
});
