import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { consumirRateLimit } from "../../../../lib/rate-limit";

type Body = { endpoint?: unknown; p256dh?: unknown; auth?: unknown };

function endpointValido(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function chaveValida(valor: string, max: number) {
  return valor.length > 10 && valor.length <= max && /^[A-Za-z0-9_-]+$/.test(valor);
}

export async function POST(req: NextRequest) {
  try {
    const authorization = req.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const supabase = createServiceClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData.user;
    if (authError || !user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const permitido = await consumirRateLimit(req, "push_subscription", user.id, 60 * 60, 20);
    if (!permitido) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente mais tarde." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

    let body: Body;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 400 }); }

    const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
    const p256dh = typeof body.p256dh === "string" ? body.p256dh.trim() : "";
    const auth = typeof body.auth === "string" ? body.auth.trim() : "";
    if (
      !endpointValido(endpoint) ||
      endpoint.length > 4096 ||
      !chaveValida(p256dh, 512) ||
      !chaveValida(auth, 512)
    ) {
      return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 });
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      { user_id: user.id, endpoint, p256dh, auth },
      { onConflict: "user_id,endpoint" }
    );
    if (error) return NextResponse.json({ error: "Não foi possível registrar a inscrição." }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
