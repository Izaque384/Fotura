import { NextRequest, NextResponse } from "next/server";
import { validarAdmin, registrarAdminAuditoria } from "../../../../lib/admin-server";
import { listarUsuariosAuthBasicos } from "../../../../lib/admin-auth-users";
import { registrarErro } from "../../../../lib/observability";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { uuidValido } from "../../../../lib/validation";

export const dynamic = "force-dynamic";

const GIB = 1024 * 1024 * 1024;

type LinhaUso = {
  user_id: string;
  plano_codigo: string;
  status: string;
  nome_estudio: string;
  bytes_enviados: number | string;
  arquivos_enviados: number | string;
  limite_padrao_bytes: number | string;
  limite_override_bytes: number | string | null;
  limite_efetivo_bytes: number | string;
  override_expira_em: string | null;
  override_motivo: string | null;
};

export async function GET(req: NextRequest) {
  const validacao = await validarAdmin(req, "admin.uso.auth");
  if ("error" in validacao) return validacao.error;
  const { supabase, adminUserId } = validacao;

  try {
    const [{ data, error }, usuarios] = await Promise.all([
      supabase.rpc("admin_upload_fair_use_resumo_backend"),
      listarUsuariosAuthBasicos(supabase),
    ]);
    if (error) throw error;

    const emails = new Map(usuarios.map((u) => [u.id, u.email ?? ""]));
    const contas = ((data ?? []) as LinhaUso[]).map((item) => {
      const usados = Number(item.bytes_enviados ?? 0);
      const limite = Number(item.limite_efetivo_bytes ?? 0);
      return {
        userId: item.user_id,
        email: emails.get(item.user_id) ?? "",
        nomeEstudio: item.nome_estudio ?? "",
        plano: item.plano_codigo,
        status: item.status,
        bytesEnviados: usados,
        arquivosEnviados: Number(item.arquivos_enviados ?? 0),
        limitePadraoBytes: Number(item.limite_padrao_bytes ?? 0),
        limiteOverrideBytes: item.limite_override_bytes === null ? null : Number(item.limite_override_bytes),
        limiteEfetivoBytes: limite,
        percentual: limite > 0 ? Math.min(999, Math.round((usados / limite) * 1000) / 10) : 0,
        bloqueada: limite > 0 && usados >= limite,
        overrideExpiraEm: item.override_expira_em,
        overrideMotivo: item.override_motivo,
      };
    });

    return NextResponse.json({
      atualizadoEm: new Date().toISOString(),
      contas,
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    registrarErro("admin.uso.list", req, error, { userId: adminUserId });
    return NextResponse.json({ error: "Não foi possível carregar o uso justo." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const validacao = await validarAdmin(req, "admin.uso.override.auth");
  if ("error" in validacao) return validacao.error;
  const { supabase, adminUserId, papel } = validacao;

  let body: { userId?: unknown; limiteGb?: unknown; expiraEm?: unknown; motivo?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 400 }); }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const limiteGb = typeof body.limiteGb === "number" ? body.limiteGb : Number(body.limiteGb);
  const motivo = typeof body.motivo === "string" ? body.motivo.trim().slice(0, 500) : "";
  const expiraEmRaw = typeof body.expiraEm === "string" ? body.expiraEm.trim() : "";
  const expiraEm = expiraEmRaw ? new Date(expiraEmRaw) : null;

  if (!uuidValido(userId) || !Number.isFinite(limiteGb) || limiteGb <= 0 || limiteGb > 10_240) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (expiraEm && (!Number.isFinite(expiraEm.getTime()) || expiraEm.getTime() <= Date.now())) {
    return NextResponse.json({ error: "A expiração precisa estar no futuro." }, { status: 400 });
  }

  const limiteBytes = Math.round(limiteGb * GIB);

  try {
    const { error } = await supabase.rpc("admin_definir_upload_fair_use_override_backend", {
      p_user_id: userId,
      p_limite_bytes: limiteBytes,
      p_expira_em: expiraEm ? expiraEm.toISOString() : null,
      p_motivo: motivo || null,
    });
    if (error) throw error;

    await registrarAdminAuditoria({
      supabase, req, adminUserId, papel,
      acao: "upload_fair_use_override_definido",
      alvoUserId: userId,
      entidade: "uso_justo_upload",
      entidadeId: userId,
      detalhes: { limiteBytes, expiraEm: expiraEm?.toISOString() ?? null, motivo: motivo || null },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    registrarErro("admin.uso.override", req, error, { userId: adminUserId, alvoUserId: userId });
    return NextResponse.json({ error: "Não foi possível salvar a exceção." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const validacao = await validarAdmin(req, "admin.uso.override_remove.auth");
  if ("error" in validacao) return validacao.error;
  const { supabase, adminUserId, papel } = validacao;

  let body: { userId?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 400 }); }
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!uuidValido(userId)) return NextResponse.json({ error: "Usuário inválido." }, { status: 400 });

  try {
    const { error } = await supabase.rpc("admin_remover_upload_fair_use_override_backend", { p_user_id: userId });
    if (error) throw error;
    await registrarAdminAuditoria({
      supabase, req, adminUserId, papel,
      acao: "upload_fair_use_override_removido",
      alvoUserId: userId,
      entidade: "uso_justo_upload",
      entidadeId: userId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    registrarErro("admin.uso.override_remove", req, error, { userId: adminUserId, alvoUserId: userId });
    return NextResponse.json({ error: "Não foi possível remover a exceção." }, { status: 500 });
  }
}
