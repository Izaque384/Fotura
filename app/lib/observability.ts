import type { NextRequest } from "next/server";

function erroSeguro(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: "UnknownError", message: "Erro não identificado" };
}

export function requestId(req: NextRequest) {
  return req.headers.get("x-request-id") || "sem-request-id";
}

export function registrarErro(
  escopo: string,
  req: NextRequest,
  error: unknown,
  contexto?: Record<string, string | number | boolean | null>
) {
  console.error(JSON.stringify({
    level: "error",
    service: "fotura",
    scope: escopo,
    requestId: requestId(req),
    method: req.method,
    path: req.nextUrl.pathname,
    error: erroSeguro(error),
    contexto: contexto ?? {},
    timestamp: new Date().toISOString(),
  }));
}
