export type Job = { id: string; lease_token: string; prefix: string };
export type Backend = {
  claim(): Promise<Job | null>;
  paths(job: Job): Promise<string[]>;
  remove(paths: string[]): Promise<void>;
  // Optional while migrating the existing worker: production uses both methods
  // together once R2 support is deployed. SQL finish guards completion even if
  // an older worker omits them.
  r2Paths?(job: Job): Promise<string[]>;
  removeR2?(paths: string[], job: Job): Promise<void>;
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
      // R2 follows the same durable lease. The remote worker must delete and
      // HEAD-verify each object before the registry acknowledgement. No
      // registry entry is removed on an unverified or failed R2 request.
      let r2Exhausted = true;
      if (backend.r2Paths || backend.removeR2) {
        if (!backend.r2Paths || !backend.removeR2) throw new Error("Incomplete R2 cleanup backend");
        r2Exhausted = false;
        if (exhausted) {
          for (let batch = 0; batch < 20 && now() < deadline; batch++) {
            const paths = await backend.r2Paths(job);
            if (!paths.length) { r2Exhausted = true; break; }
            if (paths.length > 100 || paths.some((p) => !p.startsWith(job.prefix))) {
              throw new Error("Invalid R2 cleanup scope");
            }
            await backend.removeR2(paths, job);
          }
        }
      }
      // The database verifies absence in BOTH providers under the live lease.
      if (await backend.finish(job, exhausted && r2Exhausted ? null : "Batch/time budget reached")) result.completed++;
      else result.deferred++;
    } catch {
      // Do not persist URLs, credentials, or original filenames in error messages.
      await backend.finish(job, "Storage cleanup failed; automatic retry scheduled");
      result.deferred++;
    }
  }
  return result;
}
