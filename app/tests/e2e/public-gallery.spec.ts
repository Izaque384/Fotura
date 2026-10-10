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
          downloadAtivo: true,
          downloadIndividual: true,
          downloadCompleto: true,
          downloadTamanho: "original",
          downloadPinNecessario: false,
          watermarkAtivo: false,
          watermarkTexto: null,
          watermarkOpacidade: 22,
          assistenteAtivo: false,
        },
        perfil: { nome: "Estúdio Teste", logo: null, cor: "#0b0b1a" },
        selecao: null,
        listas: [],
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

  await page.goto("/g/00000000-0000-4000-8000-000000000001");
  await expect(page.getByRole("heading", { name: "Ensaio E2E" })).toBeVisible();
  await expect(page.getByText("2 fotos")).toBeVisible();
  await expect(page.locator(".gc-grid-col")).toHaveCount(4);
  await expect(page.locator(".gc-grid-img").first()).toHaveAttribute("loading", "eager");

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
  const confirmacao = page.locator(".gc-confirm-card");
  await expect(confirmacao.getByRole("heading", { name: "Finalizar seleção?" })).toBeVisible();
  await confirmacao.getByRole("button", { name: "Finalizar seleção" }).click();

  await expect(page.getByText("Seleção enviada — 2 fotos")).toBeVisible();
  await expect.poll(() => salvamentos.at(-1)?.finalizada).toBe(true);
  expect(salvamentos.at(-1)?.fotos).toEqual(["foto-1.jpg", "foto-2.jpg"]);
  expect(salvamentos.at(-1)?.comentarios["foto-1.jpg"]).toBe("Minha favorita");
});

test("lightbox de entrega carrega a foto original antes de exibir", async ({ page }) => {
  await page.route("**/api/galeria/publica**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        galeria: {
          titulo: "Entrega em alta",
          capa: null,
          prova: false,
          limite: 0,
          prazo: null,
          linkAte: null,
          temSenha: false,
          desbloqueada: true,
          linkExpirado: false,
          downloadAtivo: true,
          downloadIndividual: true,
          downloadCompleto: true,
          downloadTamanho: "original",
          downloadPinNecessario: false,
          watermarkAtivo: false,
          watermarkTexto: null,
          watermarkOpacidade: 22,
          assistenteAtivo: false,
        },
        perfil: { nome: "Estúdio Teste", logo: null, cor: "#0b0b1a" },
        selecao: null,
        listas: [],
      }),
    });
  });

  await page.route("**/api/fotos/signed**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("arquivo")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ nome: "foto.jpg", url: foto("Original em alta") }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        fotos: [{ nome: "foto.jpg", url: foto("Miniatura"), thumb: foto("Miniatura") }],
        capaUrl: null,
      }),
    });
  });

  await page.goto("/g/00000000-0000-4000-8000-000000000002");
  await page.locator(".gc-card img").click();
  await expect(page.getByRole("dialog", { name: "Foto 1 de 1" })).toBeVisible();
  await expect(page.locator(".gc-photo img")).toHaveAttribute("src", /Original%20em%20alta/);
  await expect(page.getByRole("button", { name: "Baixar foto original" })).toBeVisible();
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
          downloadAtivo: true,
          downloadIndividual: true,
          downloadCompleto: true,
          downloadTamanho: "original",
          downloadPinNecessario: false,
          watermarkAtivo: false,
          watermarkTexto: null,
          watermarkOpacidade: 22,
          assistenteAtivo: false,
        },
        perfil: { nome: "Estúdio Teste", logo: null, cor: "#0b0b1a" },
        selecao: null,
        listas: [],
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

  await page.goto("/g/00000000-0000-4000-8000-000000000003");
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
          downloadAtivo: true,
          downloadIndividual: true,
          downloadCompleto: true,
          downloadTamanho: "original",
          downloadPinNecessario: false,
          watermarkAtivo: false,
          watermarkTexto: null,
          watermarkOpacidade: 22,
          assistenteAtivo: false,
        },
        perfil: { nome: "Estúdio Teste", logo: null, cor: "#0b0b1a" },
        selecao: null,
        listas: [],
      }),
    });
  });

  await page.goto("/g/00000000-0000-4000-8000-000000000004");
  await expect(page.getByRole("heading", { name: "Este link expirou" })).toBeVisible();
  await expect(page.getByText("O prazo de acesso a esta galeria terminou.")).toBeVisible();
});


