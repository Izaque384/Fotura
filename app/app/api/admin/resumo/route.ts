import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { registrarErro } from "../../../../lib/observability";

export const dynamic = "force-dynamic";

const PRECOS: Record<string, number> = {
  essencial: 2990,
  profissional: 5990,
  studio: 11990,
};
const STATUS_COMERCIAIS = new Set(["active", "trialing", "past_due"]);

export async function GET(req: NextRequest) {
  const authorization = req.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const supabase = createServiceClient();
  const { data: auth, error: authError } = await supabase.auth.getUser(match[1]);
  if (authError || !auth.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { data: admin, error: adminError } = await supabase
    .from("admin_usuarios")
    .select("papel")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (adminError) {
    registrarErro("admin.auth", req, adminError, { userId: auth.user.id });
    return NextResponse.json({ error: "Não foi possível validar o acesso administrativo." }, { status: 500 });
  }
  if (!admin) return NextResponse.json({ error: "Acesso administrativo necessário." }, { status: 403 });

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
    const porPlano = { sem_plano: 0, legacy: 0, essencial: 0, profissional: 0, studio: 0 } as Record<string, number>;
    const porStatus: Record<string, number> = {};
    let assinantes = 0;
    let mrrCentavos = 0;

    for (const item of assinaturas) {
      const plano = String(item.plano_codigo ?? "sem_plano");
      const status = String(item.status ?? "desconhecido");
      porPlano[plano] = (porPlano[plano] ?? 0) + 1;
      porStatus[status] = (porStatus[status] ?? 0) + 1;
      if (PRECOS[plano] && STATUS_COMERCIAIS.has(status)) {
        assinantes += 1;
        mrrCentavos += PRECOS[plano];
      }
    }

    return NextResponse.json({
      papel: admin.papel,
      contas: assinaturas.length,
      assinantes,
      mrrCentavos,
      galerias: galeriasRes.count ?? 0,
      clientes: clientesRes.count ?? 0,
      porPlano,
      porStatus,
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    registrarErro("admin.resumo", req, error, { userId: auth.user.id });
    return NextResponse.json({ error: "Não foi possível carregar o resumo administrativo." }, { status: 500 });
  }
}
