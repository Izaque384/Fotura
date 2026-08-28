import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { criarTokenGaleria, nomeCookieGaleria } from "../../../../lib/gallery-access";

const tentativas = new Map<string, { inicio: number; qtd: number }>();
const JANELA_MS = 10 * 60 * 1000;
const MAX_TENTATIVAS = 12;

function permitido(chave: string) {
  const agora = Date.now();
  const atual = tentativas.get(chave);
  if (!atual || agora - atual.inicio > JANELA_MS) {
    tentativas.set(chave, { inicio: agora, qtd: 1 });
    return true;
  }
  atual.qtd += 1;
  tentativas.set(chave, atual);
  return atual.qtd <= MAX_TENTATIVAS;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  let body: { galeria?: string; senha?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 400 }); }
  const galeria = body.galeria?.trim();
  const senha = body.senha ?? "";
  if (!galeria || !senha) return NextResponse.json({ error: "Dados obrigatórios ausentes." }, { status: 400 });
  if (!permitido(`${ip}:${galeria}`)) return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });

  const supabase = createServiceClient();
  const { data: g } = await supabase.from("galerias").select("id,tem_senha,link_ate").eq("id", galeria).maybeSingle();
  if (!g) return NextResponse.json({ error: "Galeria não encontrada." }, { status: 404 });
  const linkAte = (g.link_ate as string | null) ?? null;
  if (linkAte && Date.now() > new Date(`${linkAte}T23:59:59`).getTime()) return NextResponse.json({ error: "Link expirado." }, { status: 403 });
  if (!g.tem_senha) return NextResponse.json({ ok: true });

  const { data: ok, error } = await supabase.rpc("verificar_senha_galeria", { p_galeria: galeria, p_senha: senha });
  if (error || ok !== true) return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });

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
