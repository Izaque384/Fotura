import {expect, test} from "@playwright/test";
import {readFileSync} from "node:fs";

test.describe("Prévia isolada da Visão Geral do Fotura",()=>{
  test("mantém o dashboard real inalterado e não indexa a demonstração",()=>{
    const dashboard=readFileSync("app/dashboard/page.tsx","utf8");
    const preview=readFileSync("app/painel-conceito/page.tsx","utf8");
    const demo=readFileSync("app/painel-conceito/DashboardConcept.tsx","utf8");
    expect(dashboard).toContain("DashboardActionCenter");
    expect(dashboard).toContain("calcularGraficosDashboard");
    expect(dashboard).not.toContain("DashboardConcept");
    expect(preview).toContain("index: false");
    expect(demo).not.toContain("createClient");
    expect(demo).not.toContain("/api/");
    expect(demo).toContain("Dados ilustrativos");
  });

  test("renderiza estrutura atual com nova hierarquia e dados fictícios",async({page})=>{
    await page.goto("/pt/painel-conceito");
    await expect(page.getByRole("heading",{name:/Sua visão geral/})).toBeVisible();
    await expect(page.getByRole("heading",{name:"Tudo em dia por aqui."})).toBeVisible();
    await expect(page.getByRole("heading",{name:"Total de projetos"})).toBeVisible();
    await expect(page.getByRole("heading",{name:"Etapas dos projetos"})).toBeVisible();
    await expect(page.getByRole("heading",{name:"Seleções aguardando cliente"})).toBeVisible();
    await expect(page.getByRole("heading",{name:"Projetos recentes"})).toBeVisible();
    await expect(page.getByText("Estúdio Aurora")).toBeVisible();
    await expect(page.getByText(/Dados ilustrativos/)).toBeVisible();
    await expect(page.locator(".fcp-bar-column")).toHaveCount(6);
    await expect(page.locator(".fcp-legend-row")).toHaveCount(6);
    await expect(page.locator("meta[name='robots']")).toHaveAttribute("content",/noindex/);
  });

  test("alternância entre projetos e galerias recalcula métricas e legenda",async({page})=>{
    await page.goto("/pt/painel-conceito");
    const projetos=page.getByRole("button",{name:"Projetos",exact:true}).last();
    const galerias=page.getByRole("button",{name:"Galerias",exact:true});
    await expect(projetos).toHaveAttribute("aria-pressed","true");
    await expect(page.locator(".fcp-donut-hole strong")).toHaveText("5");
    await galerias.click();
    await expect(galerias).toHaveAttribute("aria-pressed","true");
    await expect(page.locator(".fcp-donut-hole strong")).toHaveText("12");
    await expect(page.getByRole("heading",{name:"Total de galerias"})).toBeVisible();
    await projetos.click();
    await expect(page.locator(".fcp-donut-hole strong")).toHaveText("5");
  });

  test("botão novo projeto não cria dados e explica tratar-se de uma prévia",async({page})=>{
    await page.goto("/pt/painel-conceito");
    await page.getByRole("button",{name:/Novo projeto/}).click();
    const modal=page.getByRole("dialog",{name:/Um novo visual para o seu espaço/});
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("Não cria projetos nem altera informações");
    await expect(modal.getByRole("link",{name:/Criar projeto no Fotura atual/})).toHaveAttribute("href",/foturax.com.br/);
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
  });

  test("menu mobile abre e fecha sem causar rolagem horizontal",async({page})=>{
    await page.setViewportSize({width:390,height:844});
    await page.goto("/pt/painel-conceito");
    const menu=page.getByRole("button",{name:"Abrir menu"});
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(page.locator(".fcp-sidebar")).toHaveClass(/is-open/);
    await page.locator(".fcp-mobile-backdrop").click({position:{x:375,y:100}});
    await expect(page.locator(".fcp-sidebar")).not.toHaveClass(/is-open/);
    const sizes=await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
    expect(sizes.document).toBeLessThanOrEqual(sizes.viewport+1);
    await expect(page.locator(".fcp-charts")).toBeVisible();
  });

  test("prefers-reduced-motion respeitado e gráficos continuam legíveis",async({page})=>{
    await page.emulateMedia({reducedMotion:"reduce"});
    await page.goto("/pt/painel-conceito");
    await expect(page.locator(".fcp-bar-fill").first()).toHaveCSS("transition-duration","0s");
    await expect(page.locator(".fcp-donut")).toBeVisible();
    await expect(page.getByRole("button",{name:"Atividade recente"})).toBeVisible();
  });
});
