import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { runCleanup, type Job } from "./worker.ts";

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
  try {
    const result = await runCleanup({
      claim: () => rpc("storage_cleanup_claim"),
      paths: (job) => rpc("storage_cleanup_paths", args(job)),
      remove: async (paths) => {
        const { error } = await db.storage.from("fotos").remove(paths);
        if (error) throw new Error("Storage remove failed");
      },
      finish: (job, error) => rpc("storage_cleanup_finish", { ...args(job), p_error: error }),
    });
    return Response.json(result);
  } catch {
    // Expired leases are reclaimed even if recording a failure also fails.
    return Response.json({ error: "Cleanup interrupted; pending jobs retained" }, { status: 503 });
  }
});
