import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name: string) => readFileSync(name, "utf8");

test("auxiliary R2 buckets are isolated by physical prefix", () => {
  const storage = read("app/lib/r2-storage.ts");
  const access = read("app/lib/media-storage.ts");
  const cleanup = read("supabase/functions/storage-cleanup/index.ts");
  assert.match(storage, /r2PhysicalKey\(/);
  assert.match(storage, /bucket \+ "\/" \+ safe/);
  assert.match(access, /r2PhysicalKey\(bucket, key\)/);
  assert.match(cleanup, /bucket \+ "\/" \+ key/);
});

test("new media cannot silently return to Supabase after cutover", () => {
  const util = read("app/lib/r2-aux-media.ts");
  const feedback = read("app/app/api/feedback/route.ts");
  assert.match(util, /FOTURA_R2_FINAL_CUTOVER/);
  assert.match(util, /return "unavailable"/);
  assert.match(feedback, /uploadProvider === "unavailable"/);
  const prepare = read("app/app/api/feedback/anexo/route.ts");
  const help = read("app/app/ajuda/page.tsx");
  assert.ok(prepare.includes('selectedMediaUploadProvider() !== "r2"'));
  assert.match(prepare, /fotura_r2_upload_reservations/);
  assert.match(prepare, /signPrivateR2ObjectUrl/);
  assert.ok(feedback.includes('signPrivateR2ObjectUrl("HEAD"'));
  assert.match(feedback, /registrar_feedback_r2_backend/);
  assert.doesNotMatch(feedback, /putVerifiedAuxiliaryMedia/);
  assert.ok(help.includes('fetch("/api/feedback/anexo"'));
  assert.match(help, /method: "PUT"/);
  assert.match(help, /screenshot_path/);
});

test("feedback screenshot registration is atomic with feedback record", () => {
  const sql = read("supabase/migrations/20261112230000_r2_feedback_registration.sql");
  const api = read("app/app/api/feedback/route.ts");
  assert.match(sql, /insert into public\.feedbacks/);
  assert.match(sql, /insert into public\.fotura_media_objects/);
  assert.match(sql, /for update/);
  assert.match(sql, /delete from public\.fotura_r2_upload_reservations/);
  assert.match(api, /registrar_feedback_r2_backend/);
  assert.match(api, /fotura_r2_upload_reservations/);
});

test("admin feedback uses authorized private adapter rather than public objects", () => {
  const admin = read("app/app/api/admin/feedback/route.ts");
  const storage = read("app/lib/media-storage.ts");
  assert.match(admin, /validarAdmin/);
  assert.match(admin, /signPrivateMediaUrl/);
  assert.doesNotMatch(admin, /createSignedUrl\(String\(item\.screenshot_path\)/);
  assert.match(storage, /verifiedR2Keys/);
});

test("unconfirmed auxiliary uploads remain protected by expiry and owner scope", () => {
  const reserve = read("supabase/migrations/20261112160000_r2_upload_reservations.sql");
  const cleanup = read("supabase/migrations/20261112220000_r2_abandoned_upload_cleanup.sql");
  assert.match(reserve, /'feedback-anexos'/);
  assert.match(reserve, /'client-avatars'/);
  assert.match(reserve, /'marca'/);
  assert.match(reserve, /split_part\(object_key,'\/',1\)=owner_id::text/);
  assert.match(cleanup, /expires_at < now\(\)-interval '12 hours'/);
});

test("avatar updates are owner-validated and use atomic R2 registration", () => {
  const api = read("app/app/api/clientes/avatar/route.ts");
  const sql = read("supabase/migrations/20261112240000_r2_avatar_registration.sql");
  const page = read("app/app/dashboard/clientes/page.tsx");
  assert.match(api, /\.from\("clientes"\)/);
  assert.match(api, /\.eq\("user_id", actor\.user\.id\)/);
  assert.match(api, /fotura_r2_upload_reservations/);
  assert.match(api, /registrar_avatar_r2_backend/);
  assert.match(api, /signPrivateR2ObjectUrl\(\s*"PUT"/);
  assert.match(api, /signPrivateR2ObjectUrl\(\s*"HEAD"/);
  assert.match(api, /acao === "preparar"/);
  assert.match(api, /acao === "confirmar"/);
  assert.match(sql, /for update/);
  assert.match(sql, /insert into public\.fotura_media_objects/);
  assert.match(sql, /update public\.clientes set avatar_path=p_key/);
  assert.match(sql, /delete from public\.fotura_r2_upload_reservations/);
  assert.match(page, /\/api\/clientes\/avatar/);
  assert.match(page, /provider.provider === "r2"/);
  assert.match(page, /provider.provider === "supabase"/);
  assert.match(page, /method: "PUT"/);
  assert.match(page, /acao: "confirmar"/);
});

test("avatar deletion refuses a referenced image and verifies R2 absence", () => {
  const api = read("app/app/api/clientes/avatar/route.ts");
  assert.match(api, /\.eq\("avatar_path", path\)/);
  assert.match(api, /linked\?\.length/);
  assert.match(api, /signPrivateR2ObjectUrl\("DELETE", physical/);
  assert.match(api, /check\.status !== 404/);
  assert.match(api, /\.from\("fotura_media_objects"\)\.delete\(\)/);
});


test("studio logos use a stable public route, never a public R2 bucket", () => {
  const upload = read("app/app/api/marca/route.ts");
  const publicRoute = read("app/app/api/marca/[owner]/[filename]/route.ts");
  const profile = read("app/app/perfil/page.tsx");
  const og = read("app/app/g/[slug]/opengraph-image.tsx");
  assert.match(upload, /selectedMediaUploadProvider/);
  assert.match(upload, /fotura_r2_upload_reservations/);
  assert.match(upload, /signPrivateR2ObjectUrl\("PUT"/);
  assert.match(upload, /signPrivateR2ObjectUrl\("HEAD"/);
  assert.match(upload, /acao === "preparar"/);
  assert.match(upload, /acao === "confirmar"/);
  assert.match(upload, /registrar_logo_r2_backend/);
  assert.match(upload, /return json\(\{ ok: true, logoUrl \}\)/);
  assert.match(publicRoute, /eq\("logo_url", publicPath\)/);
  assert.match(publicRoute, /eq\("owner_id", owner\)/);
  assert.match(publicRoute, /downloadPrivateMediaBlob\(db, "marca", key\)/);
  assert.match(publicRoute, /Content-Type/);
  assert.match(profile, /fetch\("\/api\/marca"/);
  assert.match(profile, /destination.provider === "r2"/);
  assert.match(profile, /destination.provider === "supabase"/);
  assert.match(profile, /method: "PUT"/);
  assert.match(profile, /acao: "confirmar"/);
  assert.match(og, /downloadPrivateMediaBlob/);
  assert.match(og, /ownerId && url\.startsWith\("\/api\/marca\/"\)/);
});

test("logo publication is atomic with the private R2 registry", () => {
  const sql = read("supabase/migrations/20261112243000_r2_studio_logo_registration.sql");
  assert.match(sql, /fotura_r2_upload_reservations/);
  assert.match(sql, /for update/);
  assert.match(sql, /insert into public\.fotura_media_objects/);
  assert.match(sql, /insert into public\.perfis/);
  assert.match(sql, /on conflict \(id\) do update/);
  assert.match(sql, /delete from public\.fotura_r2_upload_reservations/);
  assert.match(sql, /revoke all on function public\.registrar_logo_r2_backend/);
});
