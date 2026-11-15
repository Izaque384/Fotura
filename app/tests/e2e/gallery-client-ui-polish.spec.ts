import { expect, test } from "@playwright/test";
import fs from "node:fs";

const imagem = (nome: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#4a4165"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-size="48">${nome}</text></svg>`)}`;

async function abrirGaleria(page: import("@playwright/test").Page) {
  await page.route("**/api/galeria/publica**", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      galeria: {
        titulo: "Galeria de teste", capa: null, prova: false, etapa: "entrega", limite: 0,
        prazo: null, linkAte: null, temSenha: false, desbloqueada: true, linkExpirado: false,
        downloadAtivo: true, downloadIndividual: true, downloadCompleto: true,
        downloadTamanho: "original", downloadPinNecessario: false,
        watermarkAtivo: false, watermarkTexto: null, watermarkOpacidade: 22, assistenteAtivo: false,
      },
      perfil: { nome: "Estúdio Teste", logo: null, cor: "#14101e" },
      selecao: null, listas: [],
    }),
  }));
  await page.route("**/api/fotos/signed**", route => {
    const url = new URL(route.request().url());
    if(url.searchParams.has("arquivo")){
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ nome: url.searchParams.get("arquivo"), url: imagem("Original") }),
      });
    }
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        fotos: [
          {nome:"ensaio-01.jpg", url:imagem("Prévia 1"), thumb:imagem("Prévia 1")},
          {nome:"ensaio-02.jpg", url:imagem("Prévia 2"), thumb:imagem("Prévia 2")},
        ], capaUrl:null,
      }),
    });
  });
  await page.goto("/g/00000000-0000-4000-8000-000000000022");
  await expect(page.locator(".gc-grid-img")).toHaveCount(2);
}

test("galeria mantém espaçamento original e lightbox com controles e download", async ({ page }) => {
  await abrirGaleria(page);
  const primeiraFoto = page.locator(".gc-grid-img").first();
  await expect(primeiraFoto).toBeVisible();
  await expect(primeiraFoto).not.toHaveAttribute("role", "button");
  await expect(primeiraFoto).not.toHaveAttribute("tabindex", "0");
  const grade=await page.locator(".gc-grid").evaluate(el => ({
    gap:getComputedStyle(el).gap,
    padding:getComputedStyle(el).padding,
  }));
  expect(grade.gap).toBe("1px");
  expect(grade.padding).toBe("0px");
  await primeiraFoto.click();
  const lightbox = page.getByRole("dialog", { name: "Foto 1 de 2" });
  await expect(lightbox).toBeVisible();
  await expect(lightbox.getByText("SUA GALERIA")).toBeVisible();
  await expect(lightbox.getByText("01")).toBeVisible();
  await expect(lightbox.getByRole("button", { name: "Baixar foto original" })).toBeVisible();
  await lightbox.getByRole("button", { name: "Próxima foto" }).click();
  await expect(page.getByRole("dialog", { name: "Foto 2 de 2" })).toBeVisible();
  await page.getByRole("dialog", { name: "Foto 2 de 2" }).getByRole("button", { name: "Fechar foto" }).click();
  await expect(page.locator(".gc-lightbox")).toHaveCount(0);
});

test("lightbox mobile evita controles sobrepostos e respeita largura da tela", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrirGaleria(page);
  await page.locator(".gc-grid-img").first().click();
  const lightbox = page.getByRole("dialog", { name: "Foto 1 de 2" });
  await expect(lightbox).toBeVisible();
  // A navegação por toque permanece disponível, sem texto auxiliar na tela.
  await expect(lightbox.getByText("Deslize para ver outras fotos")).toHaveCount(0);
  await expect(lightbox.getByText(/Para navegar|Esc para fechar|Preparando qualidade original/)).toHaveCount(0);
  const result = await lightbox.evaluate(el => {
    const box = (selector:string) => el.querySelector(selector)!.getBoundingClientRect();
    const meta=box(".gc-lightbox-meta"), download=box(".gc-lightbox-download"),
      close=box(".gc-close"), photo=box(".gc-photo");
    return {
      width:window.innerWidth,
      metaRight:meta.right, downloadLeft:download.left, downloadRight:download.right,
      closeLeft:close.left, closeRight:close.right, photoLeft:photo.left, photoRight:photo.right,
    };
  });
  expect(result.metaRight).toBeLessThan(result.downloadLeft);
  expect(result.downloadRight).toBeLessThan(result.closeLeft);
  expect(result.closeRight).toBeLessThanOrEqual(result.width);
  expect(result.photoLeft).toBeGreaterThanOrEqual(0);
  expect(result.photoRight).toBeLessThanOrEqual(result.width);
  await lightbox.getByRole("button", { name: "Próxima foto" }).click();
  await expect(page.getByRole("dialog", { name: "Foto 2 de 2" })).toBeVisible();
});


test("transições do lightbox preservam navegação e descarga de originais", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await abrirGaleria(page);
  await page.locator(".gc-grid-img").first().click();
  const lightbox = page.locator(".gc-lightbox");
  await expect(lightbox).toHaveCSS("animation-name", "ft-lightbox-reveal");
  await expect(lightbox.locator(".gc-photo")).toHaveCSS("animation-name", "ft-photo-reveal");
  await expect(lightbox.getByRole("button", { name: "Baixar foto original" })).toBeVisible();
  await lightbox.getByRole("button", { name: "Próxima foto" }).click();
  await expect(page.getByRole("dialog", { name: "Foto 2 de 2" })).toBeVisible();
  await expect(lightbox.locator(".gc-photo")).toHaveCount(1);
});

