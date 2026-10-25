import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { caminhoVideoValido, VIDEO_ABERTURA_BUCKET, VIDEO_ABERTURA_MAX_BYTES, lerAbertura } from "../../../../lib/cinematic-intro";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { uuidValido } from "../../../../lib/validation";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { contextoPlano } from "../../../../lib/billing-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, private" } });

async function dono(req: NextRequest, projeto: string) {
  if (!uuidValido(projeto)) return null;
  const access = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!access) return null;
  const db = createServiceClient();
  const { data: auth, error } = await db.auth.getUser(access);
  if (error || !auth.user) return null;
  const { data: p } = await db.from("galeria_projetos")
    .select("id,user_id,abertura_config").eq("id", projeto).eq("user_id", auth.user.id).maybeSingle();
  return p ? { db, userId: auth.user.id, projeto: p } : null;
}

function caminhoDoDono(path: unknown, userId: string, projeto: string): path is string {
  return caminhoVideoValido(path) && path.startsWith(`${userId}/${projeto}/`);
}

async function objetoVideo(db: ReturnType<typeof createServiceClient>, path: string) {
  const slash = path.lastIndexOf("/");
  const { data, error } = await db.storage.from(VIDEO_ABERTURA_BUCKET)
    .list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 100 });
  if (error) return null;
  const arquivo = data?.find((x) => x.name === path.slice(slash + 1) && x.id);
  if (!arquivo) return null;
  const bytes = Number(arquivo.metadata?.size ?? 0);
  const mime = String(arquivo.metadata?.mimetype ?? "");
  return bytes > 0 && bytes <= VIDEO_ABERTURA_MAX_BYTES && mime === "video/mp4" ? { bytes } : null;
}

export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return json({ error: "Origem inválida." }, 403);
  let body: { projeto?: string; acao?: string; path?: string; bytes?: number };
  try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }
  const ctx = await dono(req, body.projeto ?? "");
  if (!ctx) return json({ error: "Projeto não encontrado ou sessão expirada." }, 401);
  const { db, userId, projeto } = ctx;
  if (!(await consumirRateLimit(req, "cinematic_video_upload", userId, 600, 24)))
    return json({ error: "Muitas tentativas de envio. Tente novamente em alguns minutos." }, 429);

  if (body.acao === "preparar") {
    const bytes = Number(body.bytes);
    if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > VIDEO_ABERTURA_MAX_BYTES)
      return json({ error: "O vídeo deve ter até 25 MB." }, 400);

    // Um URL assinado dá permissão apenas para um arquivo, não para o bucket.
    const { data: quota, error: quotaErro } = await db.rpc("status_uso_justo_upload_backend", { p_user_id: userId });
    const usados = Number(quota?.bytes_enviados ?? 0);
    const limite = Number(quota?.limite_bytes ?? 0);
    if (quotaErro || quota?.bloqueado || (limite > 0 && usados + bytes > limite))
      return json({ error: "A franquia mensal de envios não permite este vídeo. Consulte seu plano." }, 403);

    // A franquia mensal de upload não substitui o limite de armazenamento do plano.
    const contexto = await contextoPlano(db, userId).catch(() => null);
    if (!contexto) return json({ error: "Não foi possível verificar o limite de armazenamento." }, 503);
    const limiteGb = contexto.limites.armazenamento.limiteGb;
    if (limiteGb !== null && contexto.uso.armazenamentoBytes + bytes > limiteGb * 1024 * 1024 * 1024)
      return json({ error: "O vídeo ultrapassaria o limite de armazenamento do seu plano." }, 403);

    const prefixo = `${userId}/${projeto.id}`;
    const { data: existentes, error: listErro } = await db.storage.from(VIDEO_ABERTURA_BUCKET)
      .list(prefixo, { limit: 100 });
    if (listErro) return json({ error: "Não foi possível consultar o armazenamento." }, 503);
    const atual = lerAbertura(projeto.abertura_config).video;
    // Limpa tentativas antigas não publicadas; jamais exclui o vídeo atual.
    const antigos = (existentes ?? []).filter((x) => x.id && x.name.endsWith(".mp4") &&
      `${prefixo}/${x.name}` !== atual &&
      Date.now() - new Date(x.created_at ?? 0).getTime() > 2 * 60 * 60 * 1000);
    if (antigos.length) await db.storage.from(VIDEO_ABERTURA_BUCKET)
      .remove(antigos.map((x) => `${prefixo}/${x.name}`));
    const recentes = (existentes ?? []).filter((x) => x.id && !antigos.includes(x));
    if (recentes.length >= 5)
      return json({ error: "Limite de versões temporárias alcançado. Aguarde para tentar novamente ou remova o vídeo anterior." }, 409);

    const path = `${prefixo}/${randomUUID()}.mp4`;
    const { data, error } = await db.storage.from(VIDEO_ABERTURA_BUCKET).createSignedUploadUrl(path);
    if (error || !data?.token) return json({ error: "Não foi possível iniciar o envio." }, 503);
    return json({ path, token: data.token });
  }

  if (body.acao === "confirmar") {
    if (!caminhoDoDono(body.path, userId, projeto.id))
      return json({ error: "Vídeo inválido." }, 400);
    const objeto = await objetoVideo(db, body.path);
    if (!objeto) return json({ error: "O MP4 enviado não foi encontrado ou excede 25 MB." }, 400);
    const { data: registrado, error: registroErro } = await db.rpc("registrar_video_abertura_upload_backend", {
      p_user_id: userId, p_projeto_id: projeto.id, p_path: body.path, p_bytes: objeto.bytes,
    });
    if (registroErro || !registrado) return json({ error: "Não foi possível registrar o vídeo enviado." }, 503);
    const { data, error } = await db.storage.from(VIDEO_ABERTURA_BUCKET).createSignedUrl(body.path, 20 * 60);
    if (error || !data?.signedUrl) return json({ error: "Não foi possível carregar a prévia." }, 503);
    return json({ path: body.path, url: data.signedUrl });
  }
  return json({ error: "Ação inválida." }, 400);
}

