import { NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";

export async function POST(req: Request) {
  try {
    const { user_id, endpoint, p256dh, auth } = await req.json();
    if (!user_id || !endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Campos obrigatórios faltando." }, { status: 400 });
    }

    const supabase = createServiceClient();

    await supabase.from("push_subscriptions").upsert(
      { user_id, endpoint, p256dh, auth },
      { onConflict: "user_id,endpoint" }
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}