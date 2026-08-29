import { NextResponse, type NextRequest } from "next/server";
import { createNonceContentSecurityPolicy } from "./lib/csp";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = createNonceContentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/login",
    "/esqueci-senha",
    "/redefinir-senha",
    "/dashboard/:path*",
    "/upload",
    "/configuracoes",
  ],
};
