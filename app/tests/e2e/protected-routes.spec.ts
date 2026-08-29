import { expect, test } from "@playwright/test";

for (const rota of ["/dashboard", "/dashboard/galerias", "/dashboard/selecoes", "/upload", "/perfil", "/configuracoes"]) {
  test(`${rota} exige sessão autenticada`, async ({ page }) => {
    await page.goto(rota);
    await expect(page).toHaveURL(/\/login$/);
  });
}
