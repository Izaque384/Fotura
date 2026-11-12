import { NextResponse } from "next/server";
import { signPrivateR2ObjectUrl } from "../../../../lib/r2-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TEMPORARY smoke test: remove from the branch after verification.
 * Operates ONLY on one synthetic fixed object; never reads user galleries.
 */
export async function GET() {
  if (process.env.VERCEL_ENV !== "preview" || process.env.FOTURA_R2_SMOKE_ENABLED !== "true") {
    return new Response(null, { status: 404 });
  }

  const key = "migration-tests/r2-signed-url-probe-20261112.txt";
  const expected = "fotura-r2-s3-signed-upload-probe";
  const result = { write: false, read: false, head: false, removed: false };

  try {
    const put = await fetch(signPrivateR2ObjectUrl("PUT", key, 60, "text/plain"), {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: expected,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    result.write = put.ok;
    if (!put.ok) return NextResponse.json({ ok: false, result, stage: "PUT", httpStatus: put.status }, { status: 503 });

    const get = await fetch(signPrivateR2ObjectUrl("GET", key, 60), {
      cache: "no-store", signal: AbortSignal.timeout(12_000),
    });
    result.read = get.ok && (await get.text()) === expected;

    const head = await fetch(signPrivateR2ObjectUrl("HEAD", key, 60), {
      method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(12_000),
    });
    result.head = head.ok && Number(head.headers.get("content-length")) === Buffer.byteLength(expected);
    return NextResponse.json({ ok: result.write && result.read && result.head, result, getStatus: get.status, headStatus: head.status }, {
      status: result.write && result.read && result.head ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ ok: false, result, stage: "request" }, { status: 503 });
  } finally {
    try {
      const del = await fetch(signPrivateR2ObjectUrl("DELETE", key, 60), {
        method: "DELETE", cache: "no-store", signal: AbortSignal.timeout(12_000),
      });
      result.removed = del.ok;
    } catch {
      // An independent cleanup check must remove a synthetic object left behind.
    }
  }
}
