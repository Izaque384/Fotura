import { NextRequest, NextResponse } from "next/server";
import { resolvePublicGalleryRef } from "../../../../lib/gallery-public-ref.server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { publicProjectRef } from "../../../../lib/project-links";

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref")?.trim() || "";
  const galeria = await resolvePublicGalleryRef(ref);
  if (!galeria) return NextResponse.json({ error: "Galeria não encontrada." }, { status: 404 });
  let projectRef: string | null = null;
  if (galeria.projectId) {
    const supabase = createServiceClient();
    const { data: projeto } = await supabase.from("galeria_projetos").select("id,slug").eq("id", galeria.projectId).maybeSingle();
    if (projeto) projectRef = publicProjectRef(String(projeto.slug || "projeto"), String(projeto.id));
  }
  return NextResponse.json({ id: galeria.id, ref: galeria.publicRef, projectRef });
}