test("modo de movimento reduzido desativa as animações fotográficas", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await abrirGaleria(page);
  await page.locator(".gc-grid-img").first().click();
  const lightbox = page.locator(".gc-lightbox");
  await expect(lightbox).toHaveCSS("animation-name", "none");
  await expect(lightbox.locator(".gc-photo")).toHaveCSS("animation-name", "none");
  await lightbox.getByRole("button", { name: "Fechar foto" }).click();
  await expect(lightbox).toHaveCount(0);
});


test("seletor de várias galerias acompanha o espaçamento compacto do título único no celular", async ({ page }) => {
  const fonte=fs.readFileSync("app/g/[slug]/page.tsx","utf8");
  const css=fonte.match(/const css=`([\s\S]*?)`;\s*$/)?.[1];
  expect(css).toBeTruthy();
  expect(fonte).toContain('className="gc-gallery-selected"');
  await page.setViewportSize({width:390,height:844});
  const logo='<div class="gc-album-logo" aria-hidden="true"></div>';
  const multi=`<div class="gc-album-strip" id="multi"><div class="gc-album-strip-inner"><div class="gc-album-identity">${logo}<div class="gc-album-meta"><div class="gc-album-title-row"><label class="gc-gallery-switch"><span class="sr-only">Trocar galeria</span><span class="gc-gallery-selected" aria-hidden="true">Cerimônia</span><select aria-label="Trocar galeria"><option value="a">Cerimônia</option><option value="b">Recepção</option></select><span class="gc-gallery-chevron" aria-hidden="true">⌄</span></label></div><span>ALVOR FOTOGRAFIA</span></div></div></div></div>`;
  const unica=`<div class="gc-album-strip" id="unica"><div class="gc-album-strip-inner"><div class="gc-album-identity">${logo}<div class="gc-album-meta"><div class="gc-album-title-row"><strong>Cerimônia</strong></div><span>ALVOR FOTOGRAFIA</span></div></div></div></div>`;
  await page.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0}${css}</style><main class="gc-page">${multi}${unica}</main>`);
  const medidas=await page.evaluate(()=>{
    const medir=(id:string)=>{
      const raiz=document.querySelector(id)!;
      const titulo=raiz.querySelector(".gc-album-title-row")!.getBoundingClientRect();
      const subtitulo=raiz.querySelector(".gc-album-meta>span")!.getBoundingClientRect();
      const logo=raiz.querySelector(".gc-album-logo")!.getBoundingClientRect();
      return {alturaTitulo:titulo.height,gap:subtitulo.top-titulo.bottom,logoY:logo.y,subY:subtitulo.y};
    };
    const selecionado=document.querySelector("#multi .gc-gallery-selected")!.getBoundingClientRect();
    const seta=document.querySelector("#multi .gc-gallery-chevron")!.getBoundingClientRect();
    return {multi:medir("#multi"),unica:medir("#unica"),distanciaSeta:seta.left-selecionado.right,larguraDocumento:document.documentElement.scrollWidth};
  });
  expect(Math.abs(medidas.multi.alturaTitulo-medidas.unica.alturaTitulo)).toBeLessThanOrEqual(2);
  expect(Math.abs(medidas.multi.gap-medidas.unica.gap)).toBeLessThanOrEqual(2);
  expect(medidas.distanciaSeta).toBeLessThan(18);
  expect(medidas.larguraDocumento).toBeLessThanOrEqual(390);
  const seletor=page.getByRole("combobox",{name:"Trocar galeria"});
  await seletor.selectOption("b");
  await expect(seletor).toHaveValue("b");
});

test("lightbox preserva dimensões na espera, no erro e após carregar a fotografia", async ({ page }) => {
  await page.setViewportSize({width:1280,height:800});
  await abrirGaleria(page);
  await page.locator(".gc-grid-img").first().click();
  const foto=page.locator(".gc-lightbox .gc-photo");
  await expect(foto).toBeVisible();
  const tamanho=()=>foto.evaluate(el=>({width:el.offsetWidth,height:el.offsetHeight}));
  const pronto=await tamanho();
  expect(pronto.width).toBeGreaterThan(200);
  expect(pronto.height).toBeGreaterThan(100);
  await foto.evaluate(el=>el.classList.add("pending"));
  expect(await tamanho()).toEqual(pronto);
  await foto.evaluate(el=>{el.classList.remove("pending");el.classList.add("failed")});
  expect(await tamanho()).toEqual(pronto);
  await foto.evaluate(el=>el.classList.remove("failed"));
  expect(await tamanho()).toEqual(pronto);
  await page.setViewportSize({width:390,height:844});
  await expect.poll(async()=>foto.evaluate(el=>el.offsetWidth)).toBeLessThanOrEqual(390);
  const mobile=await tamanho();
  expect(mobile.width).toBeLessThanOrEqual(370);
  expect(mobile.height).toBeLessThanOrEqual(670);
  await foto.evaluate(el=>el.classList.add("pending"));
  expect(await tamanho()).toEqual(mobile);
  await foto.evaluate(el=>el.classList.remove("pending"));
  await page.getByRole("button",{name:"Próxima foto"}).click();
  await expect(page.getByRole("dialog",{name:"Foto 2 de 2"})).toBeVisible();
  expect((await tamanho()).width).toBeGreaterThan(0);
});
