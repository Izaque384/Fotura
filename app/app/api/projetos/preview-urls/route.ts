import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { signPrivateMediaUrls } from "../../../../lib/media-storage";
import { caminhoCapaAtual } from "../../../../lib/project-cover-path.server";

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
    const projectByPath = new Map((projects ?? [])
      .filter(p => Boolean(p.capa_galeria_id) && Boolean(p.capa_arquivo))
      .map(p => [auth.user!.id + "/" + p.capa_galeria_id + "/thumbs/" + p.capa_arquivo, p]));
    const resolved = await Promise.all(paths.map(async requested => {
      const project = projectByPath.get(requested);
      if (!project) throw new Error("Capa não autorizada.");
      const real = await caminhoCapaAtual(
        db, auth.user!.id, String(project.capa_galeria_id), String(project.capa_arquivo)
      );
      return { requested, real };
    }));
    const realPaths = [...new Set(resolved.map(x => x.real).filter((x): x is string => Boolean(x)))];
    const signed = await signPrivateMediaUrls(db, "fotos", realPaths, 3600);
    // Keep the old client key for dashboard compatibility; sign the actual R2
    // delivery path when the owner chose a final image after publication.
    const urls: Record<string, string> = {};
    for (const entry of resolved) {
      if (entry.real && signed[entry.real]) urls[entry.requested] = signed[entry.real];
    }
    return json({ urls });
  } catch {
    return json({ error: "Falha ao assinar as capas." }, 503);
  }
}