export async function GET(req: NextRequest) {
  const projeto = req.nextUrl.searchParams.get("projeto") ?? "";
  const path = req.nextUrl.searchParams.get("path") ?? "";
  const ctx = await dono(req, projeto);
  if (!ctx) return json({ error: "Não autorizado." }, 401);
  if (!caminhoDoDono(path, ctx.userId, projeto)) return json({ error: "Vídeo inválido." }, 400);
  const objeto = await objetoVideo(ctx.db, path);
  if (!objeto) return json({ error: "Vídeo não encontrado." }, 404);
  const { data, error } = await ctx.db.storage.from(VIDEO_ABERTURA_BUCKET).createSignedUrl(path, 20 * 60);
  return error || !data?.signedUrl ? json({ error: "Não foi possível carregar o vídeo." }, 503) : json({ url: data.signedUrl });
}

// Remove tentativas não publicadas sem afetar o vídeo em uso no projeto.
export async function DELETE(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return json({ error: "Origem inválida." }, 403);
  let body: { projeto?: string; path?: string };
  try { body = await req.json(); } catch { return json({ error: "Dados inválidos." }, 400); }
  const ctx = await dono(req, body.projeto ?? "");
  if (!ctx) return json({ error: "Não autorizado." }, 401);
  if (!caminhoDoDono(body.path, ctx.userId, ctx.projeto.id)) return json({ error: "Vídeo inválido." }, 400);
  if (lerAbertura(ctx.projeto.abertura_config).video === body.path)
    return json({ error: "Remova o vídeo das configurações e salve antes de excluí-lo." }, 409);
  const { error } = await ctx.db.storage.from(VIDEO_ABERTURA_BUCKET).remove([body.path]);
  return error ? json({ error: "Não foi possível excluir o vídeo." }, 503) : json({ ok: true });
}
