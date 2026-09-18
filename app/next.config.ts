import type { NextConfig } from "next";
import { CONTENT_SECURITY_POLICY } from "./lib/csp";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
];

const noIndexHeader = {
  key: "X-Robots-Tag",
  value: "noindex, nofollow, noarchive",
};

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      { source: "/dashboard/:path*", headers: [noIndexHeader] },
      { source: "/admin/:path*", headers: [noIndexHeader] },
      { source: "/api/:path*", headers: [noIndexHeader] },
      { source: "/g/:path*", headers: [noIndexHeader] },
      { source: "/upload", headers: [noIndexHeader] },
      { source: "/perfil", headers: [noIndexHeader] },
      { source: "/configuracoes", headers: [noIndexHeader] },
      { source: "/login", headers: [noIndexHeader] },
      { source: "/esqueci-senha", headers: [noIndexHeader] },
      { source: "/redefinir-senha", headers: [noIndexHeader] },
    ];
  },
};

export default nextConfig;
