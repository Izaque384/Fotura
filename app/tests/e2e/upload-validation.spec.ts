import { expect, test } from "@playwright/test";

const fakeUser = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "e2e@fotura.local",
  email_confirmed_at: "2026-01-01T00:00:00.000Z",
  phone: "",
  confirmed_at: "2026-01-01T00:00:00.000Z",
  last_sign_in_at: "2026-01-01T00:00:00.000Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  is_anonymous: false,
};

test.beforeEach(async ({ page }) => {
  await page.route("https://example.supabase.co/auth/v1/user**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeUser) });
  });
  await page.route("https://example.supabase.co/rest/v1/clientes**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]", headers: { "content-range": "0-0/0" } });
  });
});

test("upload rejeita extensão não permitida antes de qualquer envio", async ({ page }) => {
  await page.goto("/upload");
  const input = page.locator('input[type="file"]');
  await expect(input).toHaveCount(1);

  await input.setInputFiles({
    name: "arquivo.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("nao-e-uma-foto"),
  });

  await expect(page.getByText(/formato não aceito/i)).toBeVisible();
  await expect(page.getByText(/arquivo\.exe/i)).toBeVisible();
});

test("upload rejeita MIME incompatível com a extensão", async ({ page }) => {
  await page.goto("/upload");
  const input = page.locator('input[type="file"]');

  await input.setInputFiles({
    name: "foto.jpg",
    mimeType: "text/plain",
    buffer: Buffer.from("conteudo-invalido"),
  });

  await expect(page.getByText(/tipo do arquivo não corresponde à extensão/i)).toBeVisible();
});
