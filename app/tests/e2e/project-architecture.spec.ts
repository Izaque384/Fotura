import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

test.describe("arquitetura centrada em projetos", () => {
  test("projeto é a unidade operacional principal", () => {
    const menu = read("app/MenuFotografo.tsx");
    const projetos = read("app/dashboard/projetos/page.tsx");
    const workspace = read("app/dashboard/projetos/[id]/page.tsx");

    const blocoItens = menu.slice(menu.indexOf("const itensPrincipais"), menu.indexOf("const itensSecundarios"));
    expect(blocoItens).toContain('rota: "/dashboard/projetos"');
    expect(blocoItens).not.toContain('rota: "/dashboard/galerias"');
    expect(blocoItens).not.toContain('rota: "/dashboard/selecoes"');

    expect(projetos).toContain("Cada projeto reúne suas pastas, seleção, entrega e um único link para o cliente.");
    expect(workspace).toContain('"resumo","pastas","selecao","entrega","atividade","configuracoes","vendas"');
    expect(workspace).toContain("Um único link para todo o trabalho");
  });

  test("capa pertence somente ao projeto", () => {
    const workspace = read("app/dashboard/projetos/[id]/page.tsx");
    const publicGallery = read("app/g/[slug]/page.tsx");
    const migration = read("sql/project_shared_cover_guard_2026.sql");

    expect(workspace).toContain("A capa é única e aparece em todas as pastas. Pastas não possuem capa individual.");
    expect(publicGallery).toContain("projectContext?projectContext.capaUrl:capaUrl");
    expect(migration).toContain("new.capa := null");
    expect(migration).toContain("before insert or update of capa, projeto_id");
  });

  test("projeto público oferece entrada por galerias e seletor integrado", () => {
    const projectPage = read("app/p/[slug]/page.tsx");
    const publicGallery = read("app/g/[slug]/page.tsx");
    const publicApi = read("app/api/projeto/publico/route.ts");

    expect(projectPage).toContain("Escolha uma galeria");
    expect(projectPage).toContain("<ProjetoHome");
    expect(projectPage).toContain("thumbnailUrl");
    expect(projectPage).toContain("pc-gallery-thumb");
    expect(projectPage).toContain("GALERIAS DO PROJETO");
    expect(publicGallery).toContain("Trocar galeria");
    expect(publicGallery).toContain("gc-gallery-switch");
    expect(publicGallery).not.toContain("gc-folder-nav");
    expect(publicGallery).toContain('{perfil.nome||"Fotógrafo"}');
    expect(publicGallery).toContain("{projectContext?.nome||meta.titulo}");
    expect(publicApi).toContain('eq("projeto_id", resolvido.id)');
    expect(publicApi).toContain("heroPresetDataUrl");
    expect(publicApi).toContain("estiloHeroEfetivo");
    expect(publicApi).toContain("capa_galeria_id");
    expect(publicApi).toContain("capa_arquivo");
    expect(publicApi).toContain("thumbnailUrl");
    expect(publicApi).toContain('/thumbs');
  });

  test("rotas legadas internas convergem para projetos", () => {
    const galerias = read("app/dashboard/galerias/page.tsx");
    const selecoes = read("app/dashboard/selecoes/page.tsx");
    const workspaceLegado = read("app/dashboard/galerias/[id]/page.tsx");

    expect(galerias).toContain('redirect("/dashboard/projetos")');
    expect(selecoes).toContain('redirect("/dashboard/projetos")');
    expect(workspaceLegado).toContain("/dashboard/projetos/");
  });

  test("portabilidade inclui projetos e pastas relacionadas", () => {
    const exportRoute = read("app/api/account/export/route.ts");
    expect(exportRoute).toContain('from("galeria_projetos")');
    expect(exportRoute).toContain("projetos: projetosRes.data");
    expect(exportRoute).toContain("projeto_id");
  });
});
