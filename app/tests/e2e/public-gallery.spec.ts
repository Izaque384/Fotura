import { expect, test } from "@playwright/test";

const foto = (label: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="100%" height="100%" fill="#15152b"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="42">${label}</text></svg>`)}`;

test("cliente seleciona, comenta e finaliza uma prova", async ({ page }) => {
  const salvamentos: Array<{ fotos: string[]; finalizada: boolean; comentarios: Record<string, string> }> = [];

  await page.route("**/api/galeria/publica**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        galeria: {
          titulo: "Ensaio E2E",
          capa: null,
          prova: true,
          limite: 2,
          prazo: null,
          linkAte: null,
          temSenha: false,
          desbloqueada: true,
          linkExpirado: false,
        },
        perfil: { nome: "Estúdio Teste", logo: null, cor: "#0b0b1a" },
        selecao: null,
      }),
    });
  });

  await page.route("**/api/fotos/signed**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        fotos: [
          { nome: "foto-1.jpg", url: foto("Foto 1"), thumb: foto("Foto 1") },
          { nome: "foto-2.jpg", url: foto("Foto 2"), thumb: foto("Foto 2") },
        ],
        capaUrl: null,
      }),
    });
  });

  await page.route("**/api/galeria/selecao", async (route) => {
    const body = route.request().postDataJSON() as { fotos: string[]; finalizada: boolean; comentarios: Record<string, string> };
    salvamentos.push(body);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/g/galeria-e2e");
  await expect(page.getByRole("heading", { name: "Ensaio E2E" })).toBeVisible();
  await expect(page.getByText("2 fotos")).toBeVisible();

  const cards = page.locator(".gc-card");
  await cards.nth(0).getByRole("button", { name: "Selecionar" }).click();
  await expect(page.getByText("1 / 2 selecionada")).toBeVisible();

  await cards.nth(0).locator("img").click();
  await page.getByPlaceholder("Comente nesta foto…").fill("Minha favorita");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.locator(".gc-lightbox")).toHaveCount(0);

  await cards.nth(1).getByRole("button", { name: "Selecionar" }).click();
  await expect(page.getByText("2 / 2 selecionadas")).toBeVisible();

  await page.locator(".gc-bar").getByRole("button", { name: "Finalizar seleção" }).click();
  const dialog = page.getByRole("dialog", { name: "Finalizar seleção?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Finalizar seleção" }).click();

  await expect(page.getByText("Seleção enviada — 2 fotos")).toBeVisible();
  await expect.poll(() => salvamentos.at(-1)?.finalizada).toBe(true);
  expect(salvamentos.at(-1)?.fotos).toEqual(["foto-1.jpg", "foto-2.jpg"]);
  expect(salvamentos.at(-1)?.comentarios["foto-1.jpg"]).toBe("Minha favorita");
});

test("senha incorreta não libera a galeria e senha correta libera", async ({ page }) => {
  let desbloqueada = false;

  await page.route("**/api/galeria/publica**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        galeria: {
          titulo: "Galeria protegida E2E",
          capa: null,
          prova: false,
          limite: 0,
          prazo: null,
          linkAte: null,
          temSenha: true,
          desbloqueada,
          linkExpirado: false,
        },
        perfil: { nome: "Estúdio Teste", logo: null, cor: "#0b0b1a" },
        selecao: null,
      }),
    });
  });

  await page.route("**/api/galeria/acesso", async (route) => {
    const body = route.request().postDataJSON() as { senha: string };
    if (body.senha !== "correta123") {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Senha incorreta." }) });
      return;
    }
    desbloqueada = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.route("**/api/fotos/signed**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ fotos: [{ nome: "foto.jpg", url: foto("Liberada"), thumb: foto("Liberada") }], capaUrl: null }),
    });
  });

  await page.goto("/g/protegida-e2e");
  await expect(page.getByRole("heading", { name: "Galeria protegida" })).toBeVisible();

  const senha = page.getByPlaceholder("Senha");
  await senha.fill("errada");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Senha incorreta. Tente novamente.")).toBeVisible();

  await senha.fill("correta123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Galeria protegida E2E" })).toBeVisible();
  await expect(page.getByText("1 foto")).toBeVisible();
});

test("link expirado mostra estado bloqueado", async ({ page }) => {
  await page.route("**/api/galeria/publica**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        galeria: {
          titulo: "Galeria expirada",
          capa: null,
          prova: true,
          limite: 0,
          prazo: null,
          linkAte: "2020-01-01",
          temSenha: false,
          desbloqueada: true,
          linkExpirado: true,
        },
        perfil: { nome: "Estúdio Teste", logo: null, cor: "#0b0b1a" },
        selecao: null,
      }),
    });
  });

  await page.goto("/g/expirada-e2e");
  await expect(page.getByRole("heading", { name: "Este link expirou" })).toBeVisible();
  await expect(page.getByText("O prazo de acesso a esta galeria terminou.")).toBeVisible();
});
