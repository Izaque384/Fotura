import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCleanup, type Backend, type Job } from '../supabase/functions/storage-cleanup/worker.ts';

function fixture(count = 1201) {
  const job: Job = { id: 'job', lease_token: 'lease', prefix: 'owner/gallery/' };
  const files = new Set(Array.from({ length: count }, (_, i) => `${job.prefix}${i % 2 ? 'entrega/thumbs/deep/' : ''}${i}.jpg`));
  let claimed = false;
  const batches: number[] = [];
  const finishes: Array<string | null> = [];
  const backend: Backend = {
    async claim() { if (claimed) return null; claimed = true; return job; },
    async paths() { return [...files].slice(0, 500); },
    async remove(paths) { batches.push(paths.length); paths.forEach((p) => files.delete(p)); },
    async finish(_job, error) { finishes.push(error); return !error && !files.size; },
  };
  return { backend, files, batches, finishes };
}

test('deletes >1000 nested objects in bounded batches, without offset skipping', async () => {
  const f = fixture();
  assert.deepEqual(await runCleanup(f.backend), { completed: 1, deferred: 0 });
  assert.deepEqual(f.batches, [500, 500, 201]);
  assert.equal(f.files.size, 0);
  assert.deepEqual(f.finishes, [null]);
});
test('failed/partial deletion remains pending and succeeds on retry', async () => {
  const f = fixture(20);
  const original = f.backend.remove;
  f.backend.remove = async (paths) => { await original(paths.slice(0, 5)); throw Error('failure'); };
  assert.deepEqual(await runCleanup(f.backend), { completed: 0, deferred: 1 });
  assert.equal(f.files.size, 15);
  f.backend.remove = original;
  let available = true;
  f.backend.claim = async () => available ? (available = false, { id: 'job', lease_token: 'new', prefix: 'owner/gallery/' }) : null;
  assert.equal((await runCleanup(f.backend)).completed, 1);
});
test('storage success without actual removal never confirms completion', async () => {
  const f = fixture(1);
  f.backend.remove = async () => {};
  assert.equal((await runCleanup(f.backend)).completed, 0);
  assert.equal(f.files.size, 1);
});
test('paths outside the gallery boundary are rejected before deletion', async () => {
  const f = fixture();
  f.backend.paths = async () => ['owner/gallery-other/file.jpg'];
  assert.equal((await runCleanup(f.backend)).deferred, 1);
  assert.deepEqual(f.batches, []);
});
test('database verification is authoritative even after an empty listing', async () => {
  const f = fixture(0);
  f.backend.finish = async () => false;
  assert.equal((await runCleanup(f.backend)).completed, 0);
});
test('interruption recording failures propagates so the lease can expire', async () => {
  const f = fixture(1);
  f.backend.paths = async () => { throw Error('offline'); };
  f.backend.finish = async () => { throw Error('offline'); };
  await assert.rejects(runCleanup(f.backend));
});
test('empty queue makes no storage request', async () => {
  const f = fixture();
  f.backend.claim = async () => null;
  assert.deepEqual(await runCleanup(f.backend), { completed: 0, deferred: 0 });
  assert.deepEqual(f.batches, []);
});
test('time budget defers unfinished work', async () => {
  const f = fixture(2000);
  let clock = 0;
  assert.equal((await runCleanup(f.backend, () => (clock += 15000))).deferred, 1);
  assert.equal(f.files.size, 1500);
});
