/**
 * R2 pilot browser adapter. This does not replace Supabase TUS for large photos:
 * single-object PUTs can only retry the whole image, not resume a partial upload.
 * Both the original and its JPEG thumbnail are verified before registration.
 */
export const R2_PILOT_MAX_BYTES = 6 * 1024 * 1024;

type Variant = "principal" | "entrega";
type Prepared = {
  nome: string;
  ticket: string;
  original: { url: string; contentType: string };
  thumb: { url: string; contentType: string };
};

export async function r2PilotAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/fotos/r2", { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { enabled?: boolean };
    return data.enabled === true;
  } catch { return false; }
}

async function callR2Api(token: string, body: Record<string, unknown>) {
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
  url: string, contentType: string, body: Blob, onProgress?: (bytes: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.timeout = 240_000;
    xhr.setRequestHeader("Content-Type", contentType);
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
  url: string, contentType: string, body: Blob, onProgress?: (bytes: number) => void
) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await uploadOnce(url, contentType, body, onProgress);
      return;
    } catch (error) {
      if (attempt === 1) throw error;
      if (onProgress) onProgress(0);
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
  }
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
  if (arquivo.size > R2_PILOT_MAX_BYTES || thumb.size <= 0 || thumb.size > 4 * 1024 * 1024) {
    throw new Error("Arquivo incompatível com o piloto R2.");
  }
  const prepared = await callR2Api(token, {
    acao: "preparar", galeria, variante, nome: arquivo.name,
    bytes: arquivo.size, mimeType: arquivo.type, thumbBytes: thumb.size,
  }) as Prepared;

  if (!prepared.ticket || !prepared.original?.url || !prepared.thumb?.url || !prepared.nome) {
    throw new Error("Permissão de upload R2 incompleta.");
  }

  let confirmed = false;
  try {
    await putWithRetry(prepared.original.url, prepared.original.contentType, arquivo, progresso);
    await putWithRetry(prepared.thumb.url, "image/jpeg", thumb);
    const result = await callR2Api(token, {
      acao: "confirmar", ticket: prepared.ticket, largura, altura,
    });
    if (result.ok !== true || result.nome !== prepared.nome) {
      throw new Error("Confirmação de integridade R2 inválida.");
    }
    confirmed = true;
    return { nome: prepared.nome };
  } finally {
    if (!confirmed) {
      // Only cancels this newly allocated, unconfirmed object. The server
      // refuses to delete an object already registered in the photo catalog.
      void callR2Api(token, { acao: "cancelar", ticket: prepared.ticket }).catch(() => {});
    }
  }
}
