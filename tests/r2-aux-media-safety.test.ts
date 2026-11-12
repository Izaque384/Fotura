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
  assert.match(feedback, /putVerifiedAuxiliaryMedia/);
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
  assert.match(api, /putVerifiedAuxiliaryMedia/);
  assert.match(sql, /for update/);
  assert.match(sql, /insert into public\.fotura_media_objects/);
  assert.match(sql, /update public\.clientes set avatar_path=p_key/);
  assert.match(sql, /delete from public\.fotura_r2_upload_reservations/);
  assert.match(page, /\/api\/clientes\/avatar/);
  assert.doesNotMatch(page, /storage\.from\("client-avatars"\)\.upload/);
});

test("avatar deletion refuses a referenced image and verifies R2 absence", () => {
  const api = read("app/app/api/clientes/avatar/route.ts");
  assert.match(api, /\.eq\("avatar_path", path\)/);
  assert.match(api, /linked\?\.length/);
  assert.match(api, /signPrivateR2ObjectUrl\("DELETE", physical/);
  assert.match(api, /check\.status !== 404/);
  assert.match(api, /\.from\("fotura_media_objects"\)\.delete\(\)/);
});
