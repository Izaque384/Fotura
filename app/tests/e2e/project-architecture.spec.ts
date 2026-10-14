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
    expect(workspace).toContain('["resumo","pastas","selecao","entrega"]');
    expect(workspace).toContain("Mais ações do projeto");
    expect(workspace).toContain("Um link para todo o projeto");
  });

  test("pastas podem ter capa própria com fallback do projeto", () => {
    const workspace = read("app/dashboard/projetos/[id]/page.tsx");
    const api = read("app/api/projeto/workspace/route.ts");
    const publicGallery = read("app/g/[slug]/page.tsx");
    const migration = read("sql/project_folder_covers_2026.sql");
    expect(workspace).toContain("Configurar capa");
    expect(workspace).toContain("Usar capa do projeto");
    expect(api).toContain("update.capa = arquivo");
    expect(publicGallery).toContain("imageUrl={projectContext.capaUrl}");
    expect(publicGallery).toContain("title={projectContext.nome}");
    expect(publicGallery).toContain("description={null}");
    expect(migration).toContain("drop trigger if exists trg_bloquear_capa_individual_pasta");
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
    expect(publicGallery).toContain("title={projectContext.nome}");
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

  test("workspace segue a UX atual com ações secundárias em menus", () => {
    const workspace = read("app/dashboard/projetos/[id]/page.tsx");

    expect(workspace).toContain('className="pw-page mf-shift"');
    expect(workspace).toContain("pw-overview-grid");
    expect(workspace).toContain("pw-metrics");
    expect(workspace).toContain("pw-overflow-menu project");
    expect(workspace).toContain("pw-overflow-menu folder");
    expect(workspace).toContain("Ver como cliente");
    expect(workspace).toContain("Compartilhar no WhatsApp");
    expect(workspace).toContain("Configurações");
    expect(workspace).toContain("Adicionar fotos");
    expect(workspace).not.toContain("pw-order-buttons");
    expect(workspace).not.toContain("pw-grid{");
    expect(workspace).not.toContain("pw-cover-card");
  });

  test("workspace gerencia ciclo completo das pastas", () => {
    const workspace = read("app/dashboard/projetos/[id]/page.tsx");
    const api = read("app/api/projeto/workspace/route.ts");
    const deleteApi = read("app/api/galeria/excluir/route.ts");
    const publicGallery = read("app/api/galeria/publica/route.ts");
    const signedPhotos = read("app/api/fotos/signed/route.ts");

    expect(workspace).toContain("Arraste para reordenar.");
    expect(workspace).toContain("Renomear");
    expect(workspace).toContain('x.visivel?"Ocultar do cliente":"Publicar para o cliente"');
    expect(workspace).toContain("Excluir pasta");
    expect(workspace).toContain("ConfirmDialog");

    expect(api).toContain('acao: "atualizar_pasta"');
    expect(api).toContain('acao: "reordenar_pastas"');
    expect(api).toContain("update.titulo = nome");
    expect(api).toContain("update.visivel = body.visivel");

    expect(publicGallery).toContain("g.visivel === false");
    expect(signedPhotos).toContain("g.visivel === false");
    expect(deleteApi).toContain("eraCapaProjeto");
    expect(deleteApi).toContain("capa_arquivo = null");
    expect(deleteApi).toContain('order("ordem", { ascending: true })');
  });

  test("projeto pode ser excluído definitivamente pela zona de perigo", () => {
    const workspace = read("app/dashboard/projetos/[id]/page.tsx");
    const lista = read("app/dashboard/projetos/page.tsx");
    const api = read("app/api/projeto/workspace/route.ts");
    const migration = read("sql/project_cascade_delete_2026.sql");

    expect(workspace).toContain("ZONA DE PERIGO");
    expect(workspace).toContain("Excluir projeto permanentemente");
    expect(workspace).toContain("confirmacaoProjeto.trim()!==p.nome");
    expect(workspace).toContain('acao:"excluir_projeto"');

    expect(lista).not.toContain('onClick={()=>setExcluirProjeto(p)}');
    expect(api).toContain('confirmacao !== String(projeto.nome)');
    expect(api).toContain('rpc("excluir_projeto_backend"');
    expect(api).toContain("limpezaPendente: ids.length > 0");
    expect(api).not.toContain("removerStorageGaleria");
    expect(migration).toContain("create or replace function public.excluir_projeto_backend");
    expect(migration).toContain("delete from public.galerias");
    expect(migration).toContain("delete from public.galeria_projetos");
  });

  test("portabilidade inclui projetos e pastas relacionadas", () => {
    const exportRoute = read("app/api/account/export/route.ts");
    expect(exportRoute).toContain('from("galeria_projetos")');
    expect(exportRoute).toContain("projetos: projetosRes.data");
    expect(exportRoute).toContain("projeto_id");
  });
  test("pipeline público de imagens usa catálogo, metadados e módulos isolados", () => {
    const publicGallery = read("app/g/[slug]/page.tsx");
    const signedPhotos = read("app/api/fotos/signed/route.ts");
    const projectApi = read("app/api/projeto/publico/route.ts");
    const metadataApi = read("app/api/fotos/metadata/route.ts");
    const upload = read("app/upload/page.tsx");
    const delivery = read("app/dashboard/entrega/[id]/page.tsx");
    const cache = read("app/g/[slug]/gallery-image-cache.ts");
    const masonry = read("app/g/[slug]/gallery-masonry.ts");
    const tour = read("app/g/[slug]/FirstAccessTour.tsx");
    const migration = read("../supabase/migrations/20261013100000_gallery_photo_metadata_hardening.sql");

    expect(publicGallery).toContain('from "./gallery-image-cache"');
    expect(publicGallery).toContain('from "./gallery-masonry"');
    expect(publicGallery).toContain('from "./gallery-types"');
    expect(publicGallery).toContain("<FirstAccessTour");
    expect(publicGallery).toContain('loading={i<4?"eager":"lazy"}');
    expect(publicGallery).toContain("e.touches.length!==1");
    expect(cache).toContain("44*60*1000");
    expect(masonry).toContain("alturas[destino]");
    expect(tour).toContain("PASSO {step} DE 2");

    expect(signedPhotos).toContain('rpc("listar_fotos_galeria_storage"');
    expect(signedPhotos).toContain("ORIGINAIS_PREASSINADOS_GRADE = 4");
    expect(projectApi).toContain('rpc("listar_fotos_galeria_storage"');
    expect(metadataApi).toContain('from("galeria_foto_metadata").upsert');
    expect(upload).toContain("gerarMiniaturaComMetadata");
    expect(upload).toContain('"principal",metadados');
    expect(delivery).toContain('"entrega",metadados');
    expect(migration).toContain("Storage remains authoritative");
    expect(migration).toContain("galeria_foto_metadata");
  });

  test("Open Graph do projeto depende apenas do projeto e identidade do fotógrafo", () => {
    const og = read("app/p/[slug]/opengraph-image.tsx");
    expect(og).toContain('select("nome_estudio,logo_url,cor_hero")');
    expect(og).toContain("backgroundColor: cor");
    expect(og).toContain("projeto.nome");
    expect(og).not.toContain("cliente_id");
  });

  test("fluxo do fotógrafo retorna ao contexto e pastas têm ação contextual", () => {
    const workspace = read("app/dashboard/projetos/[id]/page.tsx");
    const upload = read("app/upload/page.tsx");
    const delivery = read("app/dashboard/entrega/[id]/page.tsx");
    expect(workspace).toContain("rotuloAcaoPasta");
    expect(workspace).toContain("Preparar entrega");
    expect(workspace).toContain("Continuar entrega");
    expect(workspace).toContain('new URLSearchParams(window.location.search).get("aba")');
    expect(upload).toContain("?aba=pastas");
    expect(delivery).toContain("?aba=entrega");
  });

  test("workspace não expõe filtro de ordenação das fotos em cada pasta", () => {
    const workspace = read("app/dashboard/projetos/[id]/page.tsx");
    expect(workspace).not.toContain("pw-folder-sort");
    expect(workspace).not.toContain("alterarOrdemFotos");
    expect(workspace).not.toContain("Nome A–Z");
    expect(workspace).not.toContain("Nome Z–A");
  });

  test("cliente pre-carrega pastas vizinhas e preserva a posição por galeria", () => {
    const projectPage = read("app/p/[slug]/page.tsx");
    expect(projectPage).toContain("loadGalleryGrid");
    expect(projectPage).toContain("scrollPastas");
    expect(projectPage).toContain("scrollPastas.current.get(pastaAtiva)");
    expect(projectPage).toContain("onPointerEnter={()=>onPrefetch(p.id)}");
  });

  test("monetização só aparece pronta quando plano e Stripe estão aptos", () => {
    const api = read("app/api/projeto/workspace/route.ts");
    const workspace = read("app/dashboard/projetos/[id]/page.tsx");
    expect(api).toContain("vendaFotosDisponivel");
    expect(api).toContain("stripe_recebimentos_ativo");
    expect(workspace).toContain("dados.comercial.vendaFotosDisponivel");
    expect(workspace).toContain("Conecte os recebimentos pelo Stripe");
  });

});
