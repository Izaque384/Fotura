import { NextResponse } from "next/server";
import { signPrivateR2ObjectUrl } from "../../../../lib/r2-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** TEMPORARY test: remove after verification. Only one synthetic object, never user galleries. */
export async function GET() {
  if (process.env.VERCEL_ENV !== "preview" || process.env.FOTURA_R2_SMOKE_ENABLED !== "true") {
    return new Response(null, { status: 404 });
  }

  const key = "migration-tests/r2-signed-url-probe-20261112.txt";
  const expected = "fotura-r2-s3-signed-upload-probe";
  const result = { write: false, read: false, head: false, removed: false };
  let stage = "PUT";
  let lastStatus: number | undefined;

  try {
    const put = await fetch(signPrivateR2ObjectUrl("PUT", key, 60, "text/plain"), {
      method: "PUT", headers: { "Content-Type": "text/plain" },
      body: expected, cache: "no-store", signal: AbortSignal.timeout(12_000),
    });
    lastStatus = put.status;
    result.write = put.ok;

    if (result.write) {
      stage = "GET";
      const get = await fetch(signPrivateR2ObjectUrl("GET", key, 60), {
        cache: "no-store", signal: AbortSignal.timeout(12_000),
      });
      lastStatus = get.status;
      result.read = get.ok && (await get.text()) === expected;

      stage = "HEAD";
      const head = await fetch(signPrivateR2ObjectUrl("HEAD", key, 60), {
        method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(12_000),
      });
      lastStatus = head.status;
      result.head = head.ok && Number(head.headers.get("content-length")) === Buffer.byteLength(expected);
    }
  } catch {
    lastStatus = 0;
  } finally {
    try {
      const del = await fetch(signPrivateR2ObjectUrl("DELETE", key, 60), {
        method: "DELETE", cache: "no-store", signal: AbortSignal.timeout(12_000),
      });
      result.removed = del.ok;
    } catch {
      // Check and delete any leftover synthetic object through the Cloudflare API.
    }
  }

  const ok = Object.values(result).every(Boolean);
  return NextResponse.json({ ok, result, stage, lastStatus }, {
    status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" },
  });
}
