/**
 * Read bounded request bodies by actual received bytes, not the optional
 * Content-Length header. R2 APIs accept only small metadata through Vercel.
 */
export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Corpo da requisição excede o limite permitido.");
    this.name = "RequestBodyTooLargeError";
  }
}

export async function readBoundedRequestBody(
  req: Pick<Request, "headers" | "body">,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error("Limite de requisição inválido.");
  }
  const declared = req.headers.get("content-length");
  if (declared !== null && (!/^[0-9]+$/.test(declared) ||
      !Number.isSafeInteger(Number(declared)) || Number(declared) > maxBytes)) {
    throw new RequestBodyTooLargeError();
  }
  if (!req.body) return new Uint8Array(0);

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let count = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(count);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function readBoundedRequestText(
  req: Pick<Request, "headers" | "body">,
  maxBytes: number,
): Promise<string> {
  return new TextDecoder("utf-8", { fatal: true }).decode(
    await readBoundedRequestBody(req, maxBytes)
  );
}

export async function readBoundedFormData(
  req: Pick<Request, "headers" | "body">,
  maxBytes: number,
): Promise<FormData> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType)) {
    throw new Error("Esperado corpo multipart/form-data.");
  }
  const buffer = await readBoundedRequestBody(req, maxBytes);
  return new Response(buffer.buffer as ArrayBuffer, {
    headers: { "Content-Type": contentType },
  }).formData();
}
