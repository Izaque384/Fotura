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
  if (!/^[a-f0-9]{32}$/i.test(accountId) || !accessKeyId || !secretAccessKey ||
      !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(bucket)) {
    throw new Error("Credenciais R2 incompletas ou inválidas.");
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function r2CredentialsPresent(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY && process.env.R2_MEDIA_BUCKET
  );
}

export function isR2ReadEnabled(): boolean {
  return process.env.FOTURA_R2_READ_ENABLED === "true";
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
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]))
    .map(([key, value]) => key + "=" + value).join("&");
}

type SignedMethod = "GET" | "PUT" | "HEAD" | "DELETE";

export function signPrivateR2ObjectUrl(
  method: SignedMethod,
  key: string,
  expiresSeconds: number,
  contentType?: string
): string {
  if (contentType && (method !== "PUT" || !/^[a-z0-9][a-z0-9!#export function signPrivateR2ReadUrl(
  key: string,
  expiresSeconds: number
): string {
^_.+-]*\\/[a-z0-9][a-z0-9!#export function signPrivateR2ReadUrl(
  key: string,
  expiresSeconds: number
): string {
^_.+-]*$/i.test(contentType))) {
    throw new Error("Tipo de conteúdo R2 inválido.");
  }
  const { accountId, accessKeyId, secretAccessKey, bucket } = configuration();
  const safeKey = checkedKey(key);
  if (!Number.isInteger(expiresSeconds) || expiresSeconds < 1 || expiresSeconds > 604800) {
    throw new Error("Prazo de assinatura R2 inválido.");
  }

  const hostname = accountId + ".r2.cloudflarestorage.com";
  const resource = "/" + encodeSegment(bucket) + "/" +
    safeKey.split("/").map(encodeSegment).join("/");
  const now = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = now.slice(0, 8);
  const scope = day + "/auto/s3/aws4_request";
  const params: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", accessKeyId + "/" + scope],
    ["X-Amz-Date", now],
    ["X-Amz-Expires", String(expiresSeconds)],
    ["X-Amz-SignedHeaders", contentType ? "content-type;host" : "host"],
  ];
  const query = canonicalQuery(params);
  const headers = contentType ? "content-type:" + contentType + "\\n" + "host:" + hostname + "\\n" : "host:" + hostname + "\\n";
  const signedHeaders = contentType ? "content-type;host" : "host";
  const request = [method, resource, query, headers, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", now, scope, sha256(request)].join("\n");
  const signingKey = hmac(
    hmac(hmac(hmac("AWS4" + secretAccessKey, day), "auto"), "s3"),
    "aws4_request"
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  return "https://" + hostname + resource + "?" + query + "&X-Amz-Signature=" + signature;
}

export function signPrivateR2ReadUrl(key: string, expiresSeconds: number): string {
  return signPrivateR2ObjectUrl("GET", key, expiresSeconds);
}
