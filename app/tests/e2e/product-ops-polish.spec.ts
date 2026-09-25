import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { dataCalendarioExpirada } from "../../lib/date-only";

const root=process.cwd();
const read=(p:string)=>fs.readFileSync(path.join(root,p),"utf8");

test.describe("product ops polish",()=>{
 test("date-only deadlines end at midnight in Brazil, not UTC",()=>{
  expect(dataCalendarioExpirada("2026-09-25",new Date("2026-09-26T02:59:59Z"))).toBe(false);
  expect(dataCalendarioExpirada("2026-09-25",new Date("2026-09-26T03:00:00Z"))).toBe(true);
 });
 test("gallery cleanup includes final delivery trees",()=>{
  const cron=read("app/api/cron/expirar/route.ts");
  const del=read("app/api/galeria/excluir/route.ts");
  for(const source of [cron,del]){
   expect(source).toContain("/entrega");
   expect(source).toContain("/entrega/thumbs");
  }
 });
 test("Stripe photo-sale webhook reconciles a session race safely",()=>{
  const source=read("app/api/vendas/webhook/route.ts");
  expect(source).toContain("session.metadata?.pedido_id");
  expect(source).toContain('.is("stripe_checkout_session_id",null)');
  expect(source).toContain("sessaoGravada&&sessaoGravada!==session.id");
  expect(source).toContain("confirmado?.stripe_checkout_session_id!==session.id");
 });
 test("admin fair-use helpers remain service-only",()=>{
  const sql=read("sql/product_ops_polish_2026.sql");
  expect(sql).toContain("admin_upload_fair_use_resumo_backend");
  expect(sql).toContain("revoke all on function public.admin_upload_fair_use_resumo_backend() from public, anon, authenticated");
  expect(sql).toContain("grant execute on function public.admin_upload_fair_use_resumo_backend() to service_role");
 });
 test("storage indicator no longer uses the legacy dark card",()=>{
  const source=read("app/dashboard/StorageUsageIndicator.tsx");
  expect(source).toContain("/dashboard/armazenamento");
  expect(source).not.toContain("rgba(20,20,43,.96)");
  expect(source).not.toContain("rgba(14,14,31,.96)");
 });
});
