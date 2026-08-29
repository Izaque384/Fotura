import { NextResponse, type NextRequest } from "next/server";
import { createNonceContentSecurityPolicy } from "./lib/csp";

function rotaComNonce(pathname: string) {
  return pathname === "/login"
    || pathname === "/esqueci-senha"
    || pathname === "/redefinir-senha"
    || pathname === "/upload"
    || pathname === "/configuracoes"
    || pathname === "/dashboard"
    || pathname.startsWith("/dashboard/");
}

export function proxy(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  let csp: string | null = null;
  if (rotaComNonce(request.nextUrl.pathname)) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    csp = createNonceContentSecurityPolicy(nonce);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("x-request-id", requestId);
  if (csp) response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/login",
    "/esqueci-senha",
    "/redefinir-senha",
    "/dashboard/:path*",
    "/upload",
    "/configuracoes",
  ],
};
