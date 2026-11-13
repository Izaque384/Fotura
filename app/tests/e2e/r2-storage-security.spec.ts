import { expect, test } from "@playwright/test";

/**
 * These are unauthenticated, read-only-in-effect requests against CI's local
 * Next.js server. No Supabase production user, secret or R2 object is used.
 */
const uploadRoutes = [
  "/api/fotos/r2",
  "/api/projeto/video",
  "/api/clientes/avatar",
  "/api/marca",
  "/api/feedback/anexo",
  "/api/feedback",
];

test("new media upload APIs reject requests coming from a foreign origin", async ({ request }) => {
  for (const route of uploadRoutes) {
    const response = await request.post(route, {
      headers: { Origin: "https://attacker.invalid", "Sec-Fetch-Site": "cross-site" },
      data: { acao: "preparar", bytes: 100 },
    });
    expect(response.status(), route).toBe(403);
    expect(await response.text(), route).not.toMatch(/X-Amz-Signature|R2_SECRET_ACCESS_KEY/);
  }
});

test("new media upload APIs refuse unsigned user requests", async ({ request }) => {
  for (const route of uploadRoutes) {
    const response = await request.post(route, {
      data: { acao: "preparar", bytes: 100 },
    });
    // The photo pilot returns 404 before checking auth while disabled;
    // when enabled, it must reject a missing token with 401.
    if (route === "/api/fotos/r2") expect([401, 404], route).toContain(response.status());
    else expect(response.status(), route).toBe(401);
    expect(await response.text(), route).not.toMatch(/X-Amz-Signature|R2_SECRET_ACCESS_KEY/);
  }
});

test("R2 provider discovery never issues a signed write URL", async ({ request }) => {
  for (const route of ["/api/fotos/r2", "/api/clientes/avatar", "/api/marca", "/api/feedback/anexo"]) {
    const response = await request.get(route);
    expect([200, 503], route).toContain(response.status());
    const payload = await response.json();
    expect(payload, route).not.toHaveProperty("url");
    expect(JSON.stringify(payload), route).not.toContain("X-Amz-Signature");
    expect(JSON.stringify(payload), route).not.toContain("SECRET_ACCESS_KEY");
  }
});
