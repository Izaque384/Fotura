import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { registrarErro } from "../../../../lib/observability";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authorization = req.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: auth, error: authError } = await supabase.auth.getUser(match[1]);
  if (authError || !auth.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { data: assinatura, error } = await supabase
    .from("assinaturas")
    .select("plano_codigo,status,provedor,periodo_inicio,periodo_fim,cancelar_no_fim")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    registrarErro("billing.status.lookup", req, error, { userId: auth.user.id });
    return NextResponse.json({ error: "Não foi possível carregar a assinatura." }, { status: 500 });
  }

  if (!assinatura) {
    registrarErro("billing.status.missing", req, new Error("Assinatura não encontrada"), { userId: auth.user.id });
    return NextResponse.json({ error: "Assinatura não encontrada." }, { status: 404 });
  }

  return NextResponse.json({
    plano: assinatura.plano_codigo,
    status: assinatura.status,
    provedor: assinatura.provedor,
    periodoInicio: assinatura.periodo_inicio,
    periodoFim: assinatura.periodo_fim,
    cancelarNoFim: Boolean(assinatura.cancelar_no_fim),
  }, {
    headers: { "Cache-Control": "no-store, private" },
  });
}
