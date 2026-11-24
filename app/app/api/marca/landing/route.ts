import { NextResponse } from "next/server";
import { signPrivateR2ObjectUrl } from "../../../../lib/r2-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const key = "marca/landing/fotura-wedding-sunset-generated.png";

/** Immutable marketing image: publicly visible, physically stored in private R2. */
export async function GET() {
  try {
    const head = await fetch(signPrivateR2ObjectUrl("HEAD", key, 90), {
      method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!head.ok || head.headers.get("content-type") !== "image/png") {
      return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.redirect(signPrivateR2ObjectUrl("GET", key, 900), {
      status: 307,
      headers: { "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}