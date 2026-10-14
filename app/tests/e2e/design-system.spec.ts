import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=(p:string)=>fs.readFileSync(path.join(root,p),"utf8");

test.describe("Fotura design system",()=>{
  test("tokens visuais são centralizados e cobrem as superfícies principais",()=>{
    const css=read("app/globals.css");
    for(const token of [
      "--ft-app-bg","--ft-surface","--ft-border","--ft-text","--ft-text-muted",
      "--ft-brand-gradient","--ft-font-xs","--ft-font-page",
      "--ft-radius-control","--ft-radius-card","--ft-radius-panel","--ft-shadow-modal",
    ])expect(css).toContain(token);
    expect(css).toContain(".delivery-page,.onb");
  });

  test("telas principais não voltam a usar tipografia microscópica ou pesos intermediários",()=>{
    const arquivos=[
      "app/MenuFotografo.tsx",
      "app/dashboard/projetos/page.tsx",
      "app/dashboard/projetos/[id]/page.tsx",
      "app/dashboard/clientes/page.tsx",
      "app/dashboard/vendas/page.tsx",
      "app/dashboard/assinatura/page.tsx",
      "app/dashboard/atividade/page.tsx",
      "app/configuracoes/page.tsx",
      "app/perfil/page.tsx",
      "app/ajuda/page.tsx",
      "app/upload/page.tsx",
      "app/dashboard/entrega/[id]/page.tsx",
      "app/dashboard/onboarding/page.tsx",
      "app/p/[slug]/page.tsx",
      "app/g/[slug]/page.tsx",
    ];
    for(const arquivo of arquivos){
      const conteudo=read(arquivo);
      expect(conteudo,arquivo).not.toMatch(/font-size:(?:7|7\.5|8|8\.5|8\.8|9|9\.5)px/);
      expect(conteudo,arquivo).not.toMatch(/font-weight:(?:650|750|850)\b/);
    }
  });

  test("controles visíveis usam o conjunto compartilhado de ícones",()=>{
    const projetos=read("app/dashboard/projetos/page.tsx");
    const workspace=read("app/dashboard/projetos/[id]/page.tsx");
    const clientes=read("app/dashboard/clientes/page.tsx");
    const vendas=read("app/dashboard/vendas/page.tsx");
    const galeria=read("app/g/[slug]/page.tsx");
    const selecao=read("app/components/ModalSelecao.tsx");
    const atividade=read("app/dashboard/atividade/page.tsx");
    const onboarding=read("app/dashboard/onboarding/page.tsx");

    for(const conteudo of [projetos,workspace,clientes,vendas,galeria,selecao,atividade,onboarding]){
      expect(conteudo).toContain("FoturaIcons");
    }
    expect(workspace).not.toContain(">•••</button>");
    expect(galeria).not.toContain(">⋮</summary>");
    expect(galeria).not.toContain(">×</button>");
    expect(selecao).not.toContain(">×</button>");
  });

  test("modais e estados internos compartilham fundo, raios e sombras do sistema",()=>{
    const confirm=read("app/components/ConfirmDialog.tsx");
    const selecao=read("app/components/ModalSelecao.tsx");
    const delivery=read("app/dashboard/entrega/[id]/page.tsx");
    expect(confirm).toContain("var(--ft-shadow-modal)");
    expect(confirm).toContain("var(--ft-backdrop)");
    expect(selecao).toContain("var(--ft-shadow-modal)");
    expect(selecao).toContain("var(--ft-border)");
    expect(delivery).toContain("var(--ft-app-bg)");
  });
});
