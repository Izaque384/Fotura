import { expect, test } from "@playwright/test";

test("login expõe campos rotulados e feedback de erro acessível", async ({ page }) => {
  await page.goto("/login");

  const email = page.getByLabel("E-mail");
  const senha = page.getByLabel("Senha");
  await expect(email).toBeVisible();
  await expect(senha).toBeVisible();

  await email.focus();
  await page.keyboard.press("Enter");
  const erro = page.getByText("Erro: Preencha e-mail e senha.", { exact: true });
  await expect(erro).toHaveAttribute("role", "alert");
});

test("login não cria rolagem horizontal em viewport mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/login");

  const dimensoes = await page.evaluate(() => ({
    larguraDocumento: document.documentElement.scrollWidth,
    larguraViewport: window.innerWidth,
  }));
  expect(dimensoes.larguraDocumento).toBeLessThanOrEqual(dimensoes.larguraViewport);
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("preferência de movimento reduzido é respeitada", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  const duracao = await page.getByRole("button", { name: "Entrar" }).evaluate((elemento) => getComputedStyle(elemento).transitionDuration);
  expect(parseFloat(duracao)).toBeLessThanOrEqual(0.001);
});
