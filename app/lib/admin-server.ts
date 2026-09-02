import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "./supabase-server";
import { registrarErro } from "./observability";

export async function validarAdmin(req: NextRequest, contexto = "admin.auth") {
  const authorization = req.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return { error: NextResponse.json({ error: "Não autorizado." }, { status: 401 }) } as const;

  const supabase = createServiceClient();
  const { data: auth, error: authError } = await supabase.auth.getUser(match[1]);
  if (authError || !auth.user) return { error: NextResponse.json({ error: "Não autorizado." }, { status: 401 }) } as const;

  const { data: admin, error: adminError } = await supabase
    .from("admin_usuarios")
    .select("papel")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (adminError) {
    registrarErro(contexto, req, adminError, { userId: auth.user.id });
    return { error: NextResponse.json({ error: "Não foi possível validar o acesso administrativo." }, { status: 500 }) } as const;
  }
  if (!admin) return { error: NextResponse.json({ error: "Acesso administrativo necessário." }, { status: 403 }) } as const;

  return {
    supabase,
    adminUserId: auth.user.id,
    adminEmail: auth.user.email ?? "",
    papel: String(admin.papel ?? "admin"),
  } as const;
}

export async function registrarAdminAuditoria({
  supabase,
  req,
  adminUserId,
  papel,
  acao,
  alvoUserId = null,
  entidade = "conta",
  entidadeId = null,
  detalhes = {},
}: {
  supabase: ReturnType<typeof createServiceClient>;
  req: NextRequest;
  adminUserId: string;
  papel: string;
  acao: string;
  alvoUserId?: string | null;
  entidade?: string;
  entidadeId?: string | null;
  detalhes?: Record<string, unknown>;
}) {
  const requestId = req.headers.get("x-vercel-id") ?? req.headers.get("x-request-id") ?? null;
  const { error } = await supabase.from("admin_auditoria").insert({
    admin_user_id: adminUserId,
    admin_papel: papel,
    acao,
    alvo_user_id: alvoUserId,
    entidade,
    entidade_id: entidadeId,
    detalhes,
    request_id: requestId,
  });
  if (error) registrarErro("admin.audit.write", req, error, { userId: adminUserId, acao, alvoUserId });
}
