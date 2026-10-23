import { expect, test } from "@playwright/test";
import fs from "node:fs";

const arquivo = fs.readFileSync("app/components/PublicProjectLoadingScreen.tsx", "utf8");

const payload = {
  projeto: {
    id: "1e86ef4c-501b-46e8-8ea9-8032554e9d9c",
    nome: "Ensaio ao pôr do sol",
    descricao: null,
    publicRef: "ensaio-1e86ef4c",
    capaUrl: null,
    temSenha: false,
    desbloqueado: true,
    linkExpirado: false,
    abertura: { ativo: false, estilo: "cinematografico", duracao: 21, frase: "", fotos: [], versao: "1" },
  },
  perfil: { nome: "Estúdio", logo: null, cor: "#111222" },
  pastas: [],
};

test("carregamento público é cinematográfico, responsivo e não depende de fotos privadas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/projeto/publico?**", async (route) => {
    // Simula apenas na suíte uma resposta lenta para observar a tela de espera.
    await new Promise((resolve) => setTimeout(resolve, 1400));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });

  await page.goto("/p/ensaio-1e86ef4c");
  const status = page.getByRole("status", { name: "Carregando projeto fotográfico" });
  await expect(status).toBeVisible();
  await expect(status.getByText("Cada momento merece ser revivido.")).toHaveCount(0);
  await expect(status.getByText("Preparando suas fotografias...")).toBeVisible();
  await expect(status.locator(".fpl-progress span")).toHaveCount(1);
  await expect(status).toHaveCSS("background-color", "rgb(13, 14, 25)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await expect(status).toHaveCount(0);
  await expect(page.getByText("Ensaio ao pôr do sol")).toBeVisible();
});

test("recurso respeita redução de movimento e não adiciona atrasos artificiais", () => {
  expect(arquivo).toContain("prefers-reduced-motion: reduce");
  expect(arquivo).toContain('url("/favicon.svg")');
  expect(arquivo).not.toContain("setTimeout");
  expect(arquivo).not.toContain("setInterval");
  const publicPage = fs.readFileSync("app/p/[slug]/page.tsx", "utf8");
  const routeLoading = fs.readFileSync("app/p/[slug]/loading.tsx", "utf8");
  expect(publicPage).toContain("if(carregando)return <PublicProjectLoadingScreen />");
  expect(routeLoading).toContain("<PublicProjectLoadingScreen />");
});
