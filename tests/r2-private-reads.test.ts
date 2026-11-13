import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path: string) => readFileSync(path, "utf8");

test("avatar signature endpoint requires authenticated owner and referenced client path", () => {
  const source = read("app/app/api/clientes/avatar-urls/route.ts");
  assert.match(source, /db\.auth\.getUser\(token\)/);
  assert.match(source, /\.from\("clientes"\)/);
  assert.match(source, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(source, /\.in\("avatar_path", paths\)/);
  assert.match(source, /paths\.some\(path => !allowed\.has\(path\)\)/);
  assert.match(source, /signPrivateMediaUrls\(db, "client-avatars", paths, 3600\)/);
  assert.match(source, /Cache-Control/);
});

test("project cover endpoint only signs thumbnails referenced by user's projects", () => {
  const source = read("app/app/api/projetos/preview-urls/route.ts");
  assert.match(source, /db\.auth\.getUser\(token\)/);
  assert.match(source, /\.from\("galeria_projetos"\)/);
  assert.match(source, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(source, /capa_galeria_id/);
  assert.match(source, /capa_arquivo/);
  assert.match(source, /signPrivateMediaUrls\(db, "fotos", paths, 3600\)/);
});

test("photographer pages no longer sign owner avatars and covers directly from legacy storage", () => {
  const clients = read("app/app/dashboard/clientes/page.tsx");
  const projects = read("app/app/dashboard/projetos/page.tsx");
  assert.match(clients, /\/api\/clientes\/avatar-urls/);
  assert.match(projects, /\/api\/clientes\/avatar-urls/);
  assert.match(projects, /\/api\/projetos\/preview-urls/);
  assert.doesNotMatch(clients, /storage\.from\(BUCKET\)\.createSignedUrl/);
  assert.doesNotMatch(projects, /storage\.from\("client-avatars"\)\.createSignedUrl/);
  assert.doesNotMatch(projects, /storage\.from\("fotos"\)\.createSignedUrls/);
});

test("provider-aware media adapter uses private object registry, never filename alone", () => {
  const source = read("app/lib/media-storage.ts");
  assert.match(source, /verifiedR2Keys/);
  assert.match(source, /\.from\("fotura_media_objects"\)/);
  assert.match(source, /r2PhysicalKey\(bucket, key\)/);
  assert.match(source, /createSignedUrls\(legacy, seconds\)/);
});

test("client gallery picker requires both gallery and client ownership before exposing thumbnails", () => {
  const route = read("app/app/api/clientes/galeria-fotos/route.ts");
  const ui = read("app/app/dashboard/clientes/page.tsx");
  assert.match(route, /db\.auth\.getUser\(token\)/);
  assert.match(route, /\.from\("galerias"\)/);
  assert.match(route, /\.from\("clientes"\)/);
  assert.match(route, /gallery\.cliente_id !== client\.id/);
  assert.match(route, /listarCatalogoGaleriaHibrido/);
  assert.match(route, /downloadPrivateMediaBlob/);
  assert.match(route, /signPrivateMediaUrls\(db, "fotos", paths, 900\)/);
  assert.match(ui, /\/api\/clientes\/galeria-fotos/);
  assert.doesNotMatch(ui, /storage\.from\("fotos"\)\.download\(path\)/);
});

test("delivery photographer page uses owner-scoped mixed-provider signing, not direct Supabase Storage", () => {
  const route = readFileSync("app/app/api/galeria/entrega/route.ts", "utf8");
  const page = readFileSync("app/app/dashboard/entrega/[id]/page.tsx", "utf8");
  assert.ok(route.includes('signPrivateMediaUrls('));
  assert.ok(route.includes('paths.slice(i, i + 200), 3600'));
  assert.ok(route.includes('.eq("user_id", auth.user.id)'));
  assert.ok(route.includes('listarCatalogoGaleriaHibrido('));
  assert.ok(route.includes('allow.has(nome)'));
  assert.ok(route.includes('selecionadas,'));
  assert.ok(page.includes('setSelecionadas(e.selecionadas??[])'));
  assert.ok(!page.includes('supabase.storage.from("fotos").createSignedUrls('));
});

test("selection modal signs R2 and legacy objects through the authenticated owner endpoint", () => {
  const ui = read("app/app/components/ModalSelecao.tsx");
  const route = read("app/app/api/fotos/selecao-proprietario/route.ts");
  assert.match(ui, /\/api\/fotos\/selecao-proprietario/);
  assert.doesNotMatch(ui, /storage\.from\("fotos"\)\.createSignedUrls/);
  assert.match(route, /db\.auth\.getUser\(token\)/);
  assert.match(route, /\.eq\("user_id", session\.user\.id\)/);
  assert.match(route, /\.from\("selecoes"\)/);
  assert.match(route, /listarCatalogoGaleriaHibrido/);
  assert.match(route, /available\.has\(name\)/);
  assert.match(route, /signPrivateMediaUrls\(db, "fotos", keys\.slice/);
  assert.match(route, /Cache-Control/);
});

test("saving the cinematic opening supports registered private R2 videos", () => {
  const workspace = read("app/app/api/projeto/workspace/route.ts");
  assert.match(workspace, /\.select\("bytes,content_type"\)\.eq\("bucket", VIDEO_ABERTURA_BUCKET\)/);
  assert.match(workspace, /\.eq\("owner_id", user\.id\)/);
  assert.match(workspace, /signPrivateR2ObjectUrl\("HEAD", path, 60\)/);
  assert.match(workspace, /bytes === Number\(object\.bytes\)/);
  assert.match(workspace, /if \(r2Registered\)/);
  assert.match(workspace, /if \(!keepPrivateR2 && !registryFailed\)/);
});
