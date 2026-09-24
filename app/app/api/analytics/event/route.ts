import { NextRequest, NextResponse } from "next/server";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { createServiceClient } from "../../../../lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EVENTOS = new Set([
  "landing_view",
  "landing_signup_clicked",
  "dashboard_view",
  "sales_page_view",
  "plan_page_view",
  "plan_checkout_started",
  "upgrade_prompt_view",
  "upgrade_prompt_clicked",
  "gallery_shared",
  "public_gallery_view",
  "extra_sale_checkout_started",
  "extra_sale_payment_confirmed",
]);

const CHAVES_DETALHES = new Set([
  "origem",
  "plano",
  "plano_atual",
  "armazenamento_percentual",
  "extras",
  "total_centavos",
  "canal",
  "utm_source",
  "utm_medium",
  "utm_campaign",
]);

function texto(valor: unknown, maximo: number) {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  return limpo ? limpo.slice(0, maximo) : null;
}

function detalhesSeguros(valor: unknown) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
  const entrada = valor as Record<string, unknown>;
  const saida: Record<string, string | number | boolean | null> = {};
  for (const [chave, item] of Object.entries(entrada)) {
    if (!CHAVES_DETALHES.has(chave)) continue;
    if (typeof item === "string") saida[chave] = item.slice(0, 120);
    else if (typeof item === "number" && Number.isFinite(item)) saida[chave] = item;
    else if (typeof item === "boolean" || item === null) saida[chave] = item;
  }
  return saida;
}

export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  }

  const evento = texto(body.evento, 80);
  if (!evento || !EVENTOS.has(evento)) {
    return NextResponse.json({ error: "Evento não permitido." }, { status: 400 });
  }

  const sessaoId = texto(body.sessaoId, 100);
  const authorization = req.headers.get("authorization") ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
  const supabase = createServiceClient();
  let userId: string | null = null;

  if (bearer) {
    const { data, error } = await supabase.auth.getUser(bearer);
    if (error || !data.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    userId = data.user.id;
  }

  const chave = userId ?? sessaoId ?? evento;
  const permitido = await consumirRateLimit(req, "product_event", chave, 60, 90);
  if (!permitido) return NextResponse.json({ error: "Muitas requisições." }, { status: 429 });

  const { error } = await supabase.from("produto_eventos").insert({
    user_id: userId,
    evento,
    rota: texto(body.rota, 180),
    entidade: texto(body.entidade, 40),
    entidade_id: texto(body.entidadeId, 160),
    sessao_id: sessaoId,
    detalhes: detalhesSeguros(body.detalhes),
  });

  if (error) {
    console.error("[product-analytics] insert failed", { evento, code: error.code });
    return NextResponse.json({ error: "Não foi possível registrar o evento." }, { status: 500 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
