import { expect, test } from "@playwright/test";

/**
 * No real R2 credentials, Supabase auth or customer media are present.
 * Run this spec twice in separate CI webServer processes:
 *   ready: production final-cutover flags with synthetic credentials
 *   unavailable: incomplete flags must refuse ALL media classes
 * It is intentionally NOT an S3 or authenticated upload integration test.
 */
const expected = process.env.FOTURA_R2_CONFIG_EXPECTED;
const cutoverMatrixEnabled = expected === "ready" || expected === "unavailable";
const providerRoutes = [
  "/api/fotos/r2",
  "/api/marca",
  "/api/clientes/avatar",
  "/api/feedback/anexo",
];

test.describe("R2 production cutover matrix (synthetic, no real storage)", () => {
test.skip(!cutoverMatrixEnabled, "Runs only with an explicit CI configuration scenario.");
test("production cutover selects one provider for every new media class", async ({ request }) => {
  for (const url of providerRoutes) {
    const response = await request.get(url);
    if (expected === "ready") {
      expect(response.status(), url).toBe(200);
      const payload = await response.json();
      if (url === "/api/fotos/r2") {
        expect(payload, url).toMatchObject({ provider: "r2", enabled: true });
      } else {
        expect(payload, url).toMatchObject({ provider: "r2" });
      }
    } else {
      expect(response.status(), url).toBe(503);
      const body = await response.text();
      expect(body, url).not.toContain("X-Amz-Signature");
    }
  }
});

test("cross-origin callers never obtain R2 upload permission", async ({ request }) => {
  for (const url of providerRoutes) {
    const response = await request.post(url, {
      headers: { Origin: "https://attacker.invalid", "Sec-Fetch-Site": "cross-site" },
      data: { acao: "preparar", bytes: 256 },
    });
    expect(response.status(), url).toBe(403);
    expect(await response.text(), url).not.toMatch(/X-Amz-Signature|synthetic-ci-secret/);
  }
});

test("unauthenticated callers cannot obtain media presigned URLs", async ({ request }) => {
  for (const url of providerRoutes) {
    const response = await request.post(url, { data: { acao: "preparar", bytes: 256 } });
    expect(response.status(), url).toBe(expected === "ready" ? 401 :
      url === "/api/fotos/r2" ? 404 : 401);
    expect(await response.text(), url).not.toContain("X-Amz-Signature");
  }
});
});
