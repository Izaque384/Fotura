import { expect, test, type Page } from "@playwright/test";

const projectId = "1e86ef4c-501b-46e8-8ea9-8032554e9d9c";
const folderId = "304c3059-9afd-492f-ac93-8d286840f16e";
const secondFolder = "304c3059-9afd-492f-ac93-8d286840f16f";
const cover = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'%3E%3Crect width='1200' height='800' fill='%2380526b'/%3E%3C/svg%3E";
const perfil = { nome: "Estúdio", logo: null, cor: "#111222" };
const project = {
  projeto: { id: projectId, nome: "Projeto tela inteira", descricao: "Memórias", publicRef: "projeto-tela-inteira", modelo: "casamento", capaUrl: cover, temSenha: false, desbloqueado: true, linkExpirado: false },
  perfil,
  pastas: [
    { id: folderId, titulo: "Cerimônia", ordem: 0, etapa: "entrega", thumbnailUrl: cover },
    { id: secondFolder, titulo: "Festa", ordem: 1, etapa: "entrega", thumbnailUrl: cover },
  ],
};
async function mock(page: Page) {
  await page.route("**/api/projeto/publico?**", route => route.fulfill({ json: project }));
  await page.route("**/api/galeria/publica**", route => route.fulfill({ json: {
    galeria: { titulo: "Cerimônia", capa: null, prova: false, etapa: "entrega", limite: 0, prazo: null, linkAte: null, temSenha: false, desbloqueada: true, linkExpirado: false, downloadAtivo: false, downloadIndividual: false, downloadCompleto: false, watermarkAtivo: false, watermarkTexto: null, watermarkOpacidade: 22, assistenteAtivo: false },
    perfil, selecao: null, listas: [],
  } }));
  await page.route("**/api/fotos/signed**", route => route.fulfill({ json: { fotos: [{ nome: "foto.jpg", url: cover, thumb: cover, largura: 1200, altura: 800 }], capaUrl: cover } }));
  await page.route("**/api/analytics/event", route => route.fulfill({ json: {} }));
}
async function assertCover(page: Page, heroSelector: string, belowSelector: string, hint: string) {
  const hero = page.locator(heroSelector);
  const next = page.locator(belowSelector);
  await expect(hero.getByText(hint)).toBeVisible();
  await expect(next).toBeAttached();
  await expect.poll(async () => hero.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return Math.abs(rect.height - window.innerHeight);
  })).toBeLessThanOrEqual(1);
  await expect.poll(async () => next.evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(page.viewportSize()!.height - 1);
  await expect(hero.getByText(hint)).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  await next.scrollIntoViewIfNeeded();
  await expect(next).toBeInViewport();
}
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`capa inteira e rolagem nas telas públicas - ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mock(page);
    await page.goto("/p/projeto-tela-inteira");
    await assertCover(page, ".pph-hero", ".pc-home-main", "Role para baixo para ver as galerias");
    await page.getByRole("button", { name: "Abrir galeria Cerimônia" }).click();
    await expect(page.locator(".gc-album-strip")).toBeAttached();
    await page.evaluate(() => window.scrollTo(0, 0));
    await assertCover(page, ".pph-hero", ".gc-album-strip", "Role para baixo para ver as fotos");
    await page.goto(`/g/${folderId}`);
    await assertCover(page, ".gc-hero", ".gc-album-strip", "Role para baixo para ver as fotos");
  });
}
