import { NextResponse } from "next/server";
import { beginR2Multipart, signedR2PartUrl, listR2MultipartParts, finishR2Multipart, abortR2Multipart, R2_PART_BYTES } from "../../../lib/r2-multipart";
import { signPrivateR2ObjectUrl } from "../../../lib/r2-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// TEMPORARY, preview only. Remove immediately after this synthetic verification.
export async function GET() {
  if (process.env.VERCEL_ENV !== "preview" || process.env.FOTURA_R2_SMOKE_ENABLED !== "true") {
    return new Response(null, { status: 404 });
  }
  const key = "migration-tests/r2-multipart-probe-v1.bin";
  const abortKey = "migration-tests/r2-multipart-abort-probe-v1.bin";
  const chunk = Buffer.alloc(R2_PART_BYTES, 0x4c);
  const last = Buffer.from("fotura-r2-multipart-probe-v1", "utf8");
  const size = chunk.length + last.length;
  let uploadId: string | null = null;
  let abortId: string | null = null;
  let stage = "begin";
  let errorCode = 0;
  const result = { begin: false, part1: false, part2: false, listed: false,
    complete: false, head: false, range: false, deleted: false, aborted: false };

  try {
    uploadId = await beginR2Multipart(key, "application/octet-stream");
    result.begin = true;
    stage = "part1";
    const p1 = await fetch(signedR2PartUrl(key, uploadId, 1), {
      method: "PUT", body: chunk, cache: "no-store", signal: AbortSignal.timeout(35_000),
    });
    errorCode = p1.status;
    result.part1 = p1.ok && Boolean(p1.headers.get("etag"));
    if (!result.part1) throw new Error("part1");

    stage = "part2";
    const p2 = await fetch(signedR2PartUrl(key, uploadId, 2), {
      method: "PUT", body: last, cache: "no-store", signal: AbortSignal.timeout(35_000),
    });
    errorCode = p2.status;
    result.part2 = p2.ok && Boolean(p2.headers.get("etag"));
    if (!result.part2) throw new Error("part2");

    stage = "list";
    const parts = await listR2MultipartParts(key, uploadId);
    result.listed = parts.length === 2 && parts[0].bytes === chunk.length && parts[1].bytes === last.length;
    if (!result.listed) throw new Error("list");

    stage = "complete";
    await finishR2Multipart(key, uploadId, size);
    uploadId = null;
    result.complete = true;

    stage = "head";
    const head = await fetch(signPrivateR2ObjectUrl("HEAD", key, 60), {
      method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(12_000),
    });
    errorCode = head.status;
    result.head = head.ok && Number(head.headers.get("content-length")) === size;
    if (!result.head) throw new Error("head");

    stage = "range";
    const range = await fetch(signPrivateR2ObjectUrl("GET", key, 60), {
      headers: { Range: "bytes=" + chunk.length + "-" + (size - 1) },
      cache: "no-store", signal: AbortSignal.timeout(12_000),
    });
    result.range = range.status === 206 && (await range.text()) === last.toString("utf8");

    stage = "abort";
    abortId = await beginR2Multipart(abortKey, "application/octet-stream");
    await abortR2Multipart(abortKey, abortId);
    abortId = null;
    result.aborted = true;
  } catch {
    // No secrets, multipart upload IDs, or object keys are returned to the caller.
  } finally {
    if (uploadId) { try { await abortR2Multipart(key, uploadId); } catch {} }
    if (abortId) { try { await abortR2Multipart(abortKey, abortId); } catch {} }
    try {
      const res = await fetch(signPrivateR2ObjectUrl("DELETE", key, 60), {
        method: "DELETE", cache: "no-store", signal: AbortSignal.timeout(10_000),
      });
      result.deleted = res.ok;
    } catch {}
  }
  const ok = Object.values(result).every(Boolean);
  return NextResponse.json({ ok, stage, httpStatus: errorCode, result }, {
    status: ok ? 200 : 503, headers: { "Cache-Control": "private, no-store" },
  });
}
