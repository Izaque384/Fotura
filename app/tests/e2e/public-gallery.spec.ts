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

test("lightbox exibe a miniatura imediatamente e troca para o original quando pronto", async ({ page }) => {
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
      await new Promise(resolve => setTimeout(resolve, 450));
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
  await expect(page.locator(".gc-photo img")).toHaveAttribute("src", foto("Miniatura"));
  await expect(page.locator(".gc-photo img")).toHaveAttribute("src", /Original%20em%20alta/, { timeout: 3000 });
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


test("galeria pública não exibe listas auxiliares ao cliente", async ({ page }) => {
  await page.route("**/api/galeria/publica**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        galeria: {
          titulo: "Seleção E2E", capa: null, prova: true, limite: 5, prazo: null, linkAte: null,
          temSenha: false, desbloqueada: true, linkExpirado: false, etapa: "prova",
          downloadAtivo: true, downloadIndividual: true, downloadCompleto: true, downloadTamanho: "original",
          downloadPinNecessario: false, watermarkAtivo: false, watermarkTexto: null, watermarkOpacidade: 22, assistenteAtivo: false,
        },
        perfil: { nome: "Estúdio Teste", logo: null, cor: "#0b0b1a" },
        selecao: null,
        listas: [{ id: "10000000-0000-4000-8000-000000000001", nome: "Álbum", fotos: [], comentarios: {}, finalizada: false }],
      }),
    });
  });
  await page.route("**/api/fotos/signed**", async (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ fotos: [{ nome: "foto.jpg", url: foto("Foto"), thumb: foto("Foto") }], capaUrl: null }),
  }));

  await page.goto("/g/00000000-0000-4000-8000-000000000006");
  await expect(page.getByText("Lista de favoritos")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "+ Nova lista" })).toHaveCount(0);
  await expect(page.locator(".gc-listbar")).toHaveCount(0);
  await expect(page.locator(".gc-card").getByRole("button", { name: "Selecionar" })).toBeVisible();
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


test("fotos começam a carregar enquanto os dados da galeria estão pendentes", async ({ page }) => {
  let liberar!: () => void;
  const espera = new Promise<void>(resolve => { liberar = resolve; });
  let fotosSolicitadas = false;
  await page.route("**/api/galeria/resolve**", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ id: "00000000-0000-4000-8000-000000000001" }),
  }));
  await page.route("**/api/galeria/publica**", async route => {
    await espera;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      galeria: { titulo: "Galeria paralela", prova: true, limite: 0, desbloqueada: true, linkExpirado: false },
      perfil: { nome: "Estúdio", logo: null, cor: null }, selecao: null,
    }) });
  });
  await page.route("**/api/fotos/signed**", async route => {
    fotosSolicitadas = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      fotos: [{ nome: "foto.jpg", url: foto("Original"), thumb: foto("Prévia") }], capaUrl: null,
    }) });
  });
  await page.goto("/g/00000000-0000-4000-8000-000000000001");
  try { await expect.poll(() => fotosSolicitadas).toBe(true); }
  finally { liberar(); }
  await expect(page.getByRole("heading", { name: "Galeria paralela" })).toBeVisible();
  await expect(page.locator(".gc-grid-img")).toHaveAttribute("src", foto("Prévia"));
});


