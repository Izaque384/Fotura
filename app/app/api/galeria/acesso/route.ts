import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { criarTokenGaleria, nomeCookieGaleria } from "../../../../lib/gallery-access";
import { registrarErro } from "../../../../lib/observability";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { uuidValido } from "../../../../lib/validation";

const JANELA_SEG = 10 * 60;

export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) {
    return NextResponse.json({ error: "Origem da requisição não permitida." }, { status: 403 });
  }

  let body: { galeria?: string; senha?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 400 }); }

  const galeria = body.galeria?.trim();
  const senha = body.senha ?? "";
  if (!uuidValido(galeria) || !senha || senha.length > 256) {
    return NextResponse.json({ error: "Dados obrigatórios ausentes ou inválidos." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: g, error: galleryError } = await supabase.from("galerias").select("id,tem_senha,link_ate").eq("id", galeria).maybeSingle();
  if (galleryError) {
    registrarErro("gallery.access.lookup", req, galleryError, { galeria });
    return NextResponse.json({ error: "Não foi possível verificar a galeria." }, { status: 500 });
  }
  if (!g) return NextResponse.json({ error: "Galeria não encontrada." }, { status: 404 });

  const permitidoGlobal = await consumirRateLimit(req, "gallery_password_ip", "global", JANELA_SEG, 60);
  const permitidoGaleria = await consumirRateLimit(req, "gallery_password", galeria, JANELA_SEG, 12);
  if (!permitidoGlobal || !permitidoGaleria) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos." },
      { status: 429, headers: { "Retry-After": String(JANELA_SEG) } }
    );
  }

  const linkAte = (g.link_ate as string | null) ?? null;
  if (linkAte && Date.now() > new Date(`${linkAte}T23:59:59`).getTime()) {
    return NextResponse.json({ error: "Link expirado." }, { status: 403 });
  }
  if (!g.tem_senha) return NextResponse.json({ ok: true });

  const { data: ok, error } = await supabase.rpc("verificar_senha_galeria", { p_galeria: galeria, p_senha: senha });
  if (error) {
    registrarErro("gallery.access.password_rpc", req, error, { galeria });
    return NextResponse.json({ error: "Não foi possível validar a senha agora." }, { status: 500 });
  }
  if (ok !== true) return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });

  const token = criarTokenGaleria(galeria);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(nomeCookieGaleria(galeria), token.valor, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: token.maxAge,
  });
  return res;
}
