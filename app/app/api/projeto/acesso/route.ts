import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { criarTokenProjeto, nomeCookieProjeto } from "../../../../lib/project-access";
import { criarTokenGaleria, nomeCookieGaleria } from "../../../../lib/gallery-access";
import { registrarErro } from "../../../../lib/observability";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { uuidValido } from "../../../../lib/validation";
import { dataCalendarioExpirada } from "../../../../lib/date-only";

const JANELA_SEG = 10 * 60;

export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) {
    return NextResponse.json({ error: "Origem da requisição não permitida." }, { status: 403 });
  }

  let body: { projeto?: string; senha?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 400 }); }

  const projeto = body.projeto?.trim();
  const senha = body.senha ?? "";
  if (!uuidValido(projeto) || !senha || senha.length > 256) {
    return NextResponse.json({ error: "Dados obrigatórios ausentes ou inválidos." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: p, error } = await supabase.from("galeria_projetos").select("id,tem_senha,link_ate").eq("id", projeto).maybeSingle();
  if (error) {
    registrarErro("project.access.lookup", req, error, { projeto });
    return NextResponse.json({ error: "Não foi possível verificar o projeto." }, { status: 500 });
  }
  if (!p) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const permitidoGlobal = await consumirRateLimit(req, "project_password_ip", "global", JANELA_SEG, 60);
  const permitidoProjeto = await consumirRateLimit(req, "project_password", projeto, JANELA_SEG, 12);
  if (!permitidoGlobal || !permitidoProjeto) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, {
      status: 429, headers: { "Retry-After": String(JANELA_SEG) },
    });
  }

  const linkAte = (p.link_ate as string | null) ?? null;
  if (dataCalendarioExpirada(linkAte)) return NextResponse.json({ error: "Link expirado." }, { status: 403 });

  if (p.tem_senha) {
    const { data: ok, error: senhaError } = await supabase.rpc("verificar_senha_projeto", { p_projeto: projeto, p_senha: senha });
    if (senhaError) {
      registrarErro("project.access.password_rpc", req, senhaError, { projeto });
      return NextResponse.json({ error: "Não foi possível validar a senha agora." }, { status: 500 });
    }
    if (ok !== true) return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }

  const { data: pastas } = await supabase.from("galerias").select("id").eq("projeto_id", projeto).eq("visivel", true);
  const tokenProjeto = criarTokenProjeto(projeto);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(nomeCookieProjeto(projeto), tokenProjeto.valor, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: tokenProjeto.maxAge,
  });
  for (const pasta of pastas ?? []) {
    const id = String(pasta.id);
    const token = criarTokenGaleria(id);
    res.cookies.set(nomeCookieGaleria(id), token.valor, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: token.maxAge,
    });
  }
  return res;
}
