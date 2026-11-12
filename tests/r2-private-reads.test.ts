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
