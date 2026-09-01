import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PlanoCodigo } from "./billing-plans";

const STRIPE_API = "https://api.stripe.com/v1";

export const STRIPE_PRICE_POR_PLANO: Partial<Record<PlanoCodigo, string>> = {
  essencial: "price_1UAxnsPNUFf8TwH8rk19eNLO",
  profissional: "price_1UAxo1PNUFf8TwH8mtTjyndm",
  studio: "price_1UAxoxPNUFf8TwH8fnkLnqam",
};

export function planoPorStripePrice(priceId: string | null | undefined): PlanoCodigo | null {
  if (!priceId) return null;
  for (const [plano, id] of Object.entries(STRIPE_PRICE_POR_PLANO)) {
    if (id === priceId) return plano as PlanoCodigo;
  }
  return null;
}

function stripeSecret() {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) throw new Error("STRIPE_SECRET_KEY não configurada");
  return secret;
}

export function stripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET não configurada");
  return secret;
}

function adicionar(params: URLSearchParams, chave: string, valor: string | number | boolean | null | undefined) {
  if (valor === null || valor === undefined) return;
  params.append(chave, String(valor));
}

export async function stripePost<T>(path: string, campos: Record<string, string | number | boolean | null | undefined>, idempotencyKey?: string): Promise<T> {
  const body = new URLSearchParams();
  for (const [chave, valor] of Object.entries(campos)) adicionar(body, chave, valor);

  const response = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecret()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Stripe HTTP ${response.status}`);
  }
  return payload as T;
}

export function verificarAssinaturaStripe(payload: string, signatureHeader: string, secret: string, toleranciaSegundos = 300) {
  const partes = signatureHeader.split(",").map((item) => item.trim());
  const timestamp = partes.find((p) => p.startsWith("t="))?.slice(2);
  const assinaturas = partes.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestamp || !assinaturas.length) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > toleranciaSegundos) return false;

  const esperado = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest();
  return assinaturas.some((hex) => {
    try {
      const recebido = Buffer.from(hex, "hex");
      return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
    } catch {
      return false;
    }
  });
}

export type StripeCheckoutSession = {
  id: string;
  url: string | null;
  customer: string | null;
  subscription: string | null;
  client_reference_id: string | null;
  metadata?: Record<string, string>;
};

export type StripePortalSession = { id: string; url: string };

export type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_start?: number;
  current_period_end?: number;
  metadata?: Record<string, string>;
  items?: {
    data?: Array<{
      current_period_start?: number;
      current_period_end?: number;
      price?: { id?: string };
    }>;
  };
};

export function periodoAssinatura(subscription: StripeSubscription) {
  const item = subscription.items?.data?.[0];
  return {
    inicio: subscription.current_period_start ?? item?.current_period_start ?? null,
    fim: subscription.current_period_end ?? item?.current_period_end ?? null,
  };
}
