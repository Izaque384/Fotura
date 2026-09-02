import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { planoFotura } from "../../../../lib/billing-plans";
import { obterSuspensaoAdministrativa } from "../../../../lib/account-access";
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

  try {
    const [{ data: assinatura, error }, suspensao] = await Promise.all([
      supabase
        .from("assinaturas")
        .select("plano_codigo,status,provedor,provedor_assinatura_id,periodo_inicio,periodo_fim,cancelar_no_fim")
        .eq("user_id", auth.user.id)
        .maybeSingle(),
      obterSuspensaoAdministrativa(supabase, auth.user.id),
    ]);

    if (error) throw error;
    if (!assinatura) {
      registrarErro("billing.status.missing", req, new Error("Assinatura não encontrada"), { userId: auth.user.id });
      return NextResponse.json({ error: "Assinatura não encontrada." }, { status: 404 });
    }

    const plano = planoFotura(assinatura.plano_codigo as string | null);
    const temAssinatura = assinatura.provedor === "stripe" && Boolean(assinatura.provedor_assinatura_id);

    return NextResponse.json({
      plano: {
        codigo: plano.codigo,
        nome: plano.nome,
        descricao: plano.descricao,
        limites: plano.limites,
        recursos: plano.recursos,
      },
      status: assinatura.status,
      provedor: assinatura.provedor,
      temAssinatura,
      periodoInicio: assinatura.periodo_inicio,
      periodoFim: assinatura.periodo_fim,
      cancelarNoFim: Boolean(assinatura.cancelar_no_fim),
      suspensao: suspensao?.ativa ? {
        ativa: true,
        motivo: suspensao.motivo,
        suspensoEm: suspensao.suspensoEm,
      } : { ativa: false },
    }, {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (error) {
    registrarErro("billing.status.lookup", req, error, { userId: auth.user.id });
    return NextResponse.json({ error: "Não foi possível carregar a assinatura." }, { status: 500 });
  }
}