test("cliente cria lista auxiliar sem alterar a seleção final", async ({ page }) => {
  const lista = { id: "10000000-0000-4000-8000-000000000001", nome: "Álbum", fotos: [] as string[], comentarios: {}, finalizada: false };

  await page.route("**/api/galeria/publica**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        galeria: {
          titulo: "Listas E2E", capa: null, prova: true, limite: 5, prazo: null, linkAte: null,
          temSenha: false, desbloqueada: true, linkExpirado: false, etapa: "prova",
          downloadAtivo: true, downloadIndividual: true, downloadCompleto: true, downloadTamanho: "original",
          downloadPinNecessario: false, watermarkAtivo: false, watermarkTexto: null, watermarkOpacidade: 22, assistenteAtivo: false,
        },
        perfil: { nome: "Estúdio Teste", logo: null, cor: "#0b0b1a" },
        selecao: null,
        listas: [],
      }),
    });
  });
  await page.route("**/api/fotos/signed**", async (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ fotos: [{ nome: "foto.jpg", url: foto("Foto"), thumb: foto("Foto") }], capaUrl: null }),
  }));
  await page.route("**/api/galeria/listas", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ lista }) });
      return;
    }
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as { fotos: string[] };
      lista.fotos = body.fotos;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ lista }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ listas: [lista] }) });
  });
  let principalAlterada = false;
  await page.route("**/api/galeria/selecao", async (route) => {
    principalAlterada = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/g/00000000-0000-4000-8000-000000000006");
  await page.getByRole("button", { name: "+ Nova lista" }).click();
  await page.getByPlaceholder("Ex: Álbum, Família, Redes sociais").fill("Álbum");
  await page.getByRole("button", { name: "Criar", exact: true }).click();
  await expect(page.locator(".gc-listbar select")).toHaveValue(lista.id);
  await page.locator(".gc-card").getByRole("button", { name: "Selecionar" }).click();
  await expect.poll(() => lista.fotos).toEqual(["foto.jpg"]);
  expect(principalAlterada).toBe(false);
});

test("download protegido pede PIN e retoma após validação", async ({ page }) => {
  await page.route("**/api/galeria/publica**", async (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      galeria: {
        titulo: "Entrega com PIN", capa: null, prova: false, limite: 0, prazo: null, linkAte: null,
        temSenha: false, desbloqueada: true, linkExpirado: false, etapa: "entrega",
        downloadAtivo: true, downloadIndividual: true, downloadCompleto: true, downloadTamanho: "original",
        downloadPinNecessario: true, watermarkAtivo: false, watermarkTexto: null, watermarkOpacidade: 22, assistenteAtivo: false,
      },
      perfil: { nome: "Estúdio Teste", logo: null, cor: "#0b0b1a" },
      selecao: null, listas: [],
    }),
  }));
  await page.route("**/api/fotos/signed**", async (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ fotos: [{ nome: "foto.jpg", url: foto("Foto"), thumb: foto("Foto") }], capaUrl: null }),
  }));
  let liberado = false;
  await page.route("**/api/galeria/download?**", async (route) => {
    if (!liberado) {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "PIN necessário.", pinNecessario: true }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: foto("Download"), nome: "foto.jpg" }) });
  });
  await page.route("**/api/galeria/download-pin", async (route) => {
    const body = route.request().postDataJSON() as { pin: string };
    if (body.pin !== "4827") {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "PIN incorreto." }) });
      return;
    }
    liberado = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/g/00000000-0000-4000-8000-000000000007");
  await page.locator(".gc-card img").click();
  await page.getByRole("button", { name: "Baixar foto original" }).click();
  await expect(page.getByRole("heading", { name: "PIN para download" })).toBeVisible();
  await page.getByPlaceholder("PIN").fill("4827");
  await page.getByRole("button", { name: "Liberar download" }).click();
  await expect(page.getByRole("heading", { name: "PIN para download" })).toHaveCount(0);
});


test("watermark endpoint rejeita token inválido sem tocar no Storage", async ({ request }) => {
  const response = await request.get("/api/fotos/watermark?token=bad");
  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({ error: "Prévia inválida ou expirada." });
});
