import { expect, test } from "@playwright/test";

test.describe("public demo gallery", () => {
  test("demo em português permite selecionar e concluir sem backend", async ({ page }) => {
    await page.route("https://images.unsplash.com/**", (route) => route.abort());
    await page.goto("/pt/demo");

    await expect(page.getByText("Demonstração interativa")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Marina & Pedro" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Finalizar seleção" })).toBeVisible();

    await page.getByRole("button", { name: "Finalizar seleção" }).click();
    await expect(page.getByRole("heading", { name: "Finalizar seleção?" })).toBeVisible();
    await page.getByRole("button", { name: "Finalizar demonstração" }).click();

    await expect(page.getByText("Seleção concluída")).toBeVisible();
    await expect(page.getByRole("status").getByRole("link", { name: /Criar minha galeria grátis/ })).toBeVisible();
  });

  test("demo internacional respeita o idioma da URL", async ({ page }) => {
    await page.route("https://images.unsplash.com/**", (route) => route.abort());
    await page.goto("/en/demo");

    await expect(page.getByText("Interactive demo")).toBeVisible();
    await expect(page.getByText("Select up to 5 photos as if you were the client.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Finish selection" })).toBeVisible();
  });
});
