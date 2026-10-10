import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { criarTokenDownload, nomeCookieDownload, verificarDownloadPin } from "../../../../lib/gallery-download-access";
import { temAcessoGaleria } from "../../../../lib/gallery-access";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { uuidValido } from "../../../../lib/validation";
import { dataCalendarioExpirada } from "../../../../lib/date-only";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  let body: { galeria?: string; pin?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }
  if (!uuidValido(body.galeria) || !/^\d{4,8}$/.test(body.pin ?? "")) return NextResponse.json({ error: "PIN inválido." }, { status: 400 });
  const galeria = body.galeria;
  const supabase = createServiceClient();
  const { data: g } = await supabase.from("galerias").select("id,tem_senha,link_ate,download_pin_hash,download_ativo").eq("id", galeria).maybeSingle();
  if (!g) return NextResponse.json({ error: "Galeria não encontrada." }, { status: 404 });
  if (dataCalendarioExpirada((g.link_ate as string | null) ?? null)) return NextResponse.json({ error: "Link expirado." }, { status: 403 });
  if (g.tem_senha && !temAcessoGaleria(req, galeria)) return NextResponse.json({ error: "Acesso à galeria necessário." }, { status: 401 });
  if (!g.download_ativo) return NextResponse.json({ error: "Downloads desativados." }, { status: 403 });
  if (!g.download_pin_hash) return NextResponse.json({ ok: true });
  const permitido = await consumirRateLimit(req, "gallery_download_pin", galeria, 10 * 60, 12);
  if (!permitido) return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  if (!verificarDownloadPin(body.pin ?? "", g.download_pin_hash as string)) return NextResponse.json({ error: "PIN incorreto." }, { status: 401 });
  const token = criarTokenDownload(galeria);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(nomeCookieDownload(galeria), token.valor, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: token.maxAge,
  });
  return res;
}
