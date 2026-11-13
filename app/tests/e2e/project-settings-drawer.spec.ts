import { expect, test } from "@playwright/test";
import fs from "node:fs";

const workspace = fs.readFileSync("app/dashboard/projetos/[id]/page.tsx", "utf8");
const drawer = fs.readFileSync("app/components/FoturaDrawer.tsx", "utf8");
const drawerCss = fs.readFileSync("app/fotura-drawer.css", "utf8");
const workspaceCss = fs.readFileSync("app/dashboard/project-workspace-refined.css", "utf8");

test("configurações do projeto abrem como drawer sem substituir a aba ativa", () => {
  expect(workspace).toContain('configuracoesAbertas&&<FoturaDrawer size="wide"');
  expect(workspace).toContain('if(valor==="configuracoes")setConfiguracoesAbertas(true)');
  expect(workspace).not.toContain('aba==="configuracoes"&&<section');
  expect(workspace).not.toContain('setAba("configuracoes")');
  expect(workspace).toContain('onProjectSettings={()=>{setPastaDetalhes(null);abrirConfiguracoes()}}');
  expect(workspace).toContain('configurar={()=>{setCompartilharAberto(false);abrirConfiguracoes()}}');
  expect(workspace).toContain('suspended={modalCapa||modalExcluirProjeto}');
  expect(workspace).toContain('footer={');
  expect(workspace).toContain('salvarConfiguracoes()');
  expect(workspace).toContain('className="pw-settings-drawer-layout"');
  for (const category of ['"projeto"', '"abertura"', '"selecao"', '"entrega"', '"vendas"', '"avancado"']) {
    expect(workspace).toContain(category);
  }
});

test("drawer bloqueia rolagem da página, captura foco e pausa durante diálogos secundários", () => {
  expect(drawer).toContain('document.body.style.overflow = "hidden"');
  expect(drawer).toContain('previousFocus?.focus({ preventScroll: true })');
  expect(drawer).toContain('aria-modal="true"');
  expect(drawer).toContain("suspendedLatest.current || panelRef.current?.querySelector");
  expect(workspace).toContain('aria-label={capaIndividual?"Escolher capa da galeria":"Escolher capa do projeto"}');
  expect(drawer).toContain('if (event.key === "Escape")');
  expect(workspace).toContain('pw-project-modal-above-drawer');
  expect(workspaceCss).toContain('.pw-page .pw-project-modal-above-drawer{z-index:260}');
});

test("painel largo, navegação lateral e backdrop desfocado no desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.setContent(`
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>html,body{margin:0}*{box-sizing:border-box}${drawerCss}${workspaceCss}</style>
    <main class="pw-page" style="min-height:100vh">
      <div style="padding:40px"><h1>Batizado Benício</h1><p>Galerias e fotos</p></div>
      <div class="ft-drawer-overlay ft-drawer-overlay--wide">
        <aside class="ft-drawer-panel ft-drawer-panel--wide" role="dialog" aria-modal="true">
          <div class="ft-drawer-header"><h2>Configurações do projeto</h2></div>
          <div class="ft-drawer-content">
            <section class="pw-section pw-settings-section pw-project-settings-drawer-content">
              <div class="pw-settings-drawer-intro"><span>PERSONALIZAÇÃO</span><p>Ajustes do projeto</p></div>
              <div class="pw-settings-drawer-layout">
                <nav class="pw-config-nav" aria-label="Categorias das configurações">
                  <button class="on">Projeto e acesso</button><button>Abertura</button>
                  <button>Seleção</button><button>Entrega</button>
                  <button>Fotos extras</button><button>Avançado</button>
                </nav>
                <div class="pw-settings-drawer-main"><div class="pw-config-grid" data-active="projeto">
                  <div class="pw-config-column"><div class="pw-config-card pw-config-identity">Detalhes do projeto</div></div>
                </div></div>
              </div>
            </section>
          </div>
          <div class="ft-drawer-footer"><button>Salvar alterações</button></div>
        </aside>
      </div>
    </main>
  `);
  const m = await page.evaluate(() => {
    const panel = document.querySelector(".ft-drawer-panel--wide")!.getBoundingClientRect();
    const nav = document.querySelector(".pw-config-nav")!.getBoundingClientRect();
    const content = document.querySelector(".pw-settings-drawer-main")!.getBoundingClientRect();
    const overlay = document.querySelector(".ft-drawer-overlay--wide")!;
    const backdrop = getComputedStyle(overlay);
    return {
      panelWidth: panel.width, panelLeft: panel.left, navWidth: nav.width,
      navRight: nav.right, contentLeft: content.left,
      blur: backdrop.getPropertyValue("backdrop-filter") || backdrop.getPropertyValue("-webkit-backdrop-filter"),
    };
  });
  expect(m.panelWidth).toBeGreaterThan(800);
  expect(m.panelWidth).toBeLessThanOrEqual(960);
  expect(m.panelLeft).toBeGreaterThan(200);
  expect(m.navWidth).toBeGreaterThanOrEqual(195);
  expect(m.contentLeft).toBeGreaterThan(m.navRight);
  expect(m.blur).toContain("blur(9px)");
});

test("no celular o drawer ocupa a tela e as categorias rolam sem cortar o formulário", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>html,body{margin:0}*{box-sizing:border-box}${drawerCss}${workspaceCss}</style>
    <div class="pw-page">
      <div class="ft-drawer-overlay ft-drawer-overlay--wide">
        <aside class="ft-drawer-panel ft-drawer-panel--wide">
          <div class="ft-drawer-header"><h2>Configurações</h2></div>
          <div class="ft-drawer-content"><section class="pw-section pw-settings-section pw-project-settings-drawer-content">
            <div class="pw-settings-drawer-layout">
              <nav class="pw-config-nav">
                <button class="on">Projeto e acesso</button><button>Abertura</button>
                <button>Seleção</button><button>Entrega</button>
                <button>Fotos extras</button><button>Avançado</button>
              </nav>
              <div class="pw-settings-drawer-main"><div class="pw-config-grid" data-active="projeto">
                <div class="pw-config-column"><div class="pw-config-card pw-config-identity">
                  <label class="pw-field">Nome<input value="Batizado Benício"></label>
                  <label class="pw-field">Descrição<textarea>Descrição</textarea></label>
                </div></div>
              </div></div>
            </div>
          </section></div>
          <div class="ft-drawer-footer"><button>Salvar alterações</button></div>
        </aside>
      </div>
    </div>
  `);
  const metrics = await page.evaluate(() => {
    const panel = document.querySelector(".ft-drawer-panel--wide")!.getBoundingClientRect();
    const nav = document.querySelector(".pw-config-nav")!;
    const form = document.querySelector(".pw-config-identity")!.getBoundingClientRect();
    return { viewport: innerWidth, pageWidth: document.documentElement.scrollWidth,
      panelWidth: panel.width, navScroll: nav.scrollWidth, navWidth: nav.clientWidth,
      formRight: form.right, formLeft: form.left };
  });
  expect(metrics.panelWidth).toBeCloseTo(metrics.viewport, 0);
  expect(metrics.pageWidth).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.navScroll).toBeGreaterThan(metrics.navWidth);
  expect(metrics.formRight).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.formLeft).toBeGreaterThanOrEqual(0);
});
