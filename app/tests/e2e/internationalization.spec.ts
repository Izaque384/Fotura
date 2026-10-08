import { expect, test } from "@playwright/test";

test.describe("international routes", () => {
  test("English login renders in English without hydration errors", async ({ page }) => {
    const hydrationErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /hydration/i.test(message.text())) hydrationErrors.push(message.text());
    });

    await page.goto("/en/login");
    await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    expect(hydrationErrors).toEqual([]);
  });

  test("Spanish login renders in Spanish", async ({ page }) => {
    await page.goto("/es/login");
    await expect(page.getByRole("heading", { name: "Entra en tu cuenta" })).toBeVisible();
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  });

  test("English public gallery translates after hydration without mismatch", async ({ page }) => {
    const hydrationErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /hydration/i.test(message.text())) hydrationErrors.push(message.text());
    });

    await page.route("**/api/galeria/publica**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          galeria: {
            titulo: "International Demo",
            capa: null,
            prova: true,
            limite: 0,
            prazo: null,
            linkAte: "2020-01-01",
            temSenha: false,
            desbloqueada: true,
            linkExpirado: true,
          },
          perfil: { nome: "Studio Aurora", logo: null, cor: "#0b0b1a" },
          selecao: null,
        }),
      });
    });

    await page.goto("/en/g/00000000-0000-4000-8000-000000000004");
    await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
    await expect(page.getByText(/The access period for this gallery has ended/i)).toBeVisible();
    expect(hydrationErrors).toEqual([]);
  });
});
