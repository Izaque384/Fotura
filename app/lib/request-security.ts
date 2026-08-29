import type { NextRequest } from "next/server";

/**
 * Bloqueia mutações iniciadas por outro site quando a requisição depende
 * de cookies/sessão do navegador. Requisições sem Origin continuam válidas
 * para compatibilidade com clientes same-origin legítimos e testes de servidor.
 */
export function requisicaoMesmoOrigin(req: NextRequest) {
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite && !["same-origin", "same-site", "none"].includes(secFetchSite)) {
    return false;
  }

  const origin = req.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === req.nextUrl.origin;
  } catch {
    return false;
  }
}
