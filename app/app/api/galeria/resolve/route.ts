import { NextRequest, NextResponse } from "next/server";
import { resolvePublicGalleryRef } from "../../../../lib/gallery-public-ref.server";

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref")?.trim() || "";
  const galeria = await resolvePublicGalleryRef(ref);
  if (!galeria) return NextResponse.json({ error: "Galeria não encontrada." }, { status: 404 });
  return NextResponse.json({ id: galeria.id, ref: galeria.publicRef });
}
