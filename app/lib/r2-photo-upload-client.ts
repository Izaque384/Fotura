/**
 * Preview-only Cloudflare R2 browser upload adapter.
 * Never splits new objects between providers: in R2 mode ALL originals and
 * thumbnails use R2. Large files use the resumable R2 multipart protocol.
 */
export const R2_PILOT_MAX_BYTES = 50 * 1024 * 1024;
const PART_BYTES = 8 * 1024 * 1024;
const MAX_THUMB_BYTES = 4 * 1024 * 1024;

type Variant = "principal" | "entrega";
type Prepared = {
  nome: string;
  ticket: string;
  original: { url: string; contentType: string };
  thumb: { url: string; contentType: string };
};
type MultipartSession = {
  nome: string;
  ticket: string;
  originalBytes: number;
  thumbBytes: number;
  mime: string;
};
type MultipartStatus = {
  ok: boolean;
  registered?: boolean;
  completed?: boolean;
  parts?: { number: number; bytes: number }[];
  thumb?: { url: string; contentType: string };
  partBytes?: number;
};

export async function r2PilotAvailable(): Promise<boolean> {
  const res = await fetch("/api/fotos/r2", { cache: "no-store" });
  if (!res.ok) throw new Error("Não foi possível verificar o armazenamento. Nenhuma foto foi enviada.");
  const data = (await res.json()) as { enabled?: boolean; provider?: string };
  if ((data.provider !== "r2" && data.provider !== "supabase") ||
      data.enabled !== (data.provider === "r2")) {
    throw new Error("Configuração de armazenamento inválida. Nenhuma foto foi enviada.");
  }
  return data.provider === "r2";
}

async function callR2Api(token: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch("/api/fotos/r2", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(
    typeof result.error === "string" ? result.error : "Falha na comunicação com o armazenamento."
  );
  return result;
}

function uploadOnce(
  url: string, contentType: string, body: Blob, onProgress?: (bytes: number) => void,
  createOnly = false
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.timeout = 240_000;
    xhr.setRequestHeader("Content-Type", contentType);
    if (createOnly) xhr.setRequestHeader("If-None-Match", "*");
    if (onProgress) xhr.upload.onprogress = (event) => onProgress(Math.min(event.loaded, body.size));
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(new Error("Envio R2 falhou (HTTP " + xhr.status + ")."));
    xhr.onerror = () => reject(new Error("Falha de rede durante o envio R2."));
    xhr.ontimeout = () => reject(new Error("Tempo esgotado no envio R2."));
    xhr.onabort = () => reject(new Error("Envio R2 interrompido."));
    xhr.send(body);
  });
}

async function putWithRetry(
  url: string, contentType: string, body: Blob, onProgress?: (bytes: number) => void,
  createOnly = false
) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await uploadOnce(url, contentType, body, onProgress, createOnly);
      return;
    } catch (error) {
      if (attempt === 1) throw error;
      onProgress?.(0);
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
  }
}

function sessionKey(galeria: string, variante: Variant, file: File): string {
  return "fotura-r2-multipart:" + [galeria, variante, file.name, file.size, file.lastModified]
    .map(encodeURIComponent).join(":");
}

function readSession(key: string, original: File, thumb: Blob): MultipartSession | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const state = JSON.parse(raw) as MultipartSession;
    return state && typeof state.nome === "string" && typeof state.ticket === "string" &&
      state.originalBytes === original.size && state.thumbBytes === thumb.size &&
      state.mime === original.type ? state : null;
  } catch { return null; }
}

function writeSession(key: string, state: MultipartSession) {
  try { sessionStorage.setItem(key, JSON.stringify(state)); } catch {
    // Storage can be blocked in private browsing; current-session retries still work.
  }
}

function removeSession(key: string) {
  try { sessionStorage.removeItem(key); } catch {}
}

