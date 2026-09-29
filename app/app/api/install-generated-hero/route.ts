import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../lib/supabase-server";

const INSTALL_TOKEN = "ft-install-hero-9f1c7e3a";
const SOURCE_URL = "https://dnznrvs05pmza.cloudfront.net/gemini/gemini-3-pro-image/images/ac4cb4bf-c1cc-4daa-90da-438a464e973f/5c3af471-3380-406f-9e1b-683b320ce2a8/Photorealistic_premium_editorial_wedding_photograph_at_sunse.png?_jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlIYXNoIjoiYzg5MzdkMzg0YWM2ZjVlOCIsImJ1Y2tldCI6InJ1bndheS10YXNrLWFydGlmYWN0cyIsInN0YWdlIjoicHJvZCIsImV4cCI6MTc5MDgxNDY0OH0.qyrZYXBNUhzEpkH-iseU33_sxI8tAv-NH5QmrwDMPYg";
const TARGET_PATH = "landing/fotura-wedding-sunset-generated.png";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== INSTALL_TOKEN) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }

  try {
    const source = await fetch(SOURCE_URL, { cache: "no-store" });
    if (!source.ok) {
      return NextResponse.json(
        { error: "Falha ao buscar a imagem gerada.", status: source.status },
        { status: 502 }
      );
    }

    const bytes = Buffer.from(await source.arrayBuffer());
    if (!bytes.length) {
      return NextResponse.json({ error: "Imagem vazia." }, { status: 502 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase.storage
      .from("marca")
      .upload(TARGET_PATH, bytes, {
        contentType: "image/png",
        cacheControl: "31536000",
        upsert: true,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data } = supabase.storage.from("marca").getPublicUrl(TARGET_PATH);

    return NextResponse.json({
      ok: true,
      publicUrl: data.publicUrl,
      bytes: bytes.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido." },
      { status: 500 }
    );
  }
}
