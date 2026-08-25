import { NextResponse } from "next/server";
import webpush from "web-push";
import { createServiceClient } from "../../../../lib/supabase-server";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || "mailto:contato@fotura.com.br",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: Request) {
  try {
    const { galeria, qtd } = await req.json();
    if (!galeria) {
      return NextResponse.json({ error: "galeria obrigatória." }, { status: 400 });
    }

    const supabase = createServiceClient();

    /* Descobre o dono da galeria e o título */
    const { data: g } = await supabase
      .from("galerias")
      .select("user_id, titulo")
      .eq("id", galeria)
      .maybeSingle();
    if (!g) {
      return NextResponse.json({ error: "Galeria não encontrada." }, { status: 404 });
    }

    /* Busca todas as inscrições push do dono */
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", g.user_id);

    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: true, enviados: 0 });
    }

    const titulo = (g.titulo as string) || "Galeria";
    const payload = JSON.stringify({
      titulo: "Seleção finalizada!",
      corpo: `O cliente finalizou a seleção de ${qtd || "?"} foto${qtd === 1 ? "" : "s"} na galeria "${titulo}".`,
      url: "/dashboard",
    });

    let enviados = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        enviados++;
      } catch (err: unknown) {
        /* Se o push expirou (410 Gone), remove a inscrição */
        if (err && typeof err === "object" && "statusCode" in err && (err as { statusCode: number }).statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }
    }

    return NextResponse.json({ ok: true, enviados });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}