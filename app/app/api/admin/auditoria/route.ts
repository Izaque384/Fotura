import { NextRequest, NextResponse } from "next/server";
import { listarUsuariosAuthBasicos } from "../../../../lib/admin-auth-users";
import { validarAdmin } from "../../../../lib/admin-server";
import { registrarErro } from "../../../../lib/observability";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const validacao = await validarAdmin(req, "admin.auditoria.auth");
  if ("error" in validacao) return validacao.error;
  const { supabase, adminUserId, papel } = validacao;

  try {
    const [{ data, error }, users] = await Promise.all([
      supabase
        .from("admin_auditoria")
        .select("id,admin_user_id,admin_papel,acao,alvo_user_id,entidade,entidade_id,detalhes,criado_em")
        .order("criado_em", { ascending: false })
        .limit(100),
      listarUsuariosAuthBasicos(supabase),
    ]);
    if (error) throw error;

    const emails = new Map(users.map(user => [user.id, user.email ?? ""]));
    const eventos = (data ?? []).map(item => ({
      ...item,
      admin_email: emails.get(String(item.admin_user_id)) ?? "",
      alvo_email: item.alvo_user_id ? emails.get(String(item.alvo_user_id)) ?? "" : "",
    }));

    return NextResponse.json({ papel, eventos }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    registrarErro("admin.auditoria", req, error, { userId: adminUserId });
    return NextResponse.json({ error: "Não foi possível carregar a auditoria administrativa." }, { status: 500 });
  }
}
