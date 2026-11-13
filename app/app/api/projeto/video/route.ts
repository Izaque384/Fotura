import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { caminhoVideoValido, VIDEO_ABERTURA_BUCKET, VIDEO_ABERTURA_MAX_BYTES, lerAbertura } from "../../../../lib/cinematic-intro";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { readBoundedRequestText, RequestBodyTooLargeError } from "../../../../lib/limited-request-body";
import { uuidValido } from "../../../../lib/validation";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { contextoPlano } from "../../../../lib/billing-usage";
import { isR2ReadEnabled, signPrivateR2ObjectUrl } from "../../../../lib/r2-storage";
import { selectedMediaUploadProvider } from "../../../../lib/r2-aux-media";
import { signPrivateMediaUrl } from "../../../../lib/media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const finalCutover = () => process.env.FOTURA_R2_FINAL_CUTOVER === "true";
const r2Requested = () => process.env.FOTURA_R2_UPLOAD_ENABLED === "true" || finalCutover();
const r2Ready = () => selectedMediaUploadProvider() === "r2";

async function r2VideoHead(path: string) {
  const res = await fetch(signPrivateR2ObjectUrl("HEAD", path, 60), {
    method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return null;
  const bytes = Number(res.headers.get("content-length"));
  const mime = res.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!Number.isSafeInteger(bytes) || bytes <= 0 ||
      bytes > VIDEO_ABERTURA_MAX_BYTES || mime !== "video/mp4") return null;
  return { bytes, etag: res.headers.get("etag")?.slice(0, 250) ?? null };
}

async function verifiedR2VideoDelete(path: string): Promise<boolean> {
  const result = await fetch(signPrivateR2ObjectUrl("DELETE", path, 60), {
    method: "DELETE", cache: "no-store", signal: AbortSignal.timeout(12_000),
  });
  if (!result.ok && result.status !== 404) return false;
  const head = await fetch(signPrivateR2ObjectUrl("HEAD", path, 60), {
    method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(12_000),
  });
  return head.status === 404;
}


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
  if (isR2ReadEnabled()) {
    const { data: match, error } = await db.from("fotura_media_objects")
      .select("bytes").eq("bucket", VIDEO_ABERTURA_BUCKET).eq("object_key", path)
      .maybeSingle();
    if (error) return null;
    if (match) return r2VideoHead(path);
  }

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
  try {
    body = JSON.parse(await readBoundedRequestText(req, 4096));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw Error("invalid");
  } catch (error) {
    return error instanceof RequestBodyTooLargeError
      ? json({ error: "Requisição muito grande." }, 413)
      : json({ error: "Dados inválidos." }, 400);
  }
  const ctx = await dono(req, body.projeto ?? "");
  if (!ctx) return json({ error: "Projeto não encontrado ou sessão expirada." }, 401);
  // A requested R2 cutover must NEVER silently store some media in Supabase.
  if (r2Requested() && !r2Ready()) return json({
    error: "Armazenamento R2 indisponível. Nenhum vídeo foi enviado.",
  }, 503);
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
    if (r2Ready()) {
      // New MP4 uploads go solely to R2. Count verified versions; never
      // remove the currently published video or expose the bucket publicly.
      const { data: existentesR2, error: registryError } = await db.from("fotura_media_objects")
        .select("object_key").eq("bucket", VIDEO_ABERTURA_BUCKET)
        .eq("owner_id", userId).like("object_key", prefixo + "/%").limit(6);
      if (registryError) return json({ error: "Não foi possível conferir os vídeos do R2." }, 503);
      if ((existentesR2 ?? []).length >= 5) return json({
        error: "Limite de versões de vídeo atingido. Remova versões não publicadas antes de enviar outra.",
      }, 409);
      const { count: pendingVideos, error: pendingError } = await db
        .from("fotura_r2_upload_reservations")
        .select("id", { count: "exact", head: true })
        .eq("bucket", VIDEO_ABERTURA_BUCKET).eq("owner_id", userId)
        .eq("state", "pending").gt("expires_at", new Date().toISOString())
        .like("object_key", prefixo + "/%");
      if (pendingError) return json({ error: "Não foi possível verificar uploads pendentes." }, 503);
      if ((existentesR2 ?? []).length + (pendingVideos ?? 0) >= 5) return json({
        error: "Limite de vídeos e envios pendentes atingido. Conclua ou cancele um envio anterior.",
      }, 409);
      const path = prefixo + "/" + randomUUID() + ".mp4";
      const { error: reserveError } = await db.from("fotura_r2_upload_reservations").insert({
        bucket: VIDEO_ABERTURA_BUCKET, object_key: path, thumbnail_key: null,
        owner_id: userId, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      if (reserveError) return json({ error: "Não foi possível reservar o envio R2." }, 503);
      return json({ path, provider: "r2", url: signPrivateR2ObjectUrl("PUT", path, 5 * 60, "video/mp4", [], true) });
    }
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
    const objeto = r2Ready() ? await r2VideoHead(body.path) : await objetoVideo(db, body.path);
    if (!objeto) return json({ error: "O MP4 enviado não foi encontrado ou excede 25 MB." }, 400);
    const args = r2Ready()
      ? { p_user_id: userId, p_projeto_id: projeto.id, p_path: body.path,
          p_bytes: objeto.bytes, p_etag: "etag" in objeto ? objeto.etag : null }
      : { p_user_id: userId, p_projeto_id: projeto.id, p_path: body.path, p_bytes: objeto.bytes };
    const { data: registrado, error: registroErro } = await db.rpc(
      r2Ready() ? "registrar_video_r2_upload_backend" : "registrar_video_abertura_upload_backend", args);
    if (registroErro || !registrado) return json({ error: "Não foi possível registrar o vídeo enviado." }, 503);
    const url = await signPrivateMediaUrl(db, VIDEO_ABERTURA_BUCKET, body.path, 20 * 60);
    return url ? json({ path: body.path, url })
      : json({ error: "Não foi possível carregar a prévia." }, 503);
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
  const url = await signPrivateMediaUrl(ctx.db, VIDEO_ABERTURA_BUCKET, path, 20 * 60);
  return url ? json({ url }) : json({ error: "Não foi possível carregar o vídeo." }, 503);
}

// Remove tentativas não publicadas sem afetar o vídeo em uso no projeto.
export async function DELETE(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return json({ error: "Origem inválida." }, 403);
  let body: { projeto?: string; path?: string };
  try {
    body = JSON.parse(await readBoundedRequestText(req, 4096));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw Error("invalid");
  } catch (error) {
    return error instanceof RequestBodyTooLargeError
      ? json({ error: "Requisição muito grande." }, 413)
      : json({ error: "Dados inválidos." }, 400);
  }
  const ctx = await dono(req, body.projeto ?? "");
  if (!ctx) return json({ error: "Não autorizado." }, 401);
  if (!caminhoDoDono(body.path, ctx.userId, ctx.projeto.id)) return json({ error: "Vídeo inválido." }, 400);
  if (lerAbertura(ctx.projeto.abertura_config).video === body.path)
    return json({ error: "Remova o vídeo das configurações e salve antes de excluí-lo." }, 409);
  if (isR2ReadEnabled()) {
    const { data: entry, error: lookupError } = await ctx.db.from("fotura_media_objects")
      .select("object_key").eq("bucket", VIDEO_ABERTURA_BUCKET).eq("object_key", body.path)
      .eq("owner_id", ctx.userId).maybeSingle();
    if (lookupError) return json({ error: "Não foi possível verificar o vídeo." }, 503);
    const { data: pending, error: pendingError } = r2Ready()
      ? await ctx.db.from("fotura_r2_upload_reservations")
          .select("object_key").eq("bucket", VIDEO_ABERTURA_BUCKET).eq("object_key", body.path)
          .eq("owner_id", ctx.userId).eq("state", "pending").maybeSingle()
      : { data: null, error: null };
    if (pendingError) return json({ error: "Não foi possível verificar o envio R2." }, 503);
    if (pending && !entry) {
      // Fence a video still being uploaded before physical deletion. Its
      // create-only signed PUT may remain active for five more minutes.
      // The orphan worker rechecks the media registry under a lease after
      // ten minutes, avoiding a race against successful confirmation.
      const { data: cancelled, error: cancelError } = await ctx.db
        .from("fotura_r2_upload_reservations")
        .update({
          state: "cleaning",
          lease_token: null,
          lease_until: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        })
        .eq("bucket", VIDEO_ABERTURA_BUCKET).eq("object_key", body.path)
        .eq("owner_id", ctx.userId).eq("state", "pending")
        .select("id").maybeSingle();
      if (cancelError) return json({ error: "Falha ao cancelar envio do vídeo." }, 503);
      if (!cancelled) return json({ error: "Envio já finalizado ou cancelado." }, 409);
      return json({ ok: true, cleanupScheduled: true });
    }
    if (entry) {
      // Published videos cannot be deleted by this endpoint.
      const { data: current, error: freshError } = await ctx.db.from("galeria_projetos")
        .select("abertura_config").eq("id", ctx.projeto.id).eq("user_id", ctx.userId).single();
      if (freshError || !current) return json({ error: "Não foi possível verificar o vídeo publicado." }, 503);
      if (lerAbertura(current.abertura_config).video === body.path) {
        return json({ error: "Vídeo ainda publicado. Remova-o das configurações antes de excluir." }, 409);
      }
      const removed = await verifiedR2VideoDelete(body.path);
      if (!removed) return json({ error: "Não foi possível confirmar a exclusão no R2." }, 503);
      const { error } = await ctx.db.from("fotura_media_objects").delete()
        .eq("bucket", VIDEO_ABERTURA_BUCKET).eq("object_key", body.path)
        .eq("owner_id", ctx.userId);
      if (error) return json({ error: "Arquivo excluído, mas o registro exige nova tentativa." }, 503);
      return json({ ok: true });
    }
  }
  const { error } = await ctx.db.storage.from(VIDEO_ABERTURA_BUCKET).remove([body.path]);
  return error ? json({ error: "Não foi possível excluir o vídeo." }, 503) : json({ ok: true });
}
