import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const studio = readFileSync("app/studio-aurora.css", "utf8");
const legacyVisual = readFileSync("app/internal-visual-system.css", "utf8");
const auth = readFileSync("app/studio-aurora-auth.css", "utf8");
const admin = readFileSync("app/admin/studio-aurora-admin.css", "utf8");
const rootLayout = readFileSync("app/layout.tsx", "utf8");
const adminLayout = readFileSync("app/admin/layout.tsx", "utf8");

test.describe("Aurora — identidade visual consistente", () => {
  test("folhas de estilo são importadas após os estilos antigos e nas rotas apropriadas", () => {
    expect(rootLayout.indexOf('import "./studio-aurora.css";')).toBeGreaterThan(rootLayout.indexOf('import "./internal-visual-system.css";'));
    expect(rootLayout).toContain('import "./studio-aurora-auth.css";');
    expect(adminLayout.indexOf('import "./studio-aurora-admin.css";')).toBeGreaterThan(adminLayout.indexOf('import "./admin-console.css";'));
    expect(studio).toContain(".mf-shift");
    expect(studio).toContain(".mf-side");
    expect(admin).toContain(".admin-console");
    expect(auth).toContain(".ft-auth-page");
  });

  test("dashboard usa fundo azul Fotura e superfície de vidro, mantendo legibilidade", async ({ page }) => {
    await page.setContent(`<!doctype html><html><head><style>html,body{margin:0}*{box-sizing:border-box}
${studio}</style></head><body>
      <aside class="mf-side"><button class="mf-item ativo">Painel</button></aside>
      <main class="dash mf-shift ft-overview-premium">
        <section class="action-center"><h2>O que você precisa fazer</h2><div class="action-center-clear"><strong>Tudo em dia</strong></div></section>
        <section class="charts"><article class="card"><h2>Projetos</h2></article><article class="card"><h2>Etapas</h2></article></section>
      </main></body></html>`);
    await expect(page.locator(".dash")).toHaveCSS("background-image", /linear-gradient/);
    const tokens=await page.locator(".dash").evaluate(el=>{
      const s=getComputedStyle(el);return {start:s.getPropertyValue("--ft-bg-start").trim(),end:s.getPropertyValue("--ft-bg-end").trim(),panel:s.getPropertyValue("--aurora-panel").trim()};
    });
    expect(tokens.start).toBe("#f4faff");
    expect(tokens.end).toBe("#e8f3fe");
    expect(tokens.panel).toContain("rgba(237,247,255,.84)");
    await expect(page.locator(".action-center")).toHaveCSS("border-radius", "26px");
    await expect(page.locator(".charts > .card").first()).toHaveCSS("border-radius", "26px");
    await expect(page.locator(".charts > .card").first()).toHaveCSS("background-image", /linear-gradient/);
    await expect(page.locator(".mf-item.ativo")).toHaveCSS("background-image", /linear-gradient/);
    await expect(page.locator(".charts h2").first()).toHaveCSS("color", "rgb(29, 43, 66)");
  });

  test("azul Fotura prevalece também sobre as regras antigas das telas internas", async ({ page }) => {
    await page.setViewportSize({width:1280,height:800});
    await page.setContent(`<!doctype html><html><head><style>html,body{margin:0}*{box-sizing:border-box}
${legacyVisual}\n${studio}</style></head><body>
      <main class="dash projects-page mf-shift" id="projects">
        <article class="stat" id="card">Projetos em andamento</article>
      </main>
      <main class="cfg mf-shift" id="settings"><section class="setting-card">Configurações</section></main>
    </body></html>`);
    for (const selector of ["#projects","#settings"]) {
      await expect(page.locator(selector)).toHaveCSS("background-image",/rgb\(248, 251, 255\)/);
    }
    await expect(page.locator("#card")).toHaveCSS("background-image",/rgba\(237, 247, 255, 0\.84\)/);
    await page.setViewportSize({width:390,height:844});
    await expect(page.locator("#projects")).toHaveCSS("background-image",/rgb\(247, 251, 255\)/);
  });

  test("estilo compartilhado atinge projetos, clientes, configurações, perfil e workspace", async ({ page }) => {
    await page.setContent(`<!doctype html><html><head><style>${studio}</style></head><body>
      <main class="mf-shift"><div class="project-card" id="project"></div><div class="ftc-card" id="client"></div><div class="setting-card" id="setting"></div><div class="panel" id="profile"></div><div class="pw-section" id="workspace"></div></main></body></html>`);
    for (const id of ["project", "client", "setting", "profile", "workspace"]) {
      await expect(page.locator("#" + id)).toHaveCSS("background-image", /linear-gradient/);
      await expect(page.locator("#" + id)).toHaveCSS("border-radius", "22px");
    }
  });

  test("administração e login compartilham os acentos sem perder contraste", async ({ page }) => {
    await page.setContent(`<!doctype html><html><head><style>${admin}\n${auth}</style></head><body>
      <main class="admin-console"><div class="admin-metric">Indicador</div></main>
      <section class="ft-auth-page"><div class="ft-auth-panel"><input class="ft-auth-input" aria-label="E-mail"></div></section>
      </body></html>`);
    await expect(page.locator(".admin-console")).toHaveCSS("background-image", /linear-gradient/);
    await expect(page.locator(".admin-metric")).toHaveCSS("border-radius", "20px");
    await expect(page.locator(".ft-auth-page")).toHaveCSS("background-image", /linear-gradient/);
    await expect(page.locator(".ft-auth-page")).toHaveCSS("background-image", /rgb\(247, 251, 255\)/);
    await expect(page.locator(".ft-auth-input")).toHaveCSS("background-color", "rgba(255, 255, 255, 0.88)");
  });

  test("a galeria pública mantém fotografias e lightbox fora da tematização", () => {
    expect(studio).not.toMatch(/\.gc-lightbox|\.gc-photo|\.gc-hero|\.pc-gallery-thumb/);
    expect(auth).not.toMatch(/\.gc-lightbox|\.gc-photo|\.gc-hero|\.pc-gallery-thumb/);
    expect(auth).toContain(".gc-gate-card");
    expect(auth).toContain(".pc-gate-card");
  });
});