import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { runCleanup, type Job } from "./worker.ts";
import { AwsClient } from "npm:aws4fetch@1.0.20";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  const token = req.headers.get("x-cleanup-token");
  if (!token || token.length !== 64) return new Response(null, { status: 401 });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
  });
  const { data: authorized, error: authError } = await db.rpc("storage_cleanup_authorized", { p_token: token });
  if (authError) return new Response(null, { status: 503 });
  if (authorized !== true) return new Response(null, { status: 401 });
  async function rpc(name: string, args: Record<string, unknown> = {}) {
    const { data, error } = await db.rpc(name, args);
    if (error) throw new Error("Cleanup database operation failed");
    return data;
  }
  const args = (job: Job) => ({ p_id: job.id, p_lease: job.lease_token });
  let cachedR2: { client: AwsClient; base: string; bucket: string } | null = null;
  function r2() {
    if (cachedR2) return cachedR2;
    const accountId = Deno.env.get("R2_ACCOUNT_ID") ?? "";
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID") ?? "";
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "";
    const bucket = Deno.env.get("R2_MEDIA_BUCKET") ?? "";
    if (!/^[a-f0-9]{32}$/i.test(accountId) ||
        !accessKeyId || !secretAccessKey || bucket !== "fotura-media") {
      throw new Error("R2 cleanup credentials not configured");
    }
    cachedR2 = {
      client: new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto", retries: 0 }),
      base: "https://" + accountId + ".r2.cloudflarestorage.com",
      bucket,
    };
    return cachedR2;
  }

  async function deleteVerifiedR2(paths: string[], job: Job) {
    const { client, base, bucket } = r2();
    const failures: number[] = [];
    let cursor = 0;
    const workers = Array.from({ length: Math.min(4, paths.length) }, async () => {
      while (cursor < paths.length) {
        const key = paths[cursor++];
        if (!key.startsWith(job.prefix) || key.includes("\\") ||
            key.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
          failures.push(1);
          continue;
        }
        const resource = "/" + encodeURIComponent(bucket) + "/" +
          key.split("/").map(encodeURIComponent).join("/");
        const url = base + resource;
        try {
          const deleted = await client.fetch(url, {
            method: "DELETE",
            signal: AbortSignal.timeout(10_000),
          });
          if (!deleted.ok && deleted.status !== 404) throw new Error("R2 deletion rejected");
          // A successful DELETE response is not enough to clear our registry:
          // verify that the object can no longer be accessed.
          const check = await client.fetch(url, {
            method: "HEAD",
            signal: AbortSignal.timeout(10_000),
          });
          if (check.status !== 404) throw new Error("R2 object still exists");
        } catch {
          failures.push(1);
        }
      }
    });
    await Promise.all(workers);
    if (failures.length) throw new Error("R2 verification failed");
    const acknowledged = await rpc("storage_cleanup_r2_ack", {
      ...args(job), p_paths: paths,
    });
    if (typeof acknowledged !== "number" || acknowledged > paths.length) {
      throw new Error("Invalid R2 cleanup acknowledgement");
    }
  }
  type PendingR2 = {
    id: string; lease_token: string; bucket: "fotos" | "abertura-videos";
    owner_id: string; object_key: string; thumbnail_key: string | null;
    upload_id: string | null;
  };

  function pendingPathIsSafe(job: PendingR2, path: string): boolean {
    return (job.bucket === "fotos" || job.bucket === "abertura-videos") &&
      path.startsWith(job.owner_id + "/") &&
      !path.includes("\\") &&
      path.split("/").every((segment) => Boolean(segment) && segment !== "." && segment !== "..");
  }

  function objectUrl(bucket: string, key: string) {
    const { base } = r2();
    return base + "/" + encodeURIComponent(bucket) + "/" +
      key.split("/").map(encodeURIComponent).join("/");
  }

  async function verifyAbsent(url: string) {
    const { client } = r2();
    const response = await client.fetch(url, {
      method: "DELETE", signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok && response.status !== 404) throw new Error("R2 deletion failed");
    const head = await client.fetch(url, {
      method: "HEAD", signal: AbortSignal.timeout(10_000),
    });
    if (head.status !== 404) throw new Error("R2 object still exists");
  }

  async function cleanupAbandonedR2(job: PendingR2) {
    if (!job.id || !job.lease_token || !job.owner_id ||
        !pendingPathIsSafe(job, job.object_key) ||
        (job.thumbnail_key !== null && !pendingPathIsSafe(job, job.thumbnail_key))) {
      throw new Error("Invalid pending R2 cleanup scope");
    }
    const url = objectUrl(job.bucket, job.object_key);
    if (job.upload_id) {
      if (job.bucket !== "fotos" || job.upload_id.length > 512 ||
          /[\u0000-\u001f\u007f]/.test(job.upload_id)) {
        throw new Error("Invalid R2 multipart session");
      }
      const { client } = r2();
      const aborted = await client.fetch(url + "?uploadId=" + encodeURIComponent(job.upload_id), {
        method: "DELETE", signal: AbortSignal.timeout(10_000),
      });
      // A session may already have completed. We still verify the final key.
      if (!aborted.ok && aborted.status !== 404) {
        throw new Error("R2 multipart abort failed");
      }
    }
    await verifyAbsent(url);
    if (job.thumbnail_key) {
      await verifyAbsent(objectUrl(job.bucket, job.thumbnail_key));
    }
  }

  try {
    const result = await runCleanup({
      claim: () => rpc("storage_cleanup_claim"),
      paths: (job) => rpc("storage_cleanup_paths", args(job)),
      remove: async (paths) => {
        const { error } = await db.storage.from("fotos").remove(paths);
        if (error) throw new Error("Storage remove failed");
      },
      r2Paths: (job) => rpc("storage_cleanup_r2_paths", args(job)),
      removeR2: deleteVerifiedR2,
      finish: (job, error) => rpc("storage_cleanup_finish", { ...args(job), p_error: error }),
    });
    const abandoned = { removed: 0, deferred: 0 };
    // The existing gallery queue has priority. Keep within pg_net's 60s
    // request timeout, and let the next cron tick retry any remaining work.
    const started = Date.now();
    for (let i = 0; i < 2 && Date.now() - started < 15_000; i++) {
      const pending = await rpc("r2_pending_cleanup_claim") as PendingR2 | null;
      if (!pending) break;
      try {
        await cleanupAbandonedR2(pending);
        const done = await rpc("r2_pending_cleanup_finish", {
          p_id: pending.id, p_lease: pending.lease_token, p_success: true,
        });
        if (done !== true) throw new Error("Pending cleanup not acknowledged");
        abandoned.removed++;
      } catch {
        await rpc("r2_pending_cleanup_finish", {
          p_id: pending.id, p_lease: pending.lease_token, p_success: false,
        });
        abandoned.deferred++;
      }
    }
    return Response.json({ ...result, abandoned });
  } catch {
    // Expired leases are reclaimed even if recording a failure also fails.
    return Response.json({ error: "Cleanup interrupted; pending jobs retained" }, { status: 503 });
  }
});
