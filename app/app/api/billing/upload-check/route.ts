import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { registrarErro } from "../../../../lib/observability";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";

export const dynamic = "force-dynamic";

type StatusUsoJusto = {
  bloqueado?: boolean;
  reinicia_em?: string | null;
  bytes_enviados?: number | string | null;
  limite_bytes?: number | string | null;
};

export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }

  const authorization = req.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  let body: { bytes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const bytes = typeof body.bytes === "number" ? body.bytes : Number(body.bytes);
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > 30 * 1024 * 1024 * 1024) {
    return NextResponse.json({ error: "Volume inválido." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: auth, error: authError } = await supabase.auth.getUser(match[1]);
  if (authError || !auth.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { data, error } = await supabase.rpc("status_uso_justo_upload_backend", {
      p_user_id: auth.user.id,
    });
    if (error) throw error;

    const status = (data ?? {}) as StatusUsoJusto;
    const usados = Number(status.bytes_enviados ?? 0);
    const limite = Number(status.limite_bytes ?? 0);
    const temLimite = Number.isFinite(limite) && limite > 0;
    const permitido = !status.bloqueado && (!temLimite || usados + bytes <= limite);

    return NextResponse.json({
      permitido,
      reiniciaEm: permitido ? null : (status.reinicia_em ?? null),
    }, {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (error) {
    registrarErro("billing.upload_fair_use_check", req, error, { userId: auth.user.id });
    return NextResponse.json({ error: "Não foi possível validar o envio." }, { status: 500 });
  }
}
