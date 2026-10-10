import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createServiceClient } from "../../../../lib/supabase-server";
import { verifyGalleryWatermarkToken } from "../../../../lib/gallery-watermark-token";
import { registrarErro } from "../../../../lib/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[char] || char);
}

export async function GET(req: NextRequest) {
  let token;
  try {
    token = verifyGalleryWatermarkToken(req.nextUrl.searchParams.get("token"));
  } catch (error) {
    registrarErro("gallery.watermark.secret", req, error);
    return NextResponse.json({ error: "Prévia indisponível." }, { status: 503 });
  }
  if (!token) return NextResponse.json({ error: "Prévia inválida ou expirada." }, { status: 401 });

  const supabase = createServiceClient();
  const caminho = `${token.u}/${token.g}/thumbs/${token.f}`;
  const { data, error } = await supabase.storage.from("fotos").download(caminho);
  if (error || !data) {
    registrarErro("gallery.watermark.thumb", req, error || new Error("thumbnail missing"), { galeria: token.g, arquivo: token.f });
    return NextResponse.json({ error: "Prévia não disponível." }, { status: 404 });
  }

  try {
    const input = Buffer.from(await data.arrayBuffer());
    const pipeline = sharp(input, { failOn: "none" }).rotate();
    const meta = await pipeline.metadata();
    const width = Math.max(1, meta.width || 1200);
    const height = Math.max(1, meta.height || 800);
    const fontSize = Math.max(18, Math.min(46, Math.round(width / 17)));
    const patternWidth = Math.max(260, Math.min(560, Math.round(width * 0.55)));
    const patternHeight = Math.max(120, Math.round(fontSize * 4.3));
    const opacity = Math.min(0.7, Math.max(0.05, token.o / 100));
    const strokeOpacity = Math.min(0.58, opacity + 0.16);
    const label = escapeXml(token.t.toUpperCase());

    const overlay = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <defs>
          <pattern id="wm" width="${patternWidth}" height="${patternHeight}" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)">
            <text x="16" y="${Math.round(patternHeight * 0.58)}"
              font-family="Arial, Helvetica, sans-serif"
              font-size="${fontSize}"
              font-weight="700"
              letter-spacing="1.5"
              fill="#ffffff"
              fill-opacity="${opacity.toFixed(3)}"
              stroke="#000000"
              stroke-opacity="${strokeOpacity.toFixed(3)}"
              stroke-width="1.2"
              paint-order="stroke">${label}</text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wm)"/>
      </svg>`,
      "utf8"
    );

    const output = await pipeline
      .composite([{ input: overlay, blend: "over" }])
      .webp({ quality: 86, effort: 4 })
      .toBuffer();

    return new NextResponse(new Uint8Array(output), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(output.byteLength),
        "Cache-Control": "public, max-age=300, s-maxage=1800",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    registrarErro("gallery.watermark.render", req, error, { galeria: token.g, arquivo: token.f });
    return NextResponse.json({ error: "Não foi possível gerar a prévia protegida." }, { status: 500 });
  }
}