for (const width of [390, 1440]) {
  test(`logo fica na faixa branca e hero global do projeto prevalece (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const pastaId = "00000000-0000-4000-8000-000000000001";
    await page.route("**/api/projeto/publico**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      projeto: { id: "00000000-0000-4000-8000-000000000002", nome: "Casamento", publicRef: "casamento", capaUrl: foto("Projeto"), desbloqueado: true },
      perfil: { nome: "Alvor Fotografia", logo: foto("Logo"), cor: null },
      pastas: [{ id: pastaId, titulo: "Entrada da Noiva", ordem: 0, etapa: "entrega", thumbnailUrl: foto("Pasta") }],
    }) }));
    await page.route("**/api/galeria/publica**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      galeria: { titulo: "Entrada da Noiva", capa: "capa.jpg", prova: false, desbloqueada: true, linkExpirado: false },
      perfil: { nome: "Alvor Fotografia", logo: foto("Logo"), cor: null }, selecao: null,
    }) }));
    await page.route("**/api/fotos/signed**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      fotos: [{ nome: "capa.jpg", url: foto("Original"), thumb: foto("Pasta") }], capaUrl: foto("Pasta"),
    }) }));
    await page.route("**/api/analytics/event", route => route.fulfill({ status: 200, body: "{}" }));
    await page.goto(`/p/casamento?pasta=${pastaId}`);
    await expect(page.locator(".gc-album-logo img")).toBeVisible({timeout:15000});
    await expect(page.locator(".gc-hero img")).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Trocar galeria" })).toHaveValue(pastaId);
    await expect(page.locator(".pph-bg")).toHaveAttribute("style", /Projeto/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/fotura-cover-strip-${width}.png`, fullPage: false });
  });
}


test("trocar de pasta reutiliza a grade assinada já carregada na sessão", async ({ page }) => {
  const projetoId = "33333333-3333-4333-8333-333333333333";
  const pastaA = "11111111-1111-4111-8111-111111111111";
  const pastaB = "22222222-2222-4222-8222-222222222222";
  const chamadas: Record<string, number> = {};

  await page.route("**/api/projeto/publico**", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      projeto: { id: projetoId, nome: "Projeto Cache", descricao: null, publicRef: "projeto-cache", capaUrl: null, temSenha: false, desbloqueado: true, linkExpirado: false },
      perfil: { nome: "Estúdio Cache", logo: null, cor: "#25213c" },
      pastas: [
        { id: pastaA, titulo: "Pasta A", ordem: 0, etapa: "entrega", thumbnailUrl: foto("A") },
        { id: pastaB, titulo: "Pasta B", ordem: 1, etapa: "entrega", thumbnailUrl: foto("B") },
      ],
    }),
  }));
  await page.route("**/api/galeria/publica**", route => {
    const id = new URL(route.request().url()).searchParams.get("galeria")!;
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        galeria: {
          titulo: id === pastaA ? "Pasta A" : "Pasta B", capa: null, prova: false, limite: 0, prazo: null, linkAte: null,
          temSenha: false, desbloqueada: true, linkExpirado: false, etapa: "entrega",
          downloadAtivo: true, downloadIndividual: true, downloadCompleto: true, downloadTamanho: "original",
          downloadPinNecessario: false, watermarkAtivo: false, watermarkTexto: null, watermarkOpacidade: 22, assistenteAtivo: false,
        },
        perfil: { nome: "Estúdio Cache", logo: null, cor: "#25213c" }, selecao: null,
      }),
    });
  });
  await page.route("**/api/fotos/signed**", route => {
    const url = new URL(route.request().url());
    const id = url.searchParams.get("galeria")!;
    if (url.searchParams.get("modo") === "grade") chamadas[id] = (chamadas[id] ?? 0) + 1;
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ fotos: [{ nome: id + ".jpg", url: foto(id), thumb: foto(id), largura: 1200, altura: 800 }], capaUrl: null }),
    });
  });
  await page.route("**/api/analytics/event", route => route.fulfill({ status: 200, body: "{}" }));

  await page.goto(`/p/projeto-cache?pasta=${pastaA}`);
  const seletor = page.getByRole("combobox", { name: "Trocar galeria" });
  await expect(seletor).toHaveValue(pastaA);
  await seletor.selectOption(pastaB);
  await expect(seletor).toHaveValue(pastaB);
  await seletor.selectOption(pastaA);
  await expect(seletor).toHaveValue(pastaA);
  await expect.poll(() => chamadas[pastaA]).toBe(1);
  await expect.poll(() => chamadas[pastaB]).toBe(1);
});

