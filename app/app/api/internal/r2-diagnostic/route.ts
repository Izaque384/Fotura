import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { signPrivateR2ObjectUrl } from "../../../../lib/r2-storage";
import { beginR2Multipart, abortR2Multipart, signedR2PartUrl, listR2MultipartParts, finishR2Multipart } from "../../../../lib/r2-multipart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Restricted synthetic R2 upload probe; never reads or writes customer media. */
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-cleanup-token");
  if (!token || !/^[0-9a-f]{64}$/i.test(token)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const db = createServiceClient();
  const { data: authorized, error } = await db.rpc("storage_cleanup_authorized", {
    p_token: token,
  });
  if (error || authorized !== true) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const key = "_fotura_diagnostics/r2-smoke-" + randomUUID() + ".jpg";
  const body = Buffer.from("synthetic-fotura-r2-upload-probe-v1", "utf8");
  const type = "image/jpeg";
  const phases: Array<Record<string, string | number | boolean>> = [];
  let stage = "preflight";
  let uploaded = false;

  try {
    const uploadUrl = signPrivateR2ObjectUrl("PUT", key, 120, type, [], true);
    const parsed = new URL(uploadUrl);
    phases.push({
      stage: "signature_structure",
      credentialParts: (parsed.searchParams.get("X-Amz-Credential") ?? "").split("/").length,
      credentialKeyLength: (parsed.searchParams.get("X-Amz-Credential") ?? "").split("/")[0].length,
      credentialKeyAscii: /^[A-Za-z0-9]+$/.test((parsed.searchParams.get("X-Amz-Credential") ?? "").split("/")[0]),
      queryHasEncodedSlash: /%2F/i.test(parsed.search),
      hasSignature: Boolean(parsed.searchParams.get("X-Amz-Signature")),
    });
    const missing = await fetch(signPrivateR2ObjectUrl("HEAD", key, 60), {
      method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(12_000),
    });
    phases.push({ stage: "head_missing", status: missing.status });
    const preflight = await fetch(uploadUrl, {
      method: "OPTIONS",
      headers: {
        Origin: "https://foturax.com.br",
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "content-type,if-none-match",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const allowedOrigin = preflight.headers.get("access-control-allow-origin");
    phases.push({ stage, status: preflight.status, cors: allowedOrigin === "https://foturax.com.br" });
    if (!preflight.ok || allowedOrigin !== "https://foturax.com.br") {
      return NextResponse.json({ ok: false, phases, issue: "browser_cors_preflight" }, { status: 502 });
    }

    stage = "put";
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": type, "If-None-Match": "*", Origin: "https://foturax.com.br" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const xml = put.ok ? "" : await put.text().catch(() => "");
    const code = xml.match(/<Code>([^<]{1,120})<\/Code>/)?.[1] ?? "no_code";
    const detail = xml.match(/<Message>([^<]{1,220})<\/Message>/)?.[1] ?? "sem detalhes";
    phases.push({ stage, status: put.status, code, detail });
    if (!put.ok) {
      return NextResponse.json({ ok: false, phases, issue: "signed_put_rejected" }, { status: 502 });
    }
    uploaded = true;
    stage = "head";
    const head = await fetch(signPrivateR2ObjectUrl("HEAD", key, 60), {
      method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(12_000),
    });
    const bytes = Number(head.headers.get("content-length"));
    phases.push({ stage, status: head.status, match: head.ok && bytes === body.length });
    if (!head.ok || bytes !== body.length) {
      return NextResponse.json({ ok: false, phases, issue: "head_integrity" }, { status: 502 });
    }

    stage = "read";
    const get = await fetch(signPrivateR2ObjectUrl("GET", key, 60), {
      method: "GET", cache: "no-store", signal: AbortSignal.timeout(12_000),
    });
    const download = get.ok ? Buffer.from(await get.arrayBuffer()) : null;
    const match = Boolean(download?.equals(body));
    phases.push({ stage, status: get.status, match });
    if (!match) {
      return NextResponse.json({ ok: false, phases, issue: "read_integrity" }, { status: 502 });
    }
    stage = "multipart_init";
    const multipartKey = "_fotura_diagnostics/r2-multipart-" + randomUUID() + ".jpg";
    let multipartId: string | null = null;
    let completedMultipart = false;
    try {
      multipartId = await beginR2Multipart(multipartKey, "image/jpeg");
      phases.push({ stage, ok: true });
      const chunks = [Buffer.alloc(8 * 1024 * 1024, 31), Buffer.alloc(1024 * 1024, 47)];
      for (let i = 0; i < chunks.length; i++) {
        stage = "multipart_part_" + (i + 1);
        const url = signedR2PartUrl(multipartKey, multipartId, i + 1);
        const res = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream", Origin: "https://foturax.com.br" },
          body: chunks[i],
          cache: "no-store",
          signal: AbortSignal.timeout(25_000),
        });
        const xml = res.ok ? "" : await res.text().catch(() => "");
        const code = xml.match(/<Code>([^<]{1,80})<\\/Code>/)?.[1] ?? "no_code";
        phases.push({ stage, status: res.status, code });
        if (!res.ok) throw new Error("S3 part failed " + res.status + " " + code);
      }
      stage = "multipart_list";
      const listed = await listR2MultipartParts(multipartKey, multipartId);
      phases.push({ stage, parts: listed.length, firstPartBytes: listed[0]?.bytes ?? 0 });
      stage = "multipart_finish";
      await finishR2Multipart(multipartKey, multipartId, 9 * 1024 * 1024);
      completedMultipart = true;
      const checked = await fetch(signPrivateR2ObjectUrl("HEAD", multipartKey, 60), {
        method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(15_000),
      });
      const matched = checked.ok && Number(checked.headers.get("content-length")) === 9 * 1024 * 1024;
      phases.push({ stage, ok: matched, headStatus: checked.status });
      if (!matched) throw new Error("Multipart integrity failed");
    } catch (err) {
      phases.push({ stage, ok: false, reason: err instanceof Error ? err.message.slice(0,180) : "unknown" });
      return NextResponse.json({ ok: false, phases, issue: "multipart_pipeline_failed" }, { status: 502 });
    } finally {
      if (multipartId) {
        try {
          if (completedMultipart) {
            const deleted = await fetch(signPrivateR2ObjectUrl("DELETE", multipartKey, 60), {
              method: "DELETE", cache: "no-store", signal: AbortSignal.timeout(15_000),
            });
            phases.push({ stage: "multipart_cleanup", ok: deleted.ok || deleted.status === 404 });
          } else {
            await abortR2Multipart(multipartKey, multipartId);
            phases.push({ stage: "multipart_abort", ok: true });
          }
        } catch {
          phases.push({ stage: "multipart_cleanup", ok: false });
        }
      }
    }
    return NextResponse.json({ ok: true, phases });
  } catch {
    return NextResponse.json({ ok: false, stage, phases, issue: "probe_exception" }, { status: 502 });
  } finally {
    if (uploaded) {
      try {
        const response = await fetch(signPrivateR2ObjectUrl("DELETE", key, 60), {
          method: "DELETE", cache: "no-store", signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok && response.status !== 404) {
          console.error("Synthetic R2 probe cleanup failed", response.status);
        }
      } catch {
        console.error("Synthetic R2 probe cleanup request failed");
      }
    }
  }
}
