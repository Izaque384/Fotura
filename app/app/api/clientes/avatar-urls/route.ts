import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { signPrivateMediaUrls } from "../../../../lib/media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status, headers: { "Cache-Control": "private, no-store" },
  });
}

/**
 * Resolve avatar preview URLs through the private media adapter.
 * Every path must be currently referenced by a client owned by the caller.
 * Does not reveal URLs for unrelated customers or arbitrary R2 keys.
 */
export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) return json({ error: "Origem inválida." }, 403);
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Não autorizado." }, 401);

  const db = createServiceClient();
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Não autorizado." }, 401);

  const raw = await req.text().catch(() => "");
  if (raw.length > 16_384) return json({ error: "Requisição muito grande." }, 413);
  let paths: string[];
  try {
    const body = JSON.parse(raw);
    if (!body || !Array.isArray(body.paths) || body.paths.length > 50 ||
        body.paths.some((x: unknown) => typeof x !== "string")) throw Error("bad paths");
    paths = [...new Set(body.paths as string[])];
  } catch {
    return json({ error: "Lista de avatares inválida." }, 400);
  }
  if (!paths.length) return json({ urls: {} });
  if (paths.some(path =>
    path.length > 500 || !path.startsWith(auth.user!.id + "/") ||
    path.includes("\\") || path.split("/").some(part => !part || part === "." || part === ".."))) {
    return json({ error: "Caminho de avatar não autorizado." }, 403);
  }

  const { data: clients, error } = await db.from("clientes")
    .select("avatar_path").eq("user_id", auth.user.id)
    .in("avatar_path", paths);
  if (error) return json({ error: "Não foi possível validar os avatares." }, 503);
  const allowed = new Set((clients ?? []).map(x => String(x.avatar_path)));
  if (paths.some(path => !allowed.has(path))) {
    return json({ error: "Avatar não pertence ao usuário." }, 403);
  }
  try {
    const urls = await signPrivateMediaUrls(db, "client-avatars", paths, 3600);
    return json({ urls });
  } catch {
    return json({ error: "Não foi possível assinar os avatares." }, 503);
  }
}
