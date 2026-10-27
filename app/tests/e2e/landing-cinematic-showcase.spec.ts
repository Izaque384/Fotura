import { expect, test } from "@playwright/test";

test("landing substitui completamente a seleção de fotos pela abertura cinematográfica", async ({ page }) => {
  await page.goto("/pt");
  const secao = page.getByRole("region", { name: "Antes das fotos, uma história." });
  await expect(secao).toBeVisible();
  await expect(secao.getByText("Vídeo ou fotografias", { exact: true })).toBeVisible();
  await expect(page.getByText("Seu cliente vê o ensaio. Não o sistema.")).toHaveCount(0);
  await expect(page.locator(".lp2-client-grid")).toHaveCount(0);
  await expect(page.locator(".lp2-client-photo")).toHaveCount(0);
  await secao.getByRole("button", { name: "Abrir demonstração cinematográfica em tela cheia" }).click();
  const dialog = page.getByRole("dialog", { name: "Apresentação do projeto" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Alguns momentos merecem ser revividos." })).toBeVisible();
  await expect(dialog.locator(".fci-images img")).toHaveCount(3);
  await expect(dialog.locator(".fci-video")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Fechar prévia" })).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar prévia" }).click();
  await expect(dialog).toHaveCount(0);
});

test("demonstração da abertura funciona no celular, sem transbordamento horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pt");
  const secao = page.getByRole("region", { name: "Antes das fotos, uma história." });
  const cartaz = secao.getByRole("button", { name: "Abrir demonstração cinematográfica em tela cheia" });
  await expect(cartaz).toBeVisible();
  const { viewport, left, right } = await cartaz.evaluate((node) => {
    const bounds = node.getBoundingClientRect();
    return { viewport: window.innerWidth, left: bounds.left, right: bounds.right };
  });
  expect(left).toBeGreaterThanOrEqual(0);
  expect(right).toBeLessThanOrEqual(viewport + 1);
  await secao.getByRole("button", { name: /Experimentar a abertura/ }).click();
  await expect(page.getByRole("dialog", { name: "Apresentação do projeto" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Apresentação do projeto" })).toHaveCount(0);
});

test("nova seção está localizada em inglês e espanhol", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: "Every story begins before the first photo." })).toBeVisible();
  await page.goto("/es");
  await expect(page.getByRole("heading", { name: "Antes de las fotos, una historia." })).toBeVisible();
});
