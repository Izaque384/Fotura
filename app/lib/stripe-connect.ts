import "server-only";

const STRIPE_API = "https://api.stripe.com/v1";

function secret() {
  const value = process.env.STRIPE_SECRET_KEY?.trim();
  if (!value) throw new Error("STRIPE_SECRET_KEY não configurada");
  return value;
}

async function resposta<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as ({ error?: { message?: string } } & T) | null;
  if (!response.ok) throw new Error(payload?.error?.message || `Stripe HTTP ${response.status}`);
  return payload as T;
}

function form(campos: Record<string, string | number | boolean | null | undefined>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(campos)) {
    if (value !== null && value !== undefined) body.append(key, String(value));
  }
  return body;
}

export type StripeConnectAccount = {
  id: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  email?: string | null;
  country?: string | null;
  controller?: {
    fees?: { payer?: string | null };
    losses?: { payments?: string | null };
    requirement_collection?: string | null;
    stripe_dashboard?: { type?: string | null };
  } | null;
  requirements?: {
    currently_due?: string[];
    eventually_due?: string[];
    disabled_reason?: string | null;
  } | null;
};

export async function criarContaFotografo(email: string | null, nome: string | null) {
  return resposta<StripeConnectAccount>(await fetch(`${STRIPE_API}/accounts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form({
      country: "BR",
      ...(email ? { email } : {}),
      ...(nome?.trim() ? { "business_profile[name]": nome.trim() } : {}),
      "controller[fees][payer]": "account",
      "controller[losses][payments]": "stripe",
      "controller[requirement_collection]": "stripe",
      "controller[stripe_dashboard][type]": "full",
      "capabilities[card_payments][requested]": "true",
    }),
    cache: "no-store",
  }));
}

export async function criarLinkOnboardingFotografo(accountId: string, origin: string) {
  return resposta<{ object: string; created: number; expires_at: number; url: string }>(await fetch(`${STRIPE_API}/account_links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form({
      account: accountId,
      refresh_url: `${origin}/dashboard/galerias?recebimentos=renovar`,
      return_url: `${origin}/dashboard/galerias?recebimentos=retorno`,
      type: "account_onboarding",
      "collection_options[fields]": "eventually_due",
    }),
    cache: "no-store",
  }));
}

export async function obterContaFotografo(accountId: string) {
  return resposta<StripeConnectAccount>(await fetch(
    `${STRIPE_API}/accounts/${encodeURIComponent(accountId)}`,
    {
      headers: { Authorization: `Bearer ${secret()}` },
      cache: "no-store",
    }
  ));
}

export function recebimentosAtivos(account: StripeConnectAccount) {
  return account.charges_enabled === true;
}

export async function stripeConnectedPost<T>(
  accountId: string,
  path: string,
  campos: Record<string, string | number | boolean | null | undefined>,
  idempotencyKey?: string,
) {
  return resposta<T>(await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Stripe-Account": accountId,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: form(campos),
    cache: "no-store",
  }));
}

export async function stripeConnectedGet<T>(accountId: string, path: string) {
  return resposta<T>(await fetch(`${STRIPE_API}${path}`, {
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Stripe-Account": accountId,
    },
    cache: "no-store",
  }));
}

export type StripeSaleCheckout = {
  id: string;
  url: string | null;
  payment_status?: string | null;
  payment_intent?: string | { id?: string } | null;
  metadata?: Record<string, string>;
};
