import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { createServiceClient } from "./supabase-server";

function ipDaRequisicao(req: NextRequest) {
  return (
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function hash(valor: string) {
  return createHash("sha256").update(valor).digest("hex");
}

export async function consumirRateLimit(
  req: NextRequest,
  scope: string,
  extra: string,
  windowSeconds: number,
  limit: number
) {
  const supabase = createServiceClient();
  const chave = hash(`${ipDaRequisicao(req)}:${extra}`);
  const { data, error } = await supabase.rpc("consume_api_rate_limit", {
    p_scope: scope,
    p_key_hash: chave,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });
  if (error) return false;
  return data === true;
}
