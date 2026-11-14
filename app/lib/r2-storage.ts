import "server-only";
import { createHash, createHmac } from "node:crypto";

/**
 * Operações privadas de objetos R2 usando URLs S3 SigV4 de curta duração.
 * Credenciais são exclusivas do servidor. Não publica o bucket nem exige
 * uma dependência nova no projeto.
 */
function configuration() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? "";
  const bucket = process.env.R2_MEDIA_BUCKET?.trim() ?? "";
  if (!/^[a-f0-9]{32}$/i.test(accountId) ||
      !/^[a-f0-9]{32}$/i.test(accessKeyId) ||
      !/^[a-f0-9]{64}$/i.test(secretAccessKey) ||
      !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(bucket)) {
    throw new Error("Credenciais R2 incompletas ou inválidas.");
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

/** Isolate additional logical Supabase buckets in the single private R2 bucket.
 * The original photo/video layout is preserved for backward compatibility.
 * Every new auxiliary object has an explicit bucket namespace in R2.
 */
export type FoturaMediaBucket = "fotos" | "abertura-videos" |
  "marca" | "client-avatars" | "feedback-anexos";

export function r2PhysicalKey(bucket: FoturaMediaBucket, key: string): string {
  const safe = checkedKey(key);
  return bucket === "fotos" || bucket === "abertura-videos"
    ? safe
    : bucket + "/" + safe;
}

/** S3 credentials must have the real Cloudflare R2 shape. Refuse opaque or encrypted env blobs. */
export function r2CredentialsPresent(): boolean {
  return /^[a-f0-9]{32}$/i.test(process.env.R2_ACCOUNT_ID?.trim() ?? "") &&
    /^[a-f0-9]{32}$/i.test(process.env.R2_ACCESS_KEY_ID?.trim() ?? "") &&
    /^[a-f0-9]{64}$/i.test(process.env.R2_SECRET_ACCESS_KEY?.trim() ?? "") &&
    /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(process.env.R2_MEDIA_BUCKET?.trim() ?? "");
}

/** Verified R2 objects must remain readable, even when a stale env toggle is false. */
export function isR2ReadEnabled(): boolean {
  return true;
}

function encodeSegment(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    "%" + char.charCodeAt(0).toString(16).toUpperCase());
}

function checkedKey(value: string): string {
  if (!value || value.length > 1024 || value.startsWith("/") || value.includes("\\") ||
      /[\u0000-\u001f\u007f]/.test(value) ||
      value.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Chave de objeto R2 inválida.");
  }
  return value;
}

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const hmac = (key: Buffer | string, value: string) =>
  createHmac("sha256", key).update(value, "utf8").digest();

function canonicalQuery(params: Array<[string, string]>): string {
  return params.map(([key, value]) => [encodeSegment(key), encodeSegment(value)] as const)
    .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)
    .map(([key, value]) => key + "=" + value).join("&");
}

type SignedMethod = "GET" | "PUT" | "HEAD" | "DELETE" | "POST";
type MultipartQuery = ReadonlyArray<readonly ["uploads" | "uploadId" | "partNumber", string]>;

