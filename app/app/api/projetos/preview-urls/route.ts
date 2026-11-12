import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { signPrivateMediaUrls } from "../../../../lib/media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, private" } });

/** Signed project covers from either verified R2 or legacy Supabase Storage.
 * Only owner-managed, currently referenced project cover thumbnails qualify.
 */
export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return json({ error: "Origem inválida." }, 403);
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Não autorizado." }, 401);
  const db = createServiceClient();
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Não autorizado." }, 401);

  const raw = await req.text().catch(() => "");
  if (raw.length > 40_000) return json({ error: "Requisição muito grande." }, 413);
  let paths: string[];
  try {
    const body = JSON.parse(raw);
    if (!Array.isArray(body?.paths) || body.paths.length > 200 ||
        body.paths.some((path: unknown) => typeof path !== "string")) throw Error("invalid");
    paths = [...new Set(body.paths as string[])];
  } catch {
    return json({ error: "Caminhos inválidos." }, 400);
  }
  if (!paths.length) return json({ urls: {} });
  if (paths.some(path => path.length > 600 || !path.startsWith(auth.user!.id + "/") ||
    path.includes("\\") || path.split("/").some(s => !s || s === "." || s === ".."))) {
    return json({ error: "Caminho inválido." }, 403);
  }

  const { data: projects, error } = await db.from("galeria_projetos")
    .select("capa_galeria_id,capa_arquivo").eq("user_id", auth.user.id);
  if (error) return json({ error: "Não foi possível validar projetos." }, 503);
  const allowed = new Set((projects ?? [])
    .filter(p => Boolean(p.capa_galeria_id) && Boolean(p.capa_arquivo))
    .map(p => auth.user!.id + "/" + p.capa_galeria_id + "/thumbs/" + p.capa_arquivo));
  if (paths.some(path => !allowed.has(path))) return json({ error: "Capa não autorizada." }, 403);

  try {
    return json({ urls: await signPrivateMediaUrls(db, "fotos", paths, 3600) });
  } catch {
    return json({ error: "Falha ao assinar as capas." }, 503);
  }
}
