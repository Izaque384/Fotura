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

test("APIs de galeria rejeitam identificadores que não são UUID", async ({ request }) => {
  const publica = await request.get("/api/galeria/publica?galeria=nao-e-uuid");
  expect(publica.status()).toBe(400);

  const signed = await request.get("/api/fotos/signed?galeria=nao-e-uuid");
  expect(signed.status()).toBe(400);

  const acesso = await request.post("/api/galeria/acesso", {
    data: { galeria: "nao-e-uuid", senha: "teste" },
  });
  expect(acesso.status()).toBe(400);

  const selecao = await request.post("/api/galeria/selecao", {
    data: { galeria: "nao-e-uuid", fotos: [], finalizada: false, comentarios: {} },
  });
  expect(selecao.status()).toBe(400);
});

test("headers essenciais permanecem ativos", async ({ request }) => {
  const resposta = await request.get("/");
  expect(resposta.ok()).toBeTruthy();
  expect(resposta.headers()["x-content-type-options"]).toBe("nosniff");
  expect(resposta.headers()["x-frame-options"]).toBe("DENY");
  const csp = resposta.headers()["content-security-policy"];
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("script-src-attr 'none'");
  expect(resposta.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});
