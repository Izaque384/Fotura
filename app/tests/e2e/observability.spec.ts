import { expect, test } from "@playwright/test";

test("health endpoint responde sem cache e com request id", async ({ request }) => {
  const resposta = await request.get("/api/health");
  expect(resposta.ok()).toBeTruthy();
  expect(resposta.headers()["cache-control"]).toContain("no-store");
  expect(resposta.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/i);

  const body = await resposta.json();
  expect(body.ok).toBe(true);
  expect(body.service).toBe("fotura");
  expect(new Date(body.timestamp).toString()).not.toBe("Invalid Date");
});
