import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const css = readFileSync("app/internal-visual-system.css", "utf8");
const projectPage = readFileSync("app/dashboard/projetos/page.tsx", "utf8");
const clientsPage = readFileSync("app/dashboard/clientes/page.tsx", "utf8");
const salesPage = readFileSync("app/dashboard/vendas/page.tsx", "utf8");
const workspace = readFileSync("app/dashboard/projetos/[id]/page.tsx", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");

const documentWithStyles = (body: string) => `<!doctype html><html lang="pt-BR">
<head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}html,body{margin:0}
.project-list{display:grid}.project-main{display:grid}.project-cover{display:grid}
.stat,.ftc-stat,.sales-stat{padding:16px;border:1px solid #ddd}
.project-cover img{width:100%;height:100%;object-fit:cover}
${css}
</style></head><body>${body}</body></html>`;

test.describe("Fotura interno — sistema visual unificado", () => {
  test("mantém dados reais, ações e preferência de lista; grade fotográfica é padrão", () => {
    expect(projectPage).toContain('useState<ModoProjetos>("grade")');
    expect(projectPage).toContain('PROJETOS_VISUALIZACAO_KEY = "fotura-projetos-modo-v2"');
    expect(projectPage).toContain('const preferencia=localStorage.getItem(PROJETOS_VISUALIZACAO_KEY)');
    expect(projectPage).toContain('if(preferencia==="lista")setModo("lista")');
    expect(projectPage).toContain('if(preferencia!=="grade")localStorage.setItem(PROJETOS_VISUALIZACAO_KEY,"grade")');
    expect(projectPage).toContain('localStorage.setItem(PROJETOS_VISUALIZACAO_KEY,v)');
    expect(projectPage).not.toContain('localStorage.getItem("fotura-projetos-modo")');
    expect(projectPage).toContain('onClick={()=>mudarModo("lista")}');
    expect(projectPage).toContain('onClick={()=>mudarModo("grade")}');
    expect(projectPage).toContain('aria-label={`Abrir projeto ${p.nome}`}');
    expect(projectPage).toContain('onClick={()=>router.push(`/dashboard/projetos/${p.id}`)}');
    expect(projectPage).toContain('p.capaUrl?<img src={p.capaUrl}');
    expect(projectPage).toContain('loading="lazy" decoding="async"');
    expect(projectPage).toContain('onClick={()=>setProjetoDetalhes(p.id)}');
    expect(projectPage).toContain('supabase.from("galeria_projetos")');
    expect(projectPage).not.toContain("Estúdio Aurora");
    expect(workspace).toContain('p.capaUrl?<img src={p.capaUrl}');
    expect(workspace).toContain('x.capaUrl?<img src={x.capaUrl}');
  });

  test("indicadores coloridos mantêm contagens vindas de Projects, Clients e Sales", () => {
    expect(projectPage).toContain('<InternalMetricIcon name="projects"/>');
    expect(projectPage).toContain('<InternalMetricIcon name="folders"/>');
    expect(projectPage).toContain('<InternalMetricIcon name="photos"/>');
    expect(clientsPage).toContain('<InternalMetricIcon name="clients"/>');
    expect(clientsPage).toContain('<InternalMetricIcon name="selection"/>');
    expect(salesPage).toContain('<InternalMetricIcon name="revenue"/>');
    expect(salesPage).toContain('<InternalMetricIcon name="pending"/>');
    expect(salesPage).toContain('dinheiro(receita)');
    expect(salesPage).toContain("pagas.length");
    expect(clientsPage).toContain("clientes.length");
    expect(layout).toContain('import "./internal-visual-system.css"');
  });

  test("cartão com capa maior, texto abaixo e comandos preservados no desktop", async ({ page }) => {
    await page.setViewportSize({width:1440,height:900});
    await page.setContent(documentWithStyles(`
      <main class="dash projects-page mf-shift">
        <section class="project-list project-grid">
          ${[1,2,3].map(i=>`<article class="project-card">
            <div class="project-main">
              <button class="project-cover" aria-label="Abrir projeto ${i}">
                <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 200'%3E%3Crect width='320' height='200' fill='%23b5b0cf'/%3E%3C/svg%3E" alt="" />
              </button>
              <div class="project-copy"><div class="project-title-line"><h2>Projeto ${i}</h2></div>
              <div class="project-meta">Cliente</div></div>
              <div class="project-actions"><button class="mini primary-mini">Abrir projeto</button><button class="mini">Detalhes</button></div>
            </div></article>`).join("")}
        </section>
      </main>`));
    await expect(page.locator(".project-grid")).toHaveCSS("grid-template-columns", /px/);
    const card = page.locator(".project-card").first();
    await expect(card.locator(".project-main")).toHaveCSS("flex-direction", "column");
    const photo = await card.locator(".project-cover").boundingBox();
    const text = await card.locator(".project-copy").boundingBox();
    expect(photo).not.toBeNull();expect(text).not.toBeNull();
    expect(photo!.width).toBeGreaterThan(250);
    expect(text!.y).toBeGreaterThan(photo!.y+photo!.height-1);
    await expect(card.getByRole("button",{name:"Abrir projeto 1"})).toBeVisible();
    await expect(card.getByRole("button",{name:"Detalhes"})).toBeVisible();
  });

  test("respeita a tela mobile, sem cortar as capas nem causar rolagem horizontal", async ({page})=>{
    await page.setViewportSize({width:390,height:844});
    await page.setContent(documentWithStyles(`
      <main class="dash projects-page mf-shift">
        <section class="project-list project-grid">
          <article class="project-card"><div class="project-main">
            <button class="project-cover" aria-label="Abrir projeto">
              <img alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E" />
            </button>
            <div class="project-copy"><div class="project-title-line"><h2>Casamento e ensaio fotográfico</h2></div></div>
            <div class="project-actions"><button class="mini primary-mini">Abrir projeto</button><button class="mini">Detalhes</button></div>
          </div></article>
        </section>
      </main>`));
    await expect(page.locator(".project-list")).toHaveCSS("grid-template-columns", /390px/);
    const cover = await page.locator(".project-cover").boundingBox();
    expect(cover).not.toBeNull();
    expect(cover!.width/cover!.height).toBeGreaterThan(1.5);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  });

  test("a opção lista também exibe capas ampliadas e preserva as ações", async ({page})=>{
    await page.setViewportSize({width:1440,height:900});
    await page.setContent(documentWithStyles(`
      <main class="dash projects-page mf-shift"><section class="project-list">
        <article class="project-card"><div class="project-main">
          <button class="project-cover" aria-label="Abrir projeto">
            <img alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 200'/%3E"/>
          </button>
          <div class="project-copy"><div class="project-title-line"><h2>Casamento</h2></div></div>
          <div class="project-actions"><button class="mini primary-mini">Abrir projeto</button><button class="mini">Detalhes</button></div>
        </div></article>
      </section></main>`));
    const cover=await page.locator(".project-cover").boundingBox();
    expect(cover).not.toBeNull();
    expect(cover!.width).toBeGreaterThan(150);
    expect(cover!.height).toBeGreaterThan(100);
    await expect(page.getByRole("button",{name:"Detalhes"})).toBeVisible();
  });

  test("os indicadores têm ícones e gradientes em harmonia, sem perder os valores", async ({page})=>{
    await page.setContent(documentWithStyles(`
      <main class="dash projects-page mf-shift">
       <section class="stats">
         <article class="stat"><span class="ft-metric-icon"><svg viewBox="0 0 24 24"></svg></span><strong>5</strong><span>Projetos</span></article>
         <article class="stat"><span class="ft-metric-icon"><svg viewBox="0 0 24 24"></svg></span><strong>11</strong><span>Galerias</span></article>
         <article class="stat"><span class="ft-metric-icon"><svg viewBox="0 0 24 24"></svg></span><strong>4</strong><span>Entregues</span></article>
       </section>
      </main>`));
    await expect(page.locator(".stat")).toHaveCount(3);
    await expect(page.locator(".ft-metric-icon")).toHaveCount(3);
    for(const item of await page.locator(".stat").all()){
      await expect(item).toHaveCSS("background-image",/linear-gradient/);
    }
    await expect(page.locator(".stat").nth(0)).toContainText("5");
    await expect(page.locator(".stat").nth(1)).toContainText("11");
  });

  test("não inclui estilos da landing pública nem animações contínuas", async ({page})=>{
    expect(css).not.toContain(".gc-lightbox");
    expect(css).not.toContain(".lp2-");
    expect(css).not.toMatch(/@keyframes\s+/);
    await page.emulateMedia({reducedMotion:"reduce"});
    await page.setContent(documentWithStyles(`<div class="dash projects-page mf-shift"><div class="project-list project-grid">
      <article class="project-card"><div class="project-main"><button class="project-cover">Capa</button></div></article>
    </div></div>`));
    await expect(page.locator(".project-card")).toHaveCSS("animation-name","none");
  });
});
