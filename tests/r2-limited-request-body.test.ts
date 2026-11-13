import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readBoundedRequestBody, readBoundedFormData, readBoundedRequestText,
  RequestBodyTooLargeError,
} from "../app/lib/limited-request-body.ts";

test("accepts short JSON without Content-Length", async () => {
  const req = new Request("https://example.invalid/api", {
    method: "POST",
    body: JSON.stringify({ nome: "fotura.png", bytes: 42 }),
    headers: { "Content-Type": "application/json" },
  });
  assert.equal(req.headers.get("content-length"), null);
  assert.deepEqual(JSON.parse(await readBoundedRequestText(req, 2048)), {
    nome: "fotura.png", bytes: 42,
  });
});

test("rejects declared oversized bodies before reading", async () => {
  let pulled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled = true;
      controller.enqueue(new Uint8Array(1024));
    },
  }, { highWaterMark: 0 });
  await assert.rejects(readBoundedRequestBody({
    body, headers: new Headers({ "Content-Length": "33000" }),
  }, 32768), RequestBodyTooLargeError);
  assert.equal(pulled, false);
  await body.cancel();
});

test("cancels chunked streams once the actual byte limit is crossed", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(1024));
      controller.enqueue(new Uint8Array(1025));
    },
    cancel() { cancelled = true; },
  });
  await assert.rejects(readBoundedRequestBody({ body, headers: new Headers() }, 2048),
    RequestBodyTooLargeError);
  assert.equal(cancelled, true);
});

test("counts UTF-8 bytes instead of characters", async () => {
  const req = new Request("https://example.invalid/api", {
    method: "POST", body: "á".repeat(1025),
  });
  await assert.rejects(readBoundedRequestText(req, 2048), RequestBodyTooLargeError);
});

test("accepts short multipart metadata", async () => {
  const form = new FormData();
  form.set("tipo", "problema");
  form.set("screenshot_path", "synthetic/path.png");
  const req = new Request("https://example.invalid/api", { method: "POST", body: form });
  const parsed = await readBoundedFormData(req, 32768);
  assert.equal(parsed.get("tipo"), "problema");
  assert.equal(parsed.get("screenshot_path"), "synthetic/path.png");
});

test("blocks accidental screenshot bytes in metadata-only multipart", async () => {
  const form = new FormData();
  form.set("screenshot", new Blob([new Uint8Array(34000)], { type: "image/png" }), "shot.png");
  // Serialize the browser FormData before simulating the incoming server
  // request. Node's synthetic FormData upload producer may otherwise enqueue
  // more chunks after the reader has been deliberately cancelled.
  const generated = new Request("https://example.invalid/api", { method: "POST", body: form });
  const serialized = await generated.arrayBuffer();
  const req = new Request("https://example.invalid/api", {
    method: "POST",
    headers: { "Content-Type": generated.headers.get("content-type")! },
    body: serialized,
  });
  await assert.rejects(readBoundedFormData(req, 32768), RequestBodyTooLargeError);
});
