import {expect,test} from "@playwright/test";
import {readFileSync} from "node:fs";

const motionCss=readFileSync("app/fotura-motion.css","utf8");

function pagina(corpo:string){
  return `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{box-sizing:border-box}html,body{margin:0;padding:0}
    .dash-body,.ftc-shell,.sales-page,.pc-home,.delivery-page,.up-page{width:100%;max-width:100vw}
    .project-list,.ftc-list,.pc-galleries{display:grid;gap:12px;grid-template-columns:minmax(0,1fr)}
    .project-card,.ftc-card,.pc-gallery-card,.sales-row,.delivery-card{min-width:0;border:1px solid #dcd6ee;padding:12px;border-radius:12px}
    .ft-share-backdrop{position:fixed;inset:0;display:grid;place-items:center}
    .ft-share-card{width:min(500px,90vw);padding:16px;background:white}
    ${motionCss}
  </style></head><body>${corpo}</body></html>`;
}

test("superfícies internas compartilham movimento curto e sem reflow",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.setViewportSize({width:390,height:844});
  await page.setContent(pagina(`
    <main class="dash"><div class="dash-body"><div class="project-list">
      <article class="project-card"><button>Projeto 1</button></article>
      <article class="project-card"><button>Projeto 2</button></article>
    </div></div></main>
    <main class="ftc-shell"><div class="ftc-list"><article class="ftc-card"><button>Cliente 1</button></article></div></main>
    <main class="sales-page"><div class="sales-row">Venda</div></main>
    <main class="delivery-page"><div class="delivery-grid"><article class="delivery-card active">Etapa</article></div></main>
    <main class="pc-home"><div class="pc-galleries"><button class="pc-gallery-card">Galeria</button></div></main>
  `));
  for(const selector of [".project-card",".ftc-card",".delivery-card",".pc-gallery-card"]){
    const element=page.locator(selector).first();
    await expect(element).toHaveCSS("animation-name","ft-surface-enter");
    await expect(element).toHaveCSS("animation-duration","0.32s");
  }
  const project2=page.locator(".project-card").nth(1);
  await expect(project2).toHaveCSS("animation-delay","0.035s");
  await expect(page.locator(".project-card").first()).toHaveCSS("transition-property",/border-color/);
  await expect(page.getByRole("button",{name:"Projeto 1"})).toBeVisible();
  const width=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,viewport:window.innerWidth}));
  expect(width.doc).toBeLessThanOrEqual(width.viewport);
});

test("modal de compartilhar surge sem ocultar ou bloquear ações",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.setContent(pagina(`<div class="ft-share-backdrop"><section class="ft-share-card" role="dialog" aria-label="Compartilhar projeto"><button>Copiar link</button></section></div>`));
  await expect(page.locator(".ft-share-backdrop")).toHaveCSS("animation-name","ft-dialog-backdrop-in");
  await expect(page.locator(".ft-share-card")).toHaveCSS("animation-name","ft-dialog-content-in");
  await page.getByRole("button",{name:"Copiar link"}).click();
});

test("movimento reduzido desativa entradas e realces em todas as áreas",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.setViewportSize({width:390,height:844});
  await page.setContent(pagina(`
    <main class="dash"><div class="dash-body"><div class="project-list"><div class="project-card">Projeto</div></div></div></main>
    <main class="ftc-shell"><div class="ftc-stats"><div class="ftc-stat">Clientes</div></div></main>
    <main class="cfg"><div class="setting-card">Configuração</div></main>
    <main class="profile"><div class="panel">Perfil</div></main>
    <main class="help"><div class="faq-item">Perguntas</div></main>
    <main class="pc-home"><div class="pc-galleries"><div class="pc-gallery-card">Galeria</div></div></main>
    <div class="ft-share-backdrop"><div class="ft-share-card">Compartilhar</div></div>
  `));
  for(const selector of [".project-card",".ftc-stat",".setting-card",".profile .panel",".faq-item",".pc-gallery-card",".ft-share-backdrop",".ft-share-card"]){
    await expect(page.locator(selector)).toHaveCSS("animation-name","none");
  }
  await expect(page.locator(".project-card")).toHaveCSS("transition-duration","0s");
});

test("nenhuma animação de lista é aplicada ao mosaico de fotografias",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.setContent(pagina(`<main class="gc-page"><div class="gc-grid"><article class="gc-card"><img class="gc-grid-img" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>" alt="Foto"></article></div></main>`));
  await expect(page.locator(".gc-card")).toHaveCSS("animation-name","none");
  await expect(page.locator(".gc-grid-img")).toHaveCSS("animation-name","none");
});
