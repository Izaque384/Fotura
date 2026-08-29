const BASE_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src-attr 'none'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
];

export const CONTENT_SECURITY_POLICY = [
  ...BASE_DIRECTIVES.slice(0, 8),
  // Mantido temporariamente para as páginas públicas e para os estilos inline ainda existentes.
  "script-src 'self' 'unsafe-inline'",
  ...BASE_DIRECTIVES.slice(8),
].join("; ");

export function createNonceContentSecurityPolicy(nonce: string) {
  return [
    ...BASE_DIRECTIVES.slice(0, 8),
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    ...BASE_DIRECTIVES.slice(8),
  ].join("; ");
}
