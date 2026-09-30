import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../lib/supabase-server";
import { consumirRateLimit } from "../../../lib/rate-limit";
import { requisicaoMesmoOrigin } from "../../../lib/request-security";
import { registrarErro } from "../../../lib/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TIPOS = new Set(["problema", "sugestao", "feedback"]);
const CATEGORIAS = new Set(["galerias", "clientes", "selecoes", "vendas", "planos", "perfil", "conta", "outro"]);
const MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_ARQUIVO = 5 * 1024 * 1024;

function texto(form: FormData, nome: string) {
  const valor = form.get(nome);
  return typeof valor === "string" ? valor.trim() : "";
}

function nomeSeguro(nome: string) {
  const base = nome.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return base.slice(0, 100) || "screenshot";
}

export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }

  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const supabase = createServiceClient();
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const permitido = await consumirRateLimit(req, "feedback_submit", auth.user.id, 60 * 60, 12);
  if (!permitido) {
    return NextResponse.json(
      { error: "Muitas mensagens em pouco tempo. Tente novamente mais tarde." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  try {
    const form = await req.formData();
    const tipo = texto(form, "tipo");
    const categoria = texto(form, "categoria");
    const assunto = texto(form, "assunto");
    const mensagem = texto(form, "mensagem");
    const paginaOrigem = texto(form, "pagina_origem").slice(0, 500) || null;
    const navegador = texto(form, "navegador").slice(0, 500) || null;
    const notaBruta = texto(form, "nota");
    const nota = notaBruta ? Number(notaBruta) : null;

    if (!TIPOS.has(tipo)) return NextResponse.json({ error: "Tipo de mensagem inválido." }, { status: 400 });
    if (!CATEGORIAS.has(categoria)) return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
    if (assunto.length < 3 || assunto.length > 120) {
      return NextResponse.json({ error: "O assunto deve ter entre 3 e 120 caracteres." }, { status: 400 });
    }
    if (mensagem.length < 10 || mensagem.length > 3000) {
      return NextResponse.json({ error: "A mensagem deve ter entre 10 e 3000 caracteres." }, { status: 400 });
    }
    if (nota !== null && (!Number.isInteger(nota) || nota < 1 || nota > 5)) {
      return NextResponse.json({ error: "A avaliação deve estar entre 1 e 5." }, { status: 400 });
    }

    const arquivo = form.get("screenshot");
    let screenshotPath: string | null = null;
    let screenshotNome: string | null = null;
    let screenshotMime: string | null = null;
    let screenshotBytes: number | null = null;

    if (arquivo instanceof File && arquivo.size > 0) {
      if (arquivo.size > MAX_ARQUIVO) {
        return NextResponse.json({ error: "A imagem deve ter no máximo 5 MB." }, { status: 400 });
      }
      if (!MIMES.has(arquivo.type)) {
        return NextResponse.json({ error: "Envie uma imagem PNG, JPG ou WebP." }, { status: 400 });
      }

      const idArquivo = randomUUID();
      screenshotNome = nomeSeguro(arquivo.name);
      screenshotMime = arquivo.type;
      screenshotBytes = arquivo.size;
      screenshotPath = `${auth.user.id}/${idArquivo}-${screenshotNome}`;

      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from("feedback-anexos")
        .upload(screenshotPath, bytes, { contentType: arquivo.type, upsert: false });

      if (uploadError) throw uploadError;
    }

    const { data, error } = await supabase
      .from("feedbacks")
      .insert({
        user_id: auth.user.id,
        tipo,
        categoria,
        assunto,
        mensagem,
        nota: tipo === "feedback" ? nota : null,
        pagina_origem: paginaOrigem,
        navegador,
        screenshot_path: screenshotPath,
        screenshot_nome: screenshotNome,
        screenshot_mime: screenshotMime,
        screenshot_bytes: screenshotBytes,
      })
      .select("id,criado_em")
      .single();

    if (error) {
      if (screenshotPath) await supabase.storage.from("feedback-anexos").remove([screenshotPath]);
      throw error;
    }

    return NextResponse.json({
      ok: true,
      id: data.id,
      criadoEm: data.criado_em,
      mensagem: tipo === "problema"
        ? "Problema enviado. Vamos analisar as informações."
        : tipo === "sugestao"
          ? "Sugestão enviada. Obrigado por ajudar a evoluir o Fotura."
          : "Feedback enviado. Obrigado por compartilhar sua experiência.",
    });
  } catch (error) {
    registrarErro("feedback.submit", req, error, { userId: auth.user.id });
    return NextResponse.json({ error: "Não foi possível enviar sua mensagem agora." }, { status: 500 });
  }
}
