export type Job = { id: string; lease_token: string; prefix: string };
export type Backend = {
  claim(): Promise<Job | null>;
  paths(job: Job): Promise<string[]>;
  remove(paths: string[]): Promise<void>;
  finish(job: Job, error: string | null): Promise<boolean>;
};

// Bounded execution; unfinished work remains durable and is retried by cron.
export async function runCleanup(backend: Backend, now = Date.now) {
  const deadline = now() + 45_000;
  const result = { completed: 0, deferred: 0 };
  for (let jobs = 0; jobs < 10 && now() < deadline; jobs++) {
    const job = await backend.claim();
    if (!job) break;
    try {
      let exhausted = false;
      for (let batch = 0; batch < 20 && now() < deadline; batch++) {
        const paths = await backend.paths(job);
        if (!paths.length) { exhausted = true; break; }
        if (paths.length > 500 || paths.some((p) => !p.startsWith(job.prefix))) {
          throw new Error("Invalid cleanup scope");
        }
        await backend.remove(paths);
      }
      // The database verifies absence again, under the job's current lease.
      if (await backend.finish(job, exhausted ? null : "Batch/time budget reached")) result.completed++;
      else result.deferred++;
    } catch {
      // Do not persist URLs, credentials, or original filenames in error messages.
      await backend.finish(job, "Storage cleanup failed; automatic retry scheduled");
      result.deferred++;
    }
  }
  return result;
}
