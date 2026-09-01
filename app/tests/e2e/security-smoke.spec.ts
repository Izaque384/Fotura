import { expect, test } from "@playwright/test";

test("rotas sensíveis rejeitam chamadas sem autenticação ou payload", async ({ request }) => {
  const cron = await request.get("/api/cron/expirar");
  expect(cron.status()).toBe(401);

  const signed = await request.get("/api/fotos/signed");
  expect(signed.status()).toBe(400);

  const excluir = await request.delete("/api/galeria/excluir");
  expect(excluir.status()).toBe(401);

  const billing = await request.get("/api/billing/status");
  expect(billing.status()).toBe(401);

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

test("mutações de galeria bloqueiam origem externa", async ({ request }) => {
  const headers = {
    origin: "https://exemplo-malicioso.invalid",
    "sec-fetch-site": "cross-site",
  };

  const acesso = await request.post("/api/galeria/acesso", {
    headers,
    data: { galeria: "00000000-0000-4000-8000-000000000000", senha: "teste" },
  });
  expect(acesso.status()).toBe(403);

  const selecao = await request.post("/api/galeria/selecao", {
    headers,
    data: {
      galeria: "00000000-0000-4000-8000-000000000000",
      fotos: [],
      finalizada: false,
      comentarios: {},
    },
  });
  expect(selecao.status()).toBe(403);

  const entrega = await request.post("/api/galeria/entrega", {
    headers,
    data: { galeria: "00000000-0000-4000-8000-000000000000", acao: "iniciar" },
  });
  expect(entrega.status()).toBe(403);

  const enviar = await request.post("/api/galeria/enviar", {
    headers,
    data: { galeria: "00000000-0000-4000-8000-000000000000" },
  });
  expect(enviar.status()).toBe(403);
});

test("APIs retornam identificador de requisição para correlação", async ({ request }) => {
  const resposta = await request.get("/api/galeria/publica");
  expect(resposta.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/i);
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

test("rotas sensíveis usam nonce sem unsafe-inline em script-src", async ({ request }) => {
  const resposta = await request.get("/login");
  expect(resposta.ok()).toBeTruthy();
  const csp = resposta.headers()["content-security-policy"];
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  const scriptSrc = csp.split(";").find((diretiva) => diretiva.trim().startsWith("script-src "));
  expect(scriptSrc).toBeTruthy();
  expect(scriptSrc).not.toContain("'unsafe-inline'");
  expect(csp).toContain("style-src 'self' 'unsafe-inline'");

  const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  const html = await resposta.text();
  expect(html).toContain(`nonce="${nonce}"`);
});

test("página pública mantém política compatível sem forçar nonce", async ({ request }) => {
  const resposta = await request.get("/");
  const csp = resposta.headers()["content-security-policy"];
  expect(csp).toContain("script-src 'self' 'unsafe-inline'");
  expect(csp).not.toContain("'strict-dynamic'");
});
