import { expect, test } from "@playwright/test";
import fs from "node:fs";
const read=(file:string)=>fs.readFileSync(file,"utf8");

test("o endpoint de download envia apenas arquivos originais",()=>{
 const download=read("app/api/galeria/download/route.ts");
 const signed=read("app/api/fotos/signed/route.ts");
 expect(download).toContain('const caminho = `${base}/${arquivo}`');
 expect(download).not.toContain('tamanho === "web"');
 expect(signed).not.toContain("createGalleryWatermarkUrl");
 expect(signed).toContain("watermarkProtected: false");
});
test("configurações antigas não reativam qualidade web nem marca d’água",()=>{
 const workspace=read("app/api/projeto/workspace/route.ts");
 const gallery=read("app/api/galeria/workspace/route.ts");
 for (const file of [workspace,gallery]) {
  expect(file).toContain('update.download_tamanho = "original"');
  expect(file).toContain("update.watermark_ativo = false");
 }
 const ui=read("app/dashboard/projetos/[id]/page.tsx");
 expect(ui).toContain("Qualidade máxima · arquivos originais");
 expect(ui).not.toContain("Web · 960 px");
 expect(ui).not.toContain("Marca d’água nas prévias");
 expect(ui).toContain("Novo PIN");
});
test("navegação usa thumbs progressivas sem baixar originais automaticamente",()=>{
 const viewer=read("app/g/[slug]/page.tsx");
 expect(viewer).toContain("limiteVisiveis");
 expect(viewer).toContain("IntersectionObserver");
 expect(viewer).toContain('rootMargin:"850px 0px"');
 expect(viewer).toContain("fotos.slice(0,limiteVisiveis)");
 expect(viewer).toContain('loading={i<4?"eager":"lazy"}');
 expect(viewer).not.toContain("prepararOriginal(fotos[0].nome)");
 expect(viewer).toContain("gc-photo-progress-preview");
 expect(viewer).toContain("gc-photo-original-pending");
 expect(viewer).toContain('aria-label="Baixar foto original"');
});
