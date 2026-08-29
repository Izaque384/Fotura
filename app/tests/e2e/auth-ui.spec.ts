import { expect, test } from "@playwright/test";

test("login exige e-mail e senha", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Erro: Preencha e-mail e senha.")).toBeVisible();
});

test("cadastro exige termos e senha mínima", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Cadastre-se" }).click();
  await page.getByPlaceholder("seu@email.com").fill("teste@fotura.local");
  await page.getByPlaceholder("••••••••").fill("12345");

  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Erro: Você precisa aceitar os Termos de Uso e a Política de Privacidade.")).toBeVisible();

  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Erro: Use uma senha com pelo menos 6 caracteres.")).toBeVisible();
});
