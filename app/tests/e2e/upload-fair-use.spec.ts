import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test.describe("proteção interna de uso justo de upload", () => {
  test("mantém a configuração e os contadores fora do Data API do cliente", () => {
    const sql = fs.readFileSync(path.join(root, "sql", "upload_fair_use_2026.sql"), "utf8");
    expect(sql).toContain("private.upload_fair_use_mensal");
    expect(sql).toContain("private.upload_fair_use_overrides");
    expect(sql).toContain("revoke all on table private.upload_fair_use_mensal from public, anon, authenticated");
    expect(sql).toContain("revoke all on function public.status_uso_justo_upload_backend(uuid) from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.status_uso_justo_upload_backend(uuid) to service_role");
  });

  test("limita o volume mensal a 110% da capacidade do plano", () => {
    const sql = fs.readFileSync(path.join(root, "sql", "upload_fair_use_2026.sql"), "utf8");
    expect(sql).toContain("('gratis', 10::bigint * 1024 * 1024 * 1024)");
    expect(sql).toContain("('essencial', 100::bigint * 1024 * 1024 * 1024)");
    expect(sql).toContain("('profissional', 500::bigint * 1024 * 1024 * 1024)");
    expect(sql).toContain("('studio', 1000::bigint * 1024 * 1024 * 1024)");
  });

  test("contabiliza o upload antes de autorizar e não depende de arquivos ainda existentes", () => {
    const sql = fs.readFileSync(path.join(root, "sql", "upload_fair_use_2026.sql"), "utf8");
    expect(sql).toContain("insert into private.upload_fair_use_mensal");
    expect(sql).toContain("u.bytes_enviados + excluded.bytes_enviados <= v_monthly_limit");
    expect(sql).toContain("set_config('fotura.upload_fair_use_counted', '1', true)");
  });

  test("pré-checagem não expõe limite ou consumo mensal ao navegador", () => {
    const route = fs.readFileSync(path.join(root, "app", "api", "billing", "upload-check", "route.ts"), "utf8");
    expect(route).toContain("permitido");
    expect(route).toContain("reiniciaEm");
    expect(route).not.toContain("limite_bytes: limite");
    expect(route).not.toContain("bytes_enviados: usados");
  });
});
