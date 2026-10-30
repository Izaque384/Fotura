import { expect, test } from "@playwright/test";

const imagem = (nome: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#4a4165"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-size="48">${nome}</text></svg>`)}`;

async function abrirGaleria(page: import("@playwright/test").Page) {
  await page.route("**/api/galeria/publica**", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      galeria: {
        titulo: "Galeria de teste", capa: null, prova: false, etapa: "entrega", limite: 0,
        prazo: null, linkAte: null, temSenha: false, desbloqueada: true, linkExpirado: false,
        downloadAtivo: true, downloadIndividual: true, downloadCompleto: true,
        downloadTamanho: "original", downloadPinNecessario: false,
        watermarkAtivo: false, watermarkTexto: null, watermarkOpacidade: 22, assistenteAtivo: false,
      },
      perfil: { nome: "Estúdio Teste", logo: null, cor: "#14101e" },
      selecao: null, listas: [],
    }),
  }));
  await page.route("**/api/fotos/signed**", route => {
    const url = new URL(route.request().url());
    if(url.searchParams.has("arquivo")){
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ nome: url.searchParams.get("arquivo"), url: imagem("Original") }),
      });
    }
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        fotos: [
          {nome:"ensaio-01.jpg", url:imagem("Prévia 1"), thumb:imagem("Prévia 1")},
          {nome:"ensaio-02.jpg", url:imagem("Prévia 2"), thumb:imagem("Prévia 2")},
        ], capaUrl:null,
      }),
    });
  });
  await page.goto("/g/00000000-0000-4000-8000-000000000022");
  await expect(page.locator(".gc-grid-img")).toHaveCount(2);
}

test("galeria mantém espaçamento original e lightbox com controles e download", async ({ page }) => {
  await abrirGaleria(page);
  const primeiraFoto = page.locator(".gc-grid-img").first();
  await expect(primeiraFoto).toBeVisible();
  await expect(primeiraFoto).not.toHaveAttribute("role", "button");
  await expect(primeiraFoto).not.toHaveAttribute("tabindex", "0");
  const grade=await page.locator(".gc-grid").evaluate(el => ({
    gap:getComputedStyle(el).gap,
    padding:getComputedStyle(el).padding,
  }));
  expect(grade.gap).toBe("1px");
  expect(grade.padding).toBe("0px");
  await primeiraFoto.click();
  const lightbox = page.getByRole("dialog", { name: "Foto 1 de 2" });
  await expect(lightbox).toBeVisible();
  await expect(lightbox.getByText("SUA GALERIA")).toBeVisible();
  await expect(lightbox.getByText("01")).toBeVisible();
  await expect(lightbox.getByRole("button", { name: "Baixar foto original" })).toBeVisible();
  await lightbox.getByRole("button", { name: "Próxima foto" }).click();
  await expect(page.getByRole("dialog", { name: "Foto 2 de 2" })).toBeVisible();
  await lightbox.getByRole("button", { name: "Fechar foto" }).click();
  await expect(page.locator(".gc-lightbox")).toHaveCount(0);
});

test("lightbox mobile evita controles sobrepostos e respeita largura da tela", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrirGaleria(page);
  await page.locator(".gc-grid-img").first().click();
  const lightbox = page.getByRole("dialog", { name: "Foto 1 de 2" });
  await expect(lightbox).toBeVisible();
  await expect(lightbox.getByText("Deslize para ver outras fotos")).toBeVisible();
  const result = await lightbox.evaluate(el => {
    const box = (selector:string) => el.querySelector(selector)!.getBoundingClientRect();
    const meta=box(".gc-lightbox-meta"), download=box(".gc-lightbox-download"),
      close=box(".gc-close"), photo=box(".gc-photo");
    return {
      width:window.innerWidth,
      metaRight:meta.right, downloadLeft:download.left, downloadRight:download.right,
      closeLeft:close.left, closeRight:close.right, photoLeft:photo.left, photoRight:photo.right,
    };
  });
  expect(result.metaRight).toBeLessThan(result.downloadLeft);
  expect(result.downloadRight).toBeLessThan(result.closeLeft);
  expect(result.closeRight).toBeLessThanOrEqual(result.width);
  expect(result.photoLeft).toBeGreaterThanOrEqual(0);
  expect(result.photoRight).toBeLessThanOrEqual(result.width);
  await lightbox.getByRole("button", { name: "Próxima foto" }).click();
  await expect(page.getByRole("dialog", { name: "Foto 2 de 2" })).toBeVisible();
});
