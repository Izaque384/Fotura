import { NextRequest, NextResponse } from "next/server";
import { validarAdmin, registrarAdminAuditoria } from "../../../../lib/admin-server";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { registrarErro } from "../../../../lib/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS = new Set(["novo", "analisando", "planejado", "resolvido"]);

export async function GET(req: NextRequest) {
  const validacao = await validarAdmin(req, "admin.feedback.auth");
  if ("error" in validacao) return validacao.error;
  const { supabase } = validacao;

  try {
    const { data, error } = await supabase
      .from("feedbacks")
      .select("id,user_id,tipo,categoria,assunto,mensagem,nota,pagina_origem,navegador,screenshot_path,screenshot_nome,screenshot_mime,screenshot_bytes,status,admin_nota,criado_em,atualizado_em")
      .order("criado_em", { ascending: false })
      .limit(150);
    if (error) throw error;

    const rows = data ?? [];
    const userIds = Array.from(new Set(rows.map((item) => String(item.user_id))));
    const { data: perfis, error: perfisError } = userIds.length
      ? await supabase.from("perfis").select("id,nome_estudio").in("id", userIds)
      : { data: [], error: null };
    if (perfisError) throw perfisError;

    const nomes = new Map((perfis ?? []).map((p) => [String(p.id), String(p.nome_estudio ?? "")]));
    const emails = new Map<string, string>();
    await Promise.all(userIds.map(async (id) => {
      const { data: usuario } = await supabase.auth.admin.getUserById(id);
      emails.set(id, usuario.user?.email ?? "");
    }));

    const feedbacks = await Promise.all(rows.map(async (item) => {
      let screenshotUrl: string | null = null;
      if (item.screenshot_path) {
        const { data: signed } = await supabase.storage
          .from("feedback-anexos")
          .createSignedUrl(String(item.screenshot_path), 60 * 20);
        screenshotUrl = signed?.signedUrl ?? null;
      }
      return {
        ...item,
        nomeEstudio: nomes.get(String(item.user_id)) || "",
        email: emails.get(String(item.user_id)) || "",
        screenshotUrl,
      };
    }));

    return NextResponse.json({ feedbacks }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    registrarErro("admin.feedback.list", req, error, { userId: validacao.adminUserId });
    return NextResponse.json({ error: "Não foi possível carregar os feedbacks." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  const validacao = await validarAdmin(req, "admin.feedback.update.auth");
  if ("error" in validacao) return validacao.error;
  const { supabase, adminUserId, papel } = validacao;

  const body = await req.json().catch(() => null) as { id?: string; status?: string; adminNota?: string } | null;
  const id = String(body?.id ?? "").trim();
  const status = String(body?.status ?? "").trim();
  const adminNota = String(body?.adminNota ?? "").trim().slice(0, 2000);

  if (!id) return NextResponse.json({ error: "Feedback inválido." }, { status: 400 });
  if (!STATUS.has(status)) return NextResponse.json({ error: "Status inválido." }, { status: 400 });

  try {
    const { data: anterior, error: anteriorError } = await supabase
      .from("feedbacks")
      .select("id,user_id,status,admin_nota")
      .eq("id", id)
      .maybeSingle();
    if (anteriorError) throw anteriorError;
    if (!anterior) return NextResponse.json({ error: "Feedback não encontrado." }, { status: 404 });

    const { error } = await supabase
      .from("feedbacks")
      .update({
        status,
        admin_nota: adminNota || null,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;

    await registrarAdminAuditoria({
      supabase,
      req,
      adminUserId,
      papel,
      acao: "feedback.atualizar",
      alvoUserId: String(anterior.user_id),
      entidade: "feedback",
      entidadeId: id,
      detalhes: {
        status_anterior: anterior.status,
        status_novo: status,
        nota_admin_alterada: String(anterior.admin_nota ?? "") !== adminNota,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    registrarErro("admin.feedback.update", req, error, { userId: adminUserId, feedbackId: id });
    return NextResponse.json({ error: "Não foi possível atualizar o feedback." }, { status: 500 });
  }
}
