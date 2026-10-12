# Persistent photo cleanup

`storage_cleanup_jobs` is an internal deletion outbox. A BEFORE DELETE trigger on
`galerias` inserts a job in the same transaction, covering both individual gallery
deletion and project/account cascades. A rollback also rolls back the job. Jobs
have no foreign keys and cannot be read/written by browser roles.

The authenticated `storage-cleanup` Edge Function is dispatched by pg_cron every
five minutes, only when work is due. A 256-bit signing key is generated inside
Vault; only HMAC signatures valid for the current or previous minute are sent.
Neither the signing key nor the service key is stored in this repository. JWT
verification is disabled because the function validates this custom credential
before claiming work. All worker RPCs are service-role-only and SECURITY INVOKER.

Each job is claimed using SKIP LOCKED and a two-minute lease. Each invocation
handles at most ten galleries, twenty batches per gallery, and a 45-second work
budget; each network operation has a ten-second timeout. Files are selected in
batches of 500 from Storage metadata under the exact owner/gallery UUID prefix,
including every subdirectory. Removal always uses the Storage API, never SQL.

Completion requires a fresh database check finding no remaining Storage objects.
Transient failures retry after 5, 10, 20, 40... minutes, capped at six hours,
without dropping the job. Expired leases are reclaimed after crashes. Completed
tombstones remain to detect late uploads and prevent gallery UUID reuse. Cron
reopens a completed job if files later appear at its exact prefix. Files belonging
to unrelated galleries are never included; no historical orphan sweep is enabled.

Deployment order: apply the migration, deploy the Edge Function with custom auth,
then deploy the Next.js routes. The migration also protects the old routes while
they are deployed. The scheduler URL is explicitly bound to the Fotura project;
replace it before applying this migration to a different Supabase project.

Inspection (SQL editor / service role only):

```sql
select status, count(*) from public.storage_cleanup_jobs group by status;
select id, attempts, failures, next_attempt_at, last_error
from public.storage_cleanup_jobs where status <> 'completed' and failures >= 8;
select id, completed_at, verified_at
from public.storage_cleanup_jobs where status = 'completed';
```

Investigate jobs with eight or more failures (they still retry). For an urgent
retry after resolving an incident, set `next_attempt_at=now()` on the specific
pending job; never remove the tombstone or delete `storage.objects` via SQL.

Worker regression tests: `node --test tests/storage-cleanup.test.ts`.
