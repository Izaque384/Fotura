import { expect, test } from "@playwright/test";
import fs from "node:fs";

const listagem = fs.readFileSync("app/dashboard/projetos/page.tsx", "utf8");
const detalhe = fs.readFileSync("app/dashboard/projetos/[id]/page.tsx", "utf8");
const cssDaListagem = listagem.match(/const css=`([\s\S]*?)`;\s*$/)?.[1];
const cssDoProjeto = detalhe.match(/const css=`([\s\S]*?)`;\s*$/)?.[1];

test("métricas aparecem no desktop e somem somente no mobile", async ({ page }) => {
  expect(cssDaListagem).toBeTruthy();
  expect(listagem).toContain('className="stats"');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><style>${cssDaListagem}</style><main class="projects-page"><section class="stats"><div class="stat">3 projetos</div><div class="stat">8 pastas</div></section></main>`);
  await expect(page.locator(".stats")).toHaveCSS("display", "grid");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".stats")).toBeHidden();
});

test("cards de projetos deixam de repetir a descrição em lista e grade", () => {
  expect(listagem).not.toContain('<p>{p.descricao||clienteNome(p.cliente_id)}</p>');
  expect(listagem).toContain('className="project-meta"');
  // A descrição segue disponível para busca e edição, mas não ocupa os cards.
  expect(listagem).toContain('(p.descricao??"").toLocaleLowerCase');
  expect(listagem).toContain('value={descricao}');
  expect(listagem).toContain('modo==="grade"?"project-grid":""');
});

test("capa e visão geral do projeto cabem no mobile sem rolagem horizontal", async ({ page }) => {
  expect(cssDoProjeto).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0}*{box-sizing:border-box}${cssDoProjeto}</style>
    <main class="pw-page"><div class="pw-shell"><div class="pw-overview-grid">
      <article class="pw-overview-card pw-project-summary">
        <div class="pw-summary-cover"><img width="1920" height="2880" alt="Capa" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1920' height='2880'/%3E" /></div>
        <div class="pw-summary-copy"><span>VISÃO GERAL</span><h2>Entregue</h2>
          <p>Uma celebração de amor, encontros e memórias que serão carregadas pela vida toda.</p>
          <div class="pw-summary-meta"><span>6 publicadas</span><span>6 entregues</span></div>
          <button class="pw-link-button">Gerenciar pastas</button>
        </div>
      </article>
      <article class="pw-overview-card">Link do cliente</article>
    </div></div></main>`);
  const metrics = await page.evaluate(() => {
    const card = document.querySelector(".pw-project-summary")!.getBoundingClientRect();
    const cover = document.querySelector(".pw-summary-cover")!.getBoundingClientRect();
    const copy = document.querySelector(".pw-summary-copy")!.getBoundingClientRect();
    return { scroll: document.documentElement.scrollWidth, viewport: window.innerWidth, cardRight: card.right, coverHeight: cover.height, coverWidth: cover.width, copyTop: copy.top, coverBottom: cover.bottom };
  });
  expect(metrics.scroll).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.cardRight).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.coverHeight).toBeLessThanOrEqual(270);
  expect(metrics.coverWidth).toBeLessThanOrEqual(metrics.viewport - 28);
  expect(metrics.copyTop).toBeGreaterThanOrEqual(metrics.coverBottom);
});