test("tutorial do projeto ensina apenas seletor e download em lote", async ({ page }) => {
  const projetoId = "44444444-4444-4444-8444-444444444444";
  const pasta = "55555555-5555-4555-8555-555555555555";

  await page.route("**/api/projeto/publico**", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      projeto: { id: projetoId, nome: "Projeto Tutorial", descricao: null, publicRef: "projeto-tutorial", capaUrl: null, temSenha: false, desbloqueado: true, linkExpirado: false },
      perfil: { nome: "Estúdio Tutorial", logo: null, cor: "#25213c" },
      pastas: [{ id: pasta, titulo: "Galeria Única", ordem: 0, etapa: "entrega", thumbnailUrl: foto("Capa") }],
    }),
  }));
  await page.route("**/api/galeria/publica**", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      galeria: {
        titulo: "Galeria Única", capa: null, prova: false, limite: 0, prazo: null, linkAte: null,
        temSenha: false, desbloqueada: true, linkExpirado: false, etapa: "entrega",
        downloadAtivo: true, downloadIndividual: true, downloadCompleto: true, downloadTamanho: "original",
        downloadPinNecessario: false, watermarkAtivo: false, watermarkTexto: null, watermarkOpacidade: 22, assistenteAtivo: true,
      },
      perfil: { nome: "Estúdio Tutorial", logo: null, cor: "#25213c" }, selecao: null,
    }),
  }));
  await page.route("**/api/fotos/signed**", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ fotos: [{ nome: "foto.jpg", url: foto("Foto"), thumb: foto("Foto"), largura: 1200, altura: 800 }], capaUrl: null }),
  }));
  await page.route("**/api/analytics/event", route => route.fulfill({ status: 200, body: "{}" }));

  await page.goto(`/p/projeto-tutorial?pasta=${pasta}`);
  const tutorial = page.getByRole("dialog", { name: "Tutorial rápido" });
  await expect(tutorial).toBeVisible();
  await expect(tutorial.getByText("Troque de galeria aqui")).toBeVisible();
  await tutorial.getByRole("button", { name: /Próximo/ }).click();
  await expect(tutorial.getByText("Baixe a galeria inteira")).toBeVisible();
  await expect(page.getByRole("button", { name: "Baixar todas" })).toBeVisible();
  await tutorial.getByRole("button", { name: /Concluir/ }).click();
  await expect(tutorial).toHaveCount(0);
});

test("masonry mantém todas as colunas ocupadas quando há fotos suficientes", async ({ page }) => {
  await page.route("**/api/galeria/publica**", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      galeria: {
        titulo: "Masonry", capa: null, prova: false, limite: 0, prazo: null, linkAte: null,
        temSenha: false, desbloqueada: true, linkExpirado: false, etapa: "entrega",
        downloadAtivo: true, downloadIndividual: true, downloadCompleto: true, downloadTamanho: "original",
        downloadPinNecessario: false, watermarkAtivo: false, watermarkTexto: null, watermarkOpacidade: 22, assistenteAtivo: false,
      },
      perfil: { nome: "Estúdio", logo: null, cor: "#25213c" }, selecao: null,
    }),
  }));
  await page.route("**/api/fotos/signed**", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      fotos: Array.from({ length: 8 }, (_, i) => ({
        nome: `foto-${i}.jpg`, url: foto(`Foto ${i}`), thumb: foto(`Foto ${i}`),
        largura: i % 3 === 0 ? 800 : 1200, altura: i % 3 === 0 ? 1200 : 800,
      })),
      capaUrl: null,
    }),
  }));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/g/66666666-6666-4666-8666-666666666666");
  await expect(page.locator(".gc-grid-col")).toHaveCount(4);
  for (let i = 0; i < 4; i++) await expect(page.locator(".gc-grid-col").nth(i).locator(".gc-card")).not.toHaveCount(0);
});
