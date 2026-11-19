import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const css = readFileSync("app/internal-visual-system.css", "utf8");
const premiumCss = readFileSync("app/dashboard/overview-premium.css", "utf8");
const globalsCss = readFileSync("app/globals.css", "utf8");
const sharedHoverCss = globalsCss.slice(
  globalsCss.indexOf("/* Linguagem global de hover"),
  globalsCss.indexOf("/* Shared authenticated shell")
);
const projectPage = readFileSync("app/dashboard/projetos/page.tsx", "utf8");
const workspace = readFileSync("app/dashboard/projetos/[id]/page.tsx", "utf8");
const workspaceCss = readFileSync("app/dashboard/project-info-section.css", "utf8");
const clientsPage = readFileSync("app/dashboard/clientes/page.tsx", "utf8");
const salesPage = readFileSync("app/dashboard/vendas/page.tsx", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");

const documentWithStyles = (body: string, extra = "") => `<!doctype html><html lang="pt-BR">
<head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}html,body{margin:0}
.project-list{display:grid}.project-main{display:grid}.project-cover{display:grid}
.stat,.ftc-stat,.sales-stat{padding:16px;border:1px solid #ddd}
.project-cover img{width:100%;height:100%;object-fit:cover}
${css}
${extra}
</style></head><body>${body}</body></html>`;

function cards(count: number){
  return Array.from({ length: count }, (_,i)=>`<a class="project-card" href="#projeto-${i+1}" aria-label="Abrir projeto ${i+1}">
    <div class="project-main">
      <div class="project-cover"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 200'%3E%3Crect width='320' height='200' fill='%23b5b0cf'/%3E%3C/svg%3E" alt=""/></div>
      <div class="project-copy">
        <div class="project-title-line"><h2>Projeto ${i+1}</h2><span class="count-badge">2 galerias</span></div>
        <div class="project-meta">Cliente de exemplo</div>
      </div>
    </div>
  </a>`).join("");
}

test.describe("Fotura interno — projetos foto-first, sem lista nem drawer", () => {
  test("Projetos têm somente grade, cartão inteiro clicável e nenhuma preferência antiga",()=>{
    expect(projectPage).toContain('className="project-list project-grid"');
    expect(projectPage).toContain('import Link from "next/link"');
    expect(projectPage).toContain('<Link className="project-card" href={`/dashboard/projetos/${p.id}`}');
    expect(projectPage).toContain('aria-label={`Abrir projeto ${p.nome}`}');
    expect(projectPage).toContain('p.capaUrl?<img src={p.capaUrl}');
    expect(projectPage).toContain('loading="lazy" decoding="async"');
    expect(projectPage).not.toContain('role="group" aria-label="Visualização dos projetos"');
    expect(projectPage).not.toContain('mudarModo(');
    expect(projectPage).not.toContain('fotura-projetos-modo');
    expect(projectPage).not.toContain('<FoturaDrawer');
    expect(projectPage).not.toContain('setProjetoDetalhes');
    expect(projectPage).not.toContain('className="project-actions"');
    expect(projectPage).not.toContain('>Detalhes</button>');
    expect(projectPage).toContain('supabase.from("galeria_projetos")');
  });

  test("workspace incorpora dados da antiga tela Detalhes e mantém edição real",()=>{
    expect(workspace).toContain('id="pw-project-info-title">Detalhes do projeto');
    expect(workspace).toContain('aria-label');
    expect(workspace).toContain('onClick={abrirConfiguracoes}');
    expect(workspace).toContain("function abrirConfiguracoes()");
    expect(workspace).toContain("salvarConfiguracoes()");
    expect(workspace).toContain('p.descricao?.trim()');
    expect(workspace).toContain('dados.cliente?.nome');
    expect(workspace).toContain('dados.cliente?.email');
    expect(workspace).toContain('dados.cliente?.telefone');
    expect(workspace).toContain('data(p.atualizado_em)');
    expect(workspace).toContain('data(p.criado_em)');
    expect(workspace).toContain('etapaProjeto');
    expect(workspace).toContain('galeriaUnica?"Galeria única"');
    expect(workspace).toContain('p.prova?"Seleção de fotos":"Entrega direta"');
    expect(workspace).toContain('dados.pastas.map((x,i)=>');
    expect(workspace).toContain('data(x.criado_em)');
    expect(workspace).toContain('onClick={irParaGalerias}');
    expect(workspace).toContain('import "../../project-info-section.css"');
    expect(workspaceCss).toContain(".pw-project-info-layout");
  });

  test("home do projeto prioriza galerias e não duplica a lista dentro dos detalhes",()=>{
    expect(workspace).toContain('aria-label="Resumo em números"');
    expect(workspace).toContain('pw-project-info-title">Detalhes do projeto');
    expect(workspace).not.toContain('pw-project-info-gallery-list');
    expect(workspace.indexOf('id="pw-gallery-section"')).toBeLessThan(workspace.indexOf('className="pw-project-info pw-overview-card"'));
    expect(workspace).toContain('data(galeriaPrincipal.criado_em)');
    expect(workspace).toContain('data(x.criado_em)');
    expect(workspaceCss).toContain('grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr)');
  });

  test("ícones com gradientes continuam usando os números reais",()=>{
    expect(projectPage).toContain('<InternalMetricIcon name="projects"/>');
    expect(projectPage).toContain('<InternalMetricIcon name="folders"/>');
    expect(projectPage).toContain('<InternalMetricIcon name="photos"/>');
    expect(clientsPage).toContain('<InternalMetricIcon name="clients"/>');
    expect(salesPage).toContain('<InternalMetricIcon name="revenue"/>');
    expect(salesPage).toContain('<InternalMetricIcon name="pending"/>');
    expect(salesPage).toContain('dinheiro(receita)');
    expect(clientsPage).toContain('clientes.length');
    expect(layout).toContain('import "./internal-visual-system.css"');
  });

  test("fotografia ocupa a maior parte do cartão, texto abaixo e clique em qualquer área",async({page})=>{
    await page.setViewportSize({width:1440,height:900});
    await page.setContent(documentWithStyles(`<main class="dash projects-page mf-shift">
      <section class="project-list project-grid">${cards(3)}</section>
      <div id="projeto-1">Workspace</div><div id="projeto-2">Workspace 2</div>
    </main>`));
    await expect(page.locator(".project-grid .project-card")).toHaveCount(3);
    const card=page.locator(".project-card").first();
    await expect(card).toHaveCSS("display","flex");
    await expect(card.locator(".project-main")).toHaveCSS("flex-direction","column");
    await expect(card.locator("button")).toHaveCount(0);
    await expect(card).toHaveAttribute("href","#projeto-1");
    const photo=await card.locator(".project-cover").boundingBox();
    const text=await card.locator(".project-copy").boundingBox();
    expect(photo).not.toBeNull();expect(text).not.toBeNull();
    expect(photo!.width).toBeGreaterThan(250);
    expect(text!.y).toBeGreaterThan(photo!.y+photo!.height-1);
    await card.locator(".project-cover").click();
    await expect(page).toHaveURL(/#projeto-1$/);
    await page.evaluate(()=>{window.location.hash=""});
    await card.locator(".project-copy").click();
    await expect(page).toHaveURL(/#projeto-1$/);
    await page.evaluate(()=>{window.location.hash=""});
    await card.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#projeto-1$/);
  });

  test("mobile mantém apenas um cartão por linha e sem overflow",async({page})=>{
    await page.setViewportSize({width:390,height:844});
    await page.setContent(documentWithStyles(`<main class="dash projects-page mf-shift">
      <section class="project-list project-grid">${cards(2)}</section>
    </main>`));
    const cover=await page.locator(".project-cover").first().boundingBox();
    expect(cover).not.toBeNull();
    expect(cover!.width/cover!.height).toBeGreaterThan(1.5);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
    await expect(page.locator(".project-card").first()).toHaveCSS("text-decoration-line","none");
  });

  test("hover dos projetos replica a elevação suave de Clientes e respeita movimento reduzido",async({page})=>{
    await page.setViewportSize({width:1280,height:800});
    await page.setContent(documentWithStyles(`<main class="dash projects-page mf-shift">
      <section class="project-list project-grid">${cards(1)}</section>
    </main>`,sharedHoverCss+css));
    const card=page.locator("a.project-card");
    await expect(card).toHaveCSS("transition-property",/transform/);
    await card.hover();
    const deslocamento=()=>card.evaluate(el=>Math.round(new DOMMatrixReadOnly(getComputedStyle(el).transform).m42));
    await expect.poll(deslocamento).toBe(-1);
    await page.emulateMedia({reducedMotion:"reduce"});
    await expect.poll(deslocamento).toBe(0);
  });

  test("quatro cartões do dashboard recebem gradientes cromáticos distintos",async({page})=>{
    await page.setContent(`<style>${premiumCss}</style>
      <main class="dash mf-shift ft-overview-premium">
        <section class="charts"><div class="card">Evolução</div><div class="card">Distribuição</div></section>
        <section class="lists"><div class="card">Seleções</div><div class="card">Recentes</div></section>
      </main>`);
    const cards=page.locator(".charts>.card, .lists>.card");
    await expect(cards).toHaveCount(4);
    const fundos=await cards.evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).backgroundImage));
    expect(fundos.every(fundo=>fundo.includes("linear-gradient"))).toBe(true);
    expect(new Set(fundos).size).toBe(4);
  });

  test("layout responsivo do novo painel informativo preserva conteúdo",async({page})=>{
    await page.setViewportSize({width:390,height:844});
    await page.setContent(documentWithStyles(`<main class="pw-page mf-shift">
      <section class="pw-project-info pw-overview-card">
        <div class="pw-project-info-heading"><div><span class="pw-info-eyebrow">IDENTIDADE</span><h2>Detalhes do projeto</h2></div>
        <button class="pw-info-edit">Editar informações</button></div>
        <div class="pw-project-info-badges"><span class="pw-project-info-badge">Entregue</span></div>
        <div class="pw-project-info-layout"><div class="pw-project-info-main">
          <div class="pw-info-description"><span class="pw-info-label">DESCRIÇÃO</span><p>Ensaio fotográfico</p></div>
        </div><div class="pw-project-info-galleries"><div class="pw-project-info-galleries-title">GALERIAS DO PROJETO</div></div></div>
      </section>
    </main>`,workspaceCss));
    await expect(page.getByRole("heading",{name:"Detalhes do projeto"})).toBeVisible();
    await expect(page.getByRole("button",{name:"Editar informações"})).toBeVisible();
    await expect(page.locator(".pw-project-info-layout")).toHaveCSS("grid-template-columns",/px/);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  });

  test("estilos não interferem na landing nem possuem animações contínuas",async({page})=>{
    expect(css).not.toContain(".gc-lightbox");
    expect(css).not.toContain(".lp2-");
    expect(css).not.toMatch(/@keyframes\s+/);
    await page.emulateMedia({reducedMotion:"reduce"});
    await page.setContent(documentWithStyles(`<div class="dash projects-page mf-shift">
      <div class="project-list project-grid"><a class="project-card" href="#projeto"><div class="project-main"><div class="project-cover">Capa</div></div></a></div>
    </div>`));
    await expect(page.locator(".project-card")).toHaveCSS("animation-name","none");
  });
});
