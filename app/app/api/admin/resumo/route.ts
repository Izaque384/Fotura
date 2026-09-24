import { NextRequest, NextResponse } from "next/server";
import { registrarErro } from "../../../../lib/observability";
import { validarAdmin } from "../../../../lib/admin-server";
import { planoFotura } from "../../../../lib/billing-plans";

export const dynamic = "force-dynamic";

const STATUS_COMERCIAIS = new Set(["active", "trialing", "past_due"]);

export async function GET(req: NextRequest) {
  const validacao = await validarAdmin(req, "admin.resumo.auth");
  if ("error" in validacao) return validacao.error;
  const { supabase, adminUserId, papel } = validacao;

  try {
    const [assinaturasRes, galeriasRes, clientesRes] = await Promise.all([
      supabase.from("assinaturas").select("plano_codigo,status"),
      supabase.from("galerias").select("id", { count: "exact", head: true }),
      supabase.from("clientes").select("id", { count: "exact", head: true }),
    ]);

    if (assinaturasRes.error) throw assinaturasRes.error;
    if (galeriasRes.error) throw galeriasRes.error;
    if (clientesRes.error) throw clientesRes.error;

    const assinaturas = assinaturasRes.data ?? [];
    const porPlano = { sem_plano: 0, gratis: 0, legacy: 0, essencial: 0, profissional: 0, studio: 0 } as Record<string, number>;
    const porStatus: Record<string, number> = {};
    let assinantes = 0;
    let mrrCentavos = 0;

    for (const item of assinaturas) {
      const plano = String(item.plano_codigo ?? "sem_plano");
      const status = String(item.status ?? "desconhecido");
      porPlano[plano] = (porPlano[plano] ?? 0) + 1;
      porStatus[status] = (porStatus[status] ?? 0) + 1;
      const precoMensal = planoFotura(plano).precoMensalCentavos ?? 0;
      if (precoMensal > 0 && STATUS_COMERCIAIS.has(status)) {
        assinantes += 1;
        mrrCentavos += precoMensal;
      }
    }

    return NextResponse.json({
      papel,
      contas: assinaturas.length,
      assinantes,
      mrrCentavos,
      galerias: galeriasRes.count ?? 0,
      clientes: clientesRes.count ?? 0,
      porPlano,
      porStatus,
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    registrarErro("admin.resumo", req, error, { userId: adminUserId });
    return NextResponse.json({ error: "Não foi possível carregar o resumo administrativo." }, { status: 500 });
  }
}
