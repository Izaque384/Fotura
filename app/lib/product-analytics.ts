"use client";

export type ProdutoEvento =
  | "landing_view"
  | "landing_signup_clicked"
  | "dashboard_view"
  | "sales_page_view"
  | "plan_page_view"
  | "plan_checkout_started"
  | "upgrade_prompt_view"
  | "upgrade_prompt_clicked"
  | "gallery_shared"
  | "public_gallery_view"
  | "extra_sale_checkout_started"
  | "extra_sale_payment_confirmed";

type EventoOpcoes = {
  token?: string | null;
  rota?: string;
  entidade?: string;
  entidadeId?: string;
  detalhes?: Record<string, string | number | boolean | null | undefined>;
};

const SESSION_KEY = "fotura_produto_sessao";

function sessaoId() {
  if (typeof window === "undefined") return null;
  try {
    let atual = window.sessionStorage.getItem(SESSION_KEY);
    if (!atual) {
      atual = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
      window.sessionStorage.setItem(SESSION_KEY, atual);
    }
    return atual;
  } catch {
    return null;
  }
}

export function utmAtual() {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const detalhes: Record<string, string> = {};
  for (const chave of ["utm_source", "utm_medium", "utm_campaign"] as const) {
    const valor = q.get(chave)?.trim();
    if (valor) detalhes[chave] = valor.slice(0, 100);
  }
  return detalhes;
}

export function registrarEventoProduto(evento: ProdutoEvento, opcoes: EventoOpcoes = {}) {
  if (typeof window === "undefined") return;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opcoes.token) headers.Authorization = `Bearer ${opcoes.token}`;

  void fetch("/api/analytics/event", {
    method: "POST",
    headers,
    keepalive: true,
    body: JSON.stringify({
      evento,
      rota: opcoes.rota ?? window.location.pathname,
      entidade: opcoes.entidade,
      entidadeId: opcoes.entidadeId,
      sessaoId: sessaoId(),
      detalhes: opcoes.detalhes ?? {},
    }),
  }).catch(() => {});
}
