import { expect, test } from "@playwright/test";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("seletor de capa mostra o catálogo final R2 em galerias com entrega publicada", () => {
  const api = read("app/api/projeto/workspace/route.ts");
  const picker = read("app/dashboard/projetos/[id]/page.tsx");
  const variant = read("lib/public-gallery-media-variant.ts");

  expect(picker).toContain("capaPasta=");
  expect(picker).toContain("setFotosCapa((d.fotos??[])");
  expect(picker).toContain("capaArquivo:foto.nome");
  expect(api).toContain('.select("id,etapa,prova,entrega_publicada_em").eq("id", capaPasta)');
  expect(api).toContain("variante = await variantePublicaDaGaleria(supabase, pasta)");
  expect(api).toContain('listarCatalogoGaleriaHibrido(supabase, user.id, capaPasta, variante)');
  expect(api).toContain('variante === "entrega" ? "/entrega" : ""');
  expect(api).toContain("mapa.get(`${base}/thumbs/${nome}`)");
  expect(variant).toContain('if (finais?.length) return "entrega"');
});

test("salvar capa final valida contra a variante publicada, não apenas a original", () => {
  const api = read("app/api/projeto/workspace/route.ts");
  expect(api).toContain("variante = await variantePublicaDaGaleria(supabase, pasta)");
  expect(api).toContain('listarCatalogoGaleriaHibrido(supabase, user.id, body.capaPastaId, variante)');
  expect(api).toContain("variante = await variantePublicaDaGaleria(supabase, pastaAtual)");
  expect(api).toContain('listarCatalogoGaleriaHibrido(supabase, user.id, body.pastaId, variante)');
  expect(api).toContain("update.capa_arquivo = body.capaArquivo");
  expect(api).toContain("update.capa = arquivo");
  expect(api).not.toContain('listarCatalogoGaleriaHibrido(supabase, user.id, capaPasta, "principal")');
});

test("capa salva usa /entrega/thumbs somente quando arquivo existe no catálogo final", () => {
  const path = read("lib/project-cover-path.server.ts");
  expect(path).toContain("variantePublicaDaGaleria");
  expect(path).toContain('.eq("user_id", userId)');
  expect(path).toContain('.eq("variante", "entrega").eq("nome", nome)');
  expect(path).toContain("if (final) return `${base}/entrega/thumbs/${nome}`");
  expect(path).toContain("return `${base}/thumbs/${nome}`");
});

test("mesma foto escolhida aparece no workspace, página pública, painel e preview do link", () => {
  const workspace = read("app/api/projeto/workspace/route.ts");
  const publicProject = read("app/api/projeto/publico/route.ts");
  const signedPreviews = read("app/api/projetos/preview-urls/route.ts");
  const social = read("lib/project-social-preview.server.ts");

  expect(workspace).toContain("caminhoCapaAtual(supabase, projeto.user_id");
  expect(workspace).toContain("caminhoCapaAtual(supabase, userId, g.id, g.capa)");
  expect(publicProject).toContain("caminhoCapaAtual(");
  expect(signedPreviews).toContain("caminhoCapaAtual(");
  expect(signedPreviews).toContain("urls[entry.requested] = signed[entry.real]");
  expect(signedPreviews).toContain("if (paths.some(path => !allowed.has(path)))");
  expect(social).toContain("caminhoCapaAtual(");
  expect(social).toContain("project.og_capa_autorizada");
});

test("contagem da galeria segue a entrega final após publicação", () => {
  const api = read("app/api/projeto/workspace/route.ts");
  expect(api).toContain("const variante = await variantePublicaDaGaleria(supabase, pasta)");
  expect(api).toContain("listarCatalogoGaleriaHibrido(supabase, userId, pasta.id, variante)");
  expect(api).toContain("if (error || !data) throw");
});