async function uploadMultipart(
  token: string,
  arquivo: File,
  ticket: string,
  status: MultipartStatus,
  onProgress: (bytes: number) => void
): Promise<void> {
  const completed = status.completed === true;
  if (completed) {
    onProgress(arquivo.size);
    return;
  }
  const partBytes = status.partBytes;
  if (partBytes !== PART_BYTES || !Array.isArray(status.parts)) {
    throw new Error("Estado das partes R2 inválido.");
  }
  const existing = new Map<number, number>();
  for (const part of status.parts) {
    if (Number.isInteger(part.number) && Number.isSafeInteger(part.bytes)) {
      existing.set(part.number, part.bytes);
    }
  }

  let done = 0;
  for (let n = 1; n <= Math.ceil(arquivo.size / PART_BYTES); n++) {
    const offset = (n - 1) * PART_BYTES;
    const bytes = Math.min(PART_BYTES, arquivo.size - offset);
    if (existing.get(n) === bytes) {
      done += bytes;
      onProgress(done);
      continue;
    }

    const signed = await callR2Api(token, {
      acao: "multipart_parte", ticket, partNumber: n,
    }) as { url?: string; bytes?: number };
    if (!signed.url || signed.bytes !== bytes) throw new Error("Autorização da parte R2 inválida.");
    const part = arquivo.slice(offset, offset + bytes);
    await putWithRetry(signed.url, "application/octet-stream", part, (sent) => {
      onProgress(Math.min(arquivo.size, done + sent));
    });
    done += bytes;
    onProgress(done);
  }
  const result = await callR2Api(token, { acao: "multipart_concluir", ticket });
  if (result.ok !== true || result.bytes !== arquivo.size) {
    throw new Error("O arquivo R2 não foi concluído corretamente.");
  }
  onProgress(arquivo.size);
}

export async function enviarFotoR2Piloto(options: {
  token: string;
  galeria: string;
  variante: Variant;
  arquivo: File;
  thumb: Blob;
  largura: number | null;
  altura: number | null;
  progresso: (bytes: number) => void;
}): Promise<{ nome: string }> {
  const { token, galeria, variante, arquivo, thumb, largura, altura, progresso } = options;
  if (arquivo.size <= 0 || arquivo.size > R2_PILOT_MAX_BYTES ||
      thumb.size <= 0 || thumb.size > MAX_THUMB_BYTES) {
    throw new Error("Arquivo incompatível com o limite do Fotura.");
  }

  const multipart = arquivo.size > PART_BYTES;
  const key = sessionKey(galeria, variante, arquivo);
  let persisted = multipart ? readSession(key, arquivo, thumb) : null;
  let prepared: Prepared | null = null;

  if (!persisted) {
    prepared = await callR2Api(token, {
      acao: "preparar", galeria, variante, nome: arquivo.name,
      bytes: arquivo.size, mimeType: arquivo.type, thumbBytes: thumb.size,
    }) as Prepared;
    if (!prepared.ticket || !prepared.original?.url || !prepared.thumb?.url || !prepared.nome) {
      throw new Error("Permissão de upload R2 incompleta.");
    }
  }

  let confirmed = false;
  let ticket = persisted?.ticket ?? prepared!.ticket;
  let nome = persisted?.nome ?? prepared!.nome;

  try {
    if (multipart) {
      if (!persisted) {
        const start = await callR2Api(token, { acao: "multipart_iniciar", ticket });
        if (start.ok !== true || typeof start.ticket !== "string" || start.nome !== nome ||
            start.partBytes !== PART_BYTES) {
          throw new Error("Não foi possível iniciar upload R2 com retomada.");
        }
        ticket = start.ticket;
        persisted = { nome, ticket, originalBytes: arquivo.size, thumbBytes: thumb.size, mime: arquivo.type };
        writeSession(key, persisted);
      }

      const status = await callR2Api(token, { acao: "multipart_resumir", ticket }) as MultipartStatus;
      if (status.registered === true) {
        removeSession(key);
        return { nome };
      }
      if (status.ok !== true) throw new Error("Não foi possível retomar o envio R2.");
      await uploadMultipart(token, arquivo, ticket, status, progresso);

      const renewed = await callR2Api(token, { acao: "multipart_resumir", ticket }) as MultipartStatus;
      if (renewed.ok !== true || !renewed.completed || !renewed.thumb?.url) {
        throw new Error("Não foi possível confirmar o original R2 ou renovar a miniatura.");
      }
      await putWithRetry(renewed.thumb.url, "image/jpeg", thumb, undefined, true);
    } else {
      await putWithRetry(prepared!.original.url, prepared!.original.contentType, arquivo, progresso, true);
      await putWithRetry(prepared!.thumb.url, "image/jpeg", thumb, undefined, true);
    }

    const result = await callR2Api(token, {
      acao: "confirmar", ticket, largura, altura,
    });
    if (result.ok !== true || result.nome !== nome) {
      throw new Error("Confirmação de integridade R2 inválida.");
    }
    confirmed = true;
    removeSession(key);
    return { nome };
  } finally {
    if (!confirmed && !multipart && prepared) {
      // Multipart sessions survive network failures and can be resumed.
      // Short single-PUT attempts are cleaned up when not registered.
      void callR2Api(token, { acao: "cancelar", ticket }).catch(() => {});
    }
  }
}
