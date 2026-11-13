import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("R2 provider is exclusive for new uploads and is preview-gated", () => {
  const photo = read("app/app/api/fotos/r2/route.ts");
  const video = read("app/app/api/projeto/video/route.ts");
  const client = read("app/lib/r2-photo-upload-client.ts");
  assert.match(photo, /VERCEL_ENV === "preview"/);
  assert.match(photo, /FOTURA_R2_UPLOAD_ENABLED/);
  assert.match(photo, /FOTURA_R2_FINAL_CUTOVER/);
  assert.match(photo, /requested && !available\(\)/);
  assert.match(video, /FOTURA_R2_FINAL_CUTOVER/);
  assert.match(video, /r2Requested\(\) && !r2Ready\(\)/);
  assert.match(video, /provider: "r2"/);
  assert.match(client, /never|Never/);
  assert.match(client, /multipart_iniciar/);
});

test("photographs and MP4s reserve their R2 keys before issuing PUT permissions", () => {
  const photos = read("app/app/api/fotos/r2/route.ts");
  const videos = read("app/app/api/projeto/video/route.ts");
  const sql = read("supabase/migrations/20261112160000_r2_upload_reservations.sql");
  assert.match(photos, /fotura_r2_upload_reservations/);
  assert.match(videos, /fotura_r2_upload_reservations/);
  assert.match(sql, /on delete restrict/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /grant select,insert,update,delete.*service_role/);
});

test("media confirmation is atomic and only accepts a live owner reservation", () => {
  const photoSQL = read("supabase/migrations/20261112170000_r2_upload_finalize.sql");
  const videoSQL = read("supabase/migrations/20261112210000_r2_intro_video_registration.sql");
  for (const sql of [photoSQL, videoSQL]) {
    assert.match(sql, /fotura_r2_upload_reservations/);
    assert.match(sql, /state='pending' and .*expires_at > now\(\)/);
    assert.match(sql, /for update/);
    assert.match(sql, /delete from public\.fotura_r2_upload_reservations/);
  }
});

test("abandoned upload worker only touches owner-bound reserved keys", () => {
  const edge = read("supabase/functions/storage-cleanup/index.ts");
  const sql = read("supabase/migrations/20261112220000_r2_abandoned_upload_cleanup.sql");
  assert.match(edge, /pendingPathIsSafe/);
  assert.match(edge, /r2_pending_cleanup_claim/);
  assert.match(edge, /r2_pending_cleanup_finish/);
  assert.match(edge, /head.status !== 404/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /expires_at < now\(\)-interval '12 hours'/);
  assert.match(sql, /not exists\s*\(select 1 from public\.fotura_media_objects/);
});

test("gallery cleanup remains pending while R2 reservations still exist", () => {
  const sql = read("supabase/migrations/20261112220000_r2_abandoned_upload_cleanup.sql");
  const gallery = read("app/app/api/galeria/excluir/route.ts");
  const project = read("app/app/api/projeto/workspace/route.ts");
  const purge = read("app/lib/admin-purge-executor.ts");
  assert.match(sql, /create or replace function public\.storage_cleanup_finish/);
  assert.match(sql, /or exists\(select 1 from public\.fotura_r2_upload_reservations/);
  for (const source of [gallery,project,purge]) {
    assert.match(source, /fotura_r2_upload_reservations/);
  }
});

test("R2 object writes cannot overwrite already committed objects", () => {
  const signer = read("app/lib/r2-storage.ts");
  const multipart = read("app/lib/r2-multipart.ts");
  const photos = read("app/app/api/fotos/r2/route.ts");
  const video = read("app/app/api/projeto/video/route.ts");
  const videoClient = read("app/app/dashboard/ProjectCinematicSettings.tsx");
  const client = read("app/lib/r2-photo-upload-client.ts");
  assert.ok(signer.includes('if-none-match:*'));
  assert.ok(signer.includes('"If-None-Match": "*"'));
  assert.ok(signer.includes('method !== "PUT" || multipartQuery.length !== 0'));
  assert.ok(multipart.includes('createOnly: true'));
  assert.ok(photos.includes('ticket.mime, [], true'));
  assert.ok(photos.includes('"image/jpeg", [], true'));
  assert.ok(video.includes('"video/mp4", [], true'));
  assert.ok(videoClient.includes('"If-None-Match": "*"'));
  assert.ok(client.includes('xhr.setRequestHeader("If-None-Match", "*")'));
  assert.ok(client.includes('arquivo, progresso, true'));
});

test("all R2 media control APIs bound received metadata bytes", () => {
  for (const path of [
    "app/app/api/fotos/r2/route.ts",
    "app/app/api/projeto/video/route.ts",
    "app/app/api/marca/route.ts",
    "app/app/api/clientes/avatar/route.ts",
    "app/app/api/feedback/route.ts",
    "app/app/api/feedback/anexo/route.ts",
  ]) {
    const source = read(path);
    assert.ok(
      source.includes("readBoundedRequestText(") || source.includes("readBoundedFormData("),
      path + " must bound streamed metadata by actual bytes."
    );
  }
});

test("cancelling an upload cannot delete a concurrently confirmed photo", () => {
  const api = read("app/app/api/fotos/r2/route.ts");
  const sql = read("supabase/migrations/20261112220000_r2_abandoned_upload_cleanup.sql");
  const cancellation = api.slice(api.indexOf('if (body.acao === "cancelar")'), api.indexOf('if (existing) return existing.bytes'));
  assert.ok(cancellation.includes('state: "cleaning"'));
  assert.ok(cancellation.includes('lease_until: new Date(Date.now() + 10 * 60 * 1000)'));
  assert.ok(cancellation.includes('.eq("state", "pending")'));
  assert.doesNotMatch(cancellation, /deleteObject\(|"DELETE"|\.delete\(\)/);
  assert.ok(api.includes('.gt("expires_at", new Date().toISOString())'));
  assert.match(sql, /r\.state='cleaning' and r\.lease_until < now\(\)/);
  assert.match(sql, /not exists \(select 1 from public\.fotura_media_objects/);
});
