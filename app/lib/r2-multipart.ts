import "server-only";
import { signPrivateR2ObjectUrl } from "./r2-storage";

/**
 * Multipart S3 compatibility layer for the private Cloudflare R2 bucket.
 * All control-plane operations run on the server; browsers receive a
 * short-lived signed PUT URL for one part at a time.
 */
/** 8 MiB satisfies R2/S3's 5 MiB minimum for every non-final part. */
export const R2_PART_BYTES = 8 * 1024 * 1024;
export const R2_MIN_PART_BYTES = 5 * 1024 * 1024;
export const R2_SIGNED_PART_SECONDS = 5 * 60;

export type R2UploadedPart = { partNumber: number; etag: string; bytes: number };

function validUploadId(uploadId: string): boolean {
  return uploadId.length > 0 && uploadId.length <= 512 &&
    !/[\u0000-\u001f\u007f<>]/.test(uploadId);
}

function query(uploadId: string) {
  if (!validUploadId(uploadId)) throw new Error("Identificador de upload R2 inválido.");
  return [["uploadId", uploadId]] as const;
}

function xmlValue(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp("<(?:[a-zA-Z0-9_-]+:)?" + tag + ">([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?" + tag + ">"));
  return match?.[1]?.trim() ?? null;
}

function parseEtag(value: string | null): string {
  const clean = value?.replace(/^"|"$/g, "") ?? "";
  if (!/^[a-z0-9_-]{1,128}$/i.test(clean)) {
    throw new Error("ETag R2 inválido.");
  }
  return clean;
}

async function checkedResponse(response: Response, action: string): Promise<string> {
  const text = await response.text();
  if (!response.ok || text.includes("<Error>") || text.includes("<Error ")) {
    throw new Error("Falha de operação multipart R2: " + action + " (HTTP " + response.status + ").");
  }
  return text;
}

export async function beginR2Multipart(key: string, mime: string): Promise<string> {
  const response = await fetch(
    signPrivateR2ObjectUrl("POST", key, 60, mime, [["uploads", ""]]),
    {
      method: "POST",
      headers: { "Content-Type": mime },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    }
  );
  const xml = await checkedResponse(response, "iniciar");
  const uploadId = xmlValue(xml, "UploadId");
  if (!uploadId || !validUploadId(uploadId)) {
    throw new Error("R2 não retornou um uploadId válido.");
  }
  return uploadId;
}

export function signedR2PartUrl(key: string, uploadId: string, number: number): string {
  if (!Number.isInteger(number) || number < 1 || number > 10000) {
    throw new Error("Número da parte R2 inválido.");
  }
  return signPrivateR2ObjectUrl("PUT", key, R2_SIGNED_PART_SECONDS, undefined,
    [["partNumber", String(number)], ...query(uploadId)]);
}

export async function listR2MultipartParts(key: string, uploadId: string): Promise<R2UploadedPart[]> {
  const found: R2UploadedPart[] = [];
  while (found.length < 10000) {
    // All Fotura originals currently fit on one S3 ListParts page (<10 parts).
    const response = await fetch(signPrivateR2ObjectUrl("GET", key, 60, undefined, query(uploadId)), {
      cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    const xml = await checkedResponse(response, "listar partes");
    const chunks = xml.match(/<(?:[a-zA-Z0-9_-]+:)?Part>[\s\S]*?<\/(?:[a-zA-Z0-9_-]+:)?Part>/g) ?? [];
    for (const partXml of chunks) {
      const partNumber = Number(xmlValue(partXml, "PartNumber"));
      const bytes = Number(xmlValue(partXml, "Size"));
      const etag = parseEtag(xmlValue(partXml, "ETag"));
      if (!Number.isInteger(partNumber) || partNumber < 1 ||
          !Number.isSafeInteger(bytes) || bytes < 1 ||
          found.some((part) => part.partNumber === partNumber)) {
        throw new Error("Lista de partes R2 inconsistente.");
      }
      found.push({ partNumber, etag, bytes });
    }
    if (xmlValue(xml, "IsTruncated") === "true") {
      throw new Error("Listagem de partes R2 truncada; não é seguro concluir.");
    }
    return found.sort((a, b) => a.partNumber - b.partNumber);
  }
  throw new Error("Quantidade de partes R2 excedida.");
}

export async function finishR2Multipart(
  key: string,
  uploadId: string,
  bytes: number,
  partSize = R2_PART_BYTES
): Promise<void> {
  const parts = await listR2MultipartParts(key, uploadId);
  const count = Math.ceil(bytes / partSize);
  if (!Number.isSafeInteger(bytes) || bytes < 1 || !Number.isInteger(partSize) ||
      partSize < R2_MIN_PART_BYTES || count <= 0 || count > 10000 || parts.length !== count) {
    throw new Error("Upload R2 incompleto.");
  }
  for (let i = 0; i < parts.length; i++) {
    const expected = i === count - 1 ? bytes - i * partSize : partSize;
    if (parts[i].partNumber !== i + 1 || parts[i].bytes !== expected) {
      throw new Error("Partes do R2 não conferem com o tamanho original.");
    }
  }
  const xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<CompleteMultipartUpload>" +
    parts.map((part) => "<Part><PartNumber>" + part.partNumber + "</PartNumber><ETag>\"" +
      part.etag + "\"</ETag></Part>").join("") +
    "</CompleteMultipartUpload>";
  const response = await fetch(
    signPrivateR2ObjectUrl("POST", key, 60, undefined, query(uploadId)), {
      method: "POST", headers: { "Content-Type": "application/xml" },
      body: xml, cache: "no-store", signal: AbortSignal.timeout(30_000),
    }
  );
  const body = await checkedResponse(response, "concluir");
  if (!xmlValue(body, "ETag") || !body.includes("CompleteMultipartUploadResult")) {
    throw new Error("R2 não confirmou a conclusão do arquivo.");
  }
}

export async function abortR2Multipart(key: string, uploadId: string): Promise<void> {
  const response = await fetch(
    signPrivateR2ObjectUrl("DELETE", key, 60, undefined, query(uploadId)), {
      method: "DELETE", cache: "no-store", signal: AbortSignal.timeout(15_000),
    }
  );
  if (!response.ok && response.status !== 404) {
    throw new Error("Falha ao cancelar upload incompleto no R2.");
  }
}