/** S3 Signature V4 for private R2 requests, including multipart S3 query parameters. */
export function signPrivateR2ObjectUrl(
  method: SignedMethod,
  key: string,
  expiresSeconds: number,
  contentType?: string,
  multipartQuery: MultipartQuery = [],
  createOnly = false
): string {
  if (createOnly && (method !== "PUT" || multipartQuery.length !== 0)) {
    throw new Error("Condição create-only permitida apenas em PUT simples R2.");
  }
  if (contentType && (!["PUT", "POST"].includes(method) ||
      !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(contentType))) {
    throw new Error("Tipo de conteúdo R2 inválido.");
  }
  if (multipartQuery.some(([name, value]) =>
    (name === "uploads" && value !== "") ||
    (name === "uploadId" && (!value || value.length > 512 || /[\u0000-\u001f\u007f]/.test(value))) ||
    (name === "partNumber" && (!/^[1-9][0-9]{0,3}$/.test(value) || Number(value) > 10000))
  )) throw new Error("Parâmetro multipartes R2 inválido.");

  const { accountId, accessKeyId, secretAccessKey, bucket } = configuration();
  const safeKey = checkedKey(key);
  if (!Number.isInteger(expiresSeconds) || expiresSeconds < 1 || expiresSeconds > 604800) {
    throw new Error("Prazo de assinatura R2 inválido.");
  }

  const hostname = bucket + "." + accountId + ".r2.cloudflarestorage.com";
  const resource = "/" + safeKey.split("/").map(encodeSegment).join("/");
  const now = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = now.slice(0, 8);
  const scope = day + "/auto/s3/aws4_request";
  const signedHeaders = [
    ...(contentType ? ["content-type"] : []), "host", ...(createOnly ? ["if-none-match"] : []),
  ].join(";");
  const params: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Content-Sha256", "UNSIGNED-PAYLOAD"],
    ["X-Amz-Credential", accessKeyId + "/" + scope],
    ["X-Amz-Date", now],
    ["X-Amz-Expires", String(expiresSeconds)],
    ["X-Amz-SignedHeaders", signedHeaders],
    ...multipartQuery.map(([k, v]) => [k, v] as [string, string]),
  ];
  const query = canonicalQuery(params);
  const headers = (contentType ? "content-type:" + contentType + "\n" : "") +
    "host:" + hostname + "\n" + (createOnly ? "if-none-match:*\n" : "");
  const request = [method, resource, query, headers, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", now, scope, sha256(request)].join("\n");
  const signingKey = hmac(
    hmac(hmac(hmac("AWS4" + secretAccessKey, day), "auto"), "s3"),
    "aws4_request"
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  return "https://" + hostname + resource + "?" + query + "&X-Amz-Signature=" + signature;
}

/**
 * S3 multipart control requests MUST use server-side Authorization headers.
 * Cloudflare R2 documents presigned URL access for GET/HEAD/PUT/DELETE only;
 * multipart initialization/completion uses POST and is never exposed to browsers.
 */
export async function fetchPrivateR2Control(
  method: "GET" | "POST" | "DELETE",
  key: string,
  multipartQuery: MultipartQuery,
  options: { body?: string; contentType?: string; timeoutMs?: number; createOnly?: boolean } = {}
): Promise<Response> {
  const { accountId, accessKeyId, secretAccessKey, bucket } = configuration();
  const safeKey = checkedKey(key);
  const mime = options.contentType;
  if (options.createOnly && (method !== "POST" ||
      !multipartQuery.some(([name]) => name === "uploadId") || !options.body)) {
    throw new Error("Condição create-only exige conclusão multipartes R2.");
  }
  if (mime && !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(mime)) {
    throw new Error("Tipo MIME do controle R2 inválido.");
  }
  if (options.body && method !== "POST") {
    throw new Error("Payload não permitido nesse controle R2.");
  }
  if (multipartQuery.length < 1 || multipartQuery.some(([name, value]) =>
      (name === "uploads" && value !== "") ||
      (name === "uploadId" && (!value || value.length > 512 || /[\u0000-\u001f\u007f]/.test(value))) ||
      (name === "partNumber" && (!/^[1-9][0-9]{0,3}$/.test(value) || Number(value) > 10000))
  )) {
    throw new Error("Parâmetros do controle R2 inválidos.");
  }
  const hostname = accountId + ".r2.cloudflarestorage.com";
  const resource = "/" + encodeSegment(bucket) + "/" + safeKey.split("/").map(encodeSegment).join("/");
  const query = canonicalQuery(multipartQuery.map(([a, b]) => [a, b]));
  const now = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = now.slice(0, 8);
  const scope = day + "/auto/s3/aws4_request";
  const hash = createHash("sha256").update(options.body ?? "", "utf8").digest("hex");

  const signed = new Map<string, string>([
    ["host", hostname],
    ["x-amz-content-sha256", hash],
    ["x-amz-date", now],
  ]);
  if (mime) signed.set("content-type", mime);
  if (options.createOnly) signed.set("if-none-match", "*");
  const names = [...signed.keys()].sort();
  const signedHeaders = names.join(";");
  const canonicalHeaders = names.map((name) => name + ":" + signed.get(name)!.trim() + "\n").join("");
  const canonicalRequest = [method, resource, query, canonicalHeaders, signedHeaders, hash].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", now, scope, sha256(canonicalRequest)].join("\n");
  const signingKey = hmac(
    hmac(hmac(hmac("AWS4" + secretAccessKey, day), "auto"), "s3"),
    "aws4_request"
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  const authorization = "AWS4-HMAC-SHA256 Credential=" + accessKeyId + "/" + scope +
    ", SignedHeaders=" + signedHeaders + ", Signature=" + signature;
  return fetch("https://" + hostname + resource + "?" + query, {
    method,
    headers: {
      "Authorization": authorization,
      "X-Amz-Date": now,
      "X-Amz-Content-Sha256": hash,
      ...(mime ? { "Content-Type": mime } : {}),
      ...(options.createOnly ? { "If-None-Match": "*" } : {}),
    },
    body: options.body,
    cache: "no-store",
    signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
  });
}

export function signPrivateR2ReadUrl(key: string, expiresSeconds: number): string {
  return signPrivateR2ObjectUrl("GET", key, expiresSeconds);
}
