import { expect, test } from "@playwright/test";

test("rotas sensíveis rejeitam chamadas sem autenticação ou payload", async ({ request }) => {
  const cron = await request.get("/api/cron/expirar");
  expect(cron.status()).toBe(401);

  const signed = await request.get("/api/fotos/signed");
  expect(signed.status()).toBe(400);

  const excluir = await request.delete("/api/galeria/excluir");
  expect(excluir.status()).toBe(401);

  const acesso = await request.post("/api/galeria/acesso", { data: {} });
  expect(acesso.status()).toBe(400);

  const publica = await request.get("/api/galeria/publica");
  expect(publica.status()).toBe(400);
});

test("headers essenciais permanecem ativos", async ({ request }) => {
  const resposta = await request.get("/");
  expect(resposta.ok()).toBeTruthy();
  expect(resposta.headers()["x-content-type-options"]).toBe("nosniff");
  expect(resposta.headers()["x-frame-options"]).toBe("DENY");
  expect(resposta.headers()["content-security-policy"]).toContain("default-src 'self'");
  expect(resposta.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});
