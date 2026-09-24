import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test.describe("analytics de produto", () => {
  test("mantém a tabela de eventos fechada para clientes", () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), "sql", "product_analytics_2026.sql"),
      "utf8",
    );
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("revoke all on table public.produto_eventos from public, anon, authenticated");
    expect(sql).toContain("grant select, insert, update, delete on table public.produto_eventos to service_role");
  });

  test("rota de ingestão usa whitelist e ignora user_id enviado pelo cliente", () => {
    const route = fs.readFileSync(
      path.join(process.cwd(), "app", "api", "analytics", "event", "route.ts"),
      "utf8",
    );
    expect(route).toContain("const EVENTOS = new Set");
    expect(route).toContain("supabase.auth.getUser(bearer)");
    expect(route).not.toContain("body.userId");
  });
});
