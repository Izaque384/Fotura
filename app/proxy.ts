import { NextResponse, type NextRequest } from "next/server";
import { createNonceContentSecurityPolicy } from "./lib/csp";
import {
  LOCALE_COOKIE,
  localeFromAcceptLanguage,
  localeFromCookieHeader,
  localeFromPath,
  stripLocalePrefix,
  withLocalePath,
} from "./lib/i18n";

function rotaComNonce(pathname: string) {
  return pathname === "/login"
    || pathname === "/esqueci-senha"
    || pathname === "/redefinir-senha"
    || pathname === "/upload"
    || pathname === "/perfil"
    || pathname === "/configuracoes"
    || pathname === "/dashboard"
    || pathname.startsWith("/dashboard/");
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const pathLocale = localeFromPath(pathname);
  const cookieLocale = localeFromCookieHeader(request.headers.get("cookie"));
  const locale = pathLocale ?? cookieLocale ?? localeFromAcceptLanguage(request.headers.get("accept-language"));
  const internalPath = pathLocale ? stripLocalePrefix(pathname) : pathname;

  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-fotura-locale", locale);

  let csp: string | null = null;
  if (rotaComNonce(internalPath)) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    csp = createNonceContentSecurityPolicy(nonce);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
  }

  const isApi = pathname.startsWith("/api/");
  const isAdmin = internalPath === "/admin" || internalPath.startsWith("/admin/");
  const isOg = internalPath === "/opengraph-image" || internalPath.endsWith("/opengraph-image");

  if (!pathLocale && !isApi && !isAdmin && !isOg) {
    const url = request.nextUrl.clone();
    const localized = withLocalePath(pathname, locale);
    url.pathname = localized;
    const response = NextResponse.redirect(url);
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const url = request.nextUrl.clone();
  if (pathLocale) url.pathname = internalPath;

  const response = pathLocale
    ? NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } });

  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
  response.headers.set("x-request-id", requestId);
  if (csp) response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon\.svg|apple-touch-icon\.png|icon-192\.png|icon-512\.png|manifest\.json|sw\.js|robots\.txt|sitemap\.xml|.*\\.(?:png|jpg|jpeg|webp|gif|svg|ico|css|js|map|woff|woff2)$).*)",
  ],
};
