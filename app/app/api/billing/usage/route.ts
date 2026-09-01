import { NextRequest, NextResponse } from "next/server";
import { contextoPlano } from "../../../../lib/billing-usage";
import { registrarErro } from "../../../../lib/observability";
import { createServiceClient } from "../../../../lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authorization = req.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const supabase = createServiceClient();
  const { data: auth, error: authError } = await supabase.auth.getUser(match[1]);
  if (authError || !auth.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  try {
    const contexto = await contextoPlano(supabase, auth.user.id);
    return NextResponse.json({
      plano: { codigo: contexto.plano.codigo, nome: contexto.plano.nome },
      status: contexto.status,
      uso: contexto.uso,
      limites: contexto.limites,
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    registrarErro("billing.usage.lookup", req, error, { userId: auth.user.id });
    return NextResponse.json({ error: "Não foi possível calcular o uso da conta." }, { status: 500 });
  }
}
