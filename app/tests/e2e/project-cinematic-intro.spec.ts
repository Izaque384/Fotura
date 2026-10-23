import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { lerAbertura, validarAbertura } from "../../lib/cinematic-intro";

const uuid = "1e86ef4c-501b-46e8-8ea9-8032554e9d9c";
const folder = "304c3059-9afd-492f-ac93-8d286840f16e";
const transparentPixel = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

const exemplo = {
  projeto: {
    id: uuid,
    nome: "Casamento de Ana e Pedro",
    descricao: "Uma tarde para lembrar",
    publicRef: "casamento-ana-pedro-1e86ef4c",
    capaUrl: null,
    temSenha: false,
    desbloqueado: true,
    linkExpirado: false,
    abertura: {
      ativo: true,
      estilo: "cinematografico",
      duracao: 30,
      frase: "Alguns momentos merecem ser revividos.",
      fotos: [{ pastaId: folder, arquivo: "foto-01.jpg", url: transparentPixel }],
      versao: "2026-10-22T14:30:00.000Z",
    },
  },
  perfil: { nome: "Ateliê", logo: null, cor: "#111222" },
  pastas: [{ id: folder, titulo: "Cerimônia", ordem: 0, etapa: "entrega", thumbnailUrl: transparentPixel }],
};

test("valida duração, fotos e mantém a configuração desativada por padrão", () => {
  expect(lerAbertura(null).ativo).toBe(false);
  expect(lerAbertura(null).duracao).toBe(21);
  expect(lerAbertura({ duracao: 6 }).duracao).toBe(21);
  expect(lerAbertura({ duracao: 4 }).duracao).toBe(15);
  expect(lerAbertura({ duracao: 8 }).duracao).toBe(15);
  expect(lerAbertura({ duracao: 12 }).duracao).toBe(21);
  expect(lerAbertura({ duracao: 16 }).duracao).toBe(30);
  expect(validarAbertura({ ...exemplo.projeto.abertura, duracao: 30 })?.duracao).toBe(30);
  expect(validarAbertura({ ...exemplo.projeto.abertura, fotos: [] })).toBeNull();
  expect(validarAbertura({ ...exemplo.projeto.abertura, duracao: 150 })).toBeNull();
  expect(validarAbertura({ ...exemplo.projeto.abertura, fotos: [{ pastaId: folder, arquivo: "../segredo" }] })).toBeNull();
  expect(validarAbertura({ ...exemplo.projeto.abertura })?.ativo).toBe(true);
});

test("abertura reaparece no link em cada visita, e permite voltar, avançar e pular", async ({ page }) => {
  await page.route("**/api/projeto/publico?**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(exemplo) }));
  await page.goto("/p/casamento-ana-pedro-1e86ef4c");
  const tela = page.getByRole("dialog", { name: "Apresentação do projeto" });
  await expect(tela).toBeVisible();
  await expect(page.getByText("Alguns momentos merecem ser revividos.")).toBeVisible();
  await expect(page.locator(".fci-intro h1.fci-title")).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.locator(".fci-eyebrow")).toHaveCSS("color", "rgb(246, 244, 255)");
  await expect(page.locator(".fci-images img")).toHaveCSS("transition-duration", "2.15s");
  await expect(tela.locator(".fci-progress i")).toHaveCount(3);
  await expect(tela.locator(".fci-bottom")).toBeVisible();
  await expect(tela.getByText("UMA EXPERIÊNCIA FOTURA")).toHaveCount(0);
  await expect(tela.getByText("Voltar")).toHaveCount(0);
  await expect(tela.getByText("3 de 3")).toHaveCount(0);
  await expect(tela.getByText("Explorar fotografias")).toHaveCount(0);
  // O único botão visível é o de pular a introdução, no canto superior.
  await expect(tela.getByRole("button")).toHaveCount(1);

  const viewport = page.viewportSize()!;
  const esquerda = viewport.width * 0.24;
  const direita = viewport.width * 0.76;
  const y = viewport.height * 0.55;
  await page.mouse.click(direita, y);
  await expect(tela.getByRole("heading", { name: exemplo.projeto.nome })).toBeVisible();
  await page.mouse.click(esquerda, y);
  await expect(tela.getByRole("heading", { name: exemplo.projeto.abertura.frase })).toBeVisible();
  await page.mouse.click(direita, y);
  await page.mouse.click(direita, y);
  await expect(tela.getByText("Sua história começa aqui.")).toBeVisible();
  // A última cena também avança para a galeria, sem mostrar CTA.
  await page.mouse.click(direita, y);
  await expect(tela).toHaveCount(0);
  await expect(page.getByText("Escolha uma galeria")).toBeVisible();
  await page.reload();
  await expect(tela).toBeVisible();
  await expect(tela.getByRole("heading", { name: exemplo.projeto.abertura.frase })).toBeVisible();
  await page.getByRole("button", { name: /Pular introdução/ }).click();
  await expect(page.getByText("Escolha uma galeria")).toBeVisible();
});

test("navegação por áreas funciona no viewport mobile e pelas setas do teclado", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/projeto/publico?**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(exemplo) }));
  await page.goto("/p/casamento-ana-pedro-1e86ef4c");
  const tela = page.getByRole("dialog", { name: "Apresentação do projeto" });
  await expect(tela).toBeVisible();
  await page.mouse.click(320, 430);
  await expect(tela.getByRole("heading", { name: exemplo.projeto.nome })).toBeVisible();
  await page.mouse.click(70, 430);
  await expect(tela.getByRole("heading", { name: exemplo.projeto.abertura.frase })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(tela.getByRole("heading", { name: exemplo.projeto.nome })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(tela.getByRole("heading", { name: exemplo.projeto.abertura.frase })).toBeVisible();
  await page.getByRole("button", { name: /Pular introdução/ }).click();
  await expect(tela).toHaveCount(0);
});

test("projeto protegido não exibe fotos da introdução antes de desbloquear", async ({ page }) => {
  await page.route("**/api/projeto/publico?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ...exemplo, projeto: { ...exemplo.projeto, temSenha: true, desbloqueado: false, abertura: { ...exemplo.projeto.abertura, ativo: false, fotos: [] } }, pastas: [] }),
  }));
  await page.goto("/p/casamento-ana-pedro-1e86ef4c");
  await expect(page.getByText("PROJETO PROTEGIDO")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Apresentação do projeto" })).toHaveCount(0);
});

test("projeto sem abertura continua indo diretamente para as galerias", async ({ page }) => {
  await page.route("**/api/projeto/publico?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ...exemplo, projeto: { ...exemplo.projeto, abertura: { ...exemplo.projeto.abertura, ativo: false } } }),
  }));
  await page.goto("/p/casamento-ana-pedro-1e86ef4c");
  await expect(page.getByRole("dialog", { name: "Apresentação do projeto" })).toHaveCount(0);
  await expect(page.getByText("Escolha uma galeria")).toBeVisible();
});


test("prévia usa portal e atualiza links das fotografias antes de reproduzir", () => {
  const componente = fs.readFileSync("app/components/ProjectCinematicIntro.tsx", "utf8");
  const editor = fs.readFileSync("app/dashboard/ProjectCinematicSettings.tsx", "utf8");
  expect(componente).toContain('import { createPortal } from "react-dom"');
  expect(componente).toContain("document.body");
  expect(editor).toContain("porPasta[pastaId] = await buscar(pastaId)");
  expect(editor).toContain("setPasta((anterior)");
  expect(editor).toContain('setPreview(selecionadas)');
});
