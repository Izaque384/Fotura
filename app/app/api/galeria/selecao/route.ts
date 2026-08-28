import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createServiceClient } from "../../../../lib/supabase-server";
import { temAcessoGaleria } from "../../../../lib/gallery-access";
import { consumirRateLimit } from "../../../../lib/rate-limit";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || "mailto:contato@fotura.com.br",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

type Body = { galeria?: string; fotos?: unknown; finalizada?: unknown; comentarios?: unknown };

function comentariosValidos(valor: unknown) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const saida: Record<string, string> = {};
  for (const [chave, texto] of Object.entries(valor as Record<string, unknown>)) {
    if (typeof chave !== "string" || chave.length > 300 || typeof texto !== "string" || texto.length > 2000) return null;
    saida[chave] = texto;
    if (Object.keys(saida).length > 500) return null;
  }
  return saida;
}

async function notificar(supabase: ReturnType<typeof createServiceClient>, userId: string, titulo: string, qtd: number) {
  const { data: subs } = await supabase.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", userId);
  if (!subs?.length) return;
  const payload = JSON.stringify({ titulo: "Seleção finalizada!", corpo: `O cliente finalizou a seleção de ${qtd} foto${qtd === 1 ? "" : "s"} na galeria "${titulo}".`, url: "/dashboard" });
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "statusCode" in err && (err as { statusCode: number }).statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
  }
}

export async function POST(req: NextRequest) {
  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 400 }); }
  const galeria = body.galeria?.trim();
  if (!galeria || galeria.length > 100) return NextResponse.json({ error: "galeria inválida." }, { status: 400 });
  if (!Array.isArray(body.fotos) || body.fotos.length > 500 || !body.fotos.every((x) => typeof x === "string" && x.length <= 300)) {
    return NextResponse.json({ error: "Seleção inválida." }, { status: 400 });
  }
  const fotos = Array.from(new Set(body.fotos as string[]));
  const finalizada = body.finalizada === true;
  const comentarios = comentariosValidos(body.comentarios ?? {});
  if (!comentarios) return NextResponse.json({ error: "Comentários inválidos." }, { status: 400 });

  const supabase = createServiceClient();
  const { data: g } = await supabase.from("galerias").select("user_id,titulo,prova,limite,prazo,link_ate,tem_senha").eq("id", galeria).maybeSingle();
  if (!g) return NextResponse.json({ error: "Galeria não encontrada." }, { status: 404 });

  const permitido = await consumirRateLimit(req, "gallery_selection_write", galeria, 10 * 60, 180);
  if (!permitido) {
    return NextResponse.json(
      { error: "Muitas alterações em pouco tempo. Aguarde alguns minutos." },
      { status: 429, headers: { "Retry-After": "600" } }
    );
  }

  const linkAte = (g.link_ate as string | null) ?? null;
  if (linkAte && Date.now() > new Date(`${linkAte}T23:59:59`).getTime()) return NextResponse.json({ error: "Link expirado." }, { status: 403 });
  if (g.tem_senha && !temAcessoGaleria(req, galeria)) return NextResponse.json({ error: "Acesso à galeria necessário." }, { status: 401 });
  if (!g.prova) return NextResponse.json({ error: "Esta galeria não está em modo prova." }, { status: 403 });
  const prazo = (g.prazo as string | null) ?? null;
  if (prazo && Date.now() > new Date(`${prazo}T23:59:59`).getTime()) return NextResponse.json({ error: "Prazo da seleção encerrado." }, { status: 403 });
  const limite = (g.limite as number) ?? 0;
  if (limite > 0 && fotos.length > limite) return NextResponse.json({ error: "Limite de seleção excedido." }, { status: 400 });
  if (finalizada && fotos.length === 0) return NextResponse.json({ error: "Selecione ao menos uma foto." }, { status: 400 });

  const { data: anterior } = await supabase.from("selecoes").select("finalizada").eq("galeria", galeria).maybeSingle();
  if (anterior?.finalizada) return NextResponse.json({ error: "A seleção já foi finalizada." }, { status: 409 });

  const { error } = await supabase.from("selecoes").upsert({ galeria, fotos, finalizada, comentarios, atualizado_em: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "Não foi possível salvar a seleção." }, { status: 500 });

  if (finalizada && !anterior?.finalizada) await notificar(supabase, g.user_id as string, (g.titulo as string) || "Galeria", fotos.length);
  return NextResponse.json({ ok: true });
}
