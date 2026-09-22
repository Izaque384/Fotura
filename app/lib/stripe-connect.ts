import "server-only";

const STRIPE_V1 = "https://api.stripe.com/v1";
const STRIPE_V2 = "https://api.stripe.com/v2";
const STRIPE_V2_VERSION = "2026-08-26.preview";

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

export type StripeConnectAccount = {
  id: string;
  dashboard?: string | null;
  configuration?: {
    merchant?: {
      capabilities?: {
        card_payments?: { status?: string | null };
      };
    } | null;
  } | null;
  requirements?: unknown;
};

export async function criarContaFotografo(email: string | null, nome: string | null) {
  const body = {
    ...(email ? { contact_email: email } : {}),
    display_name: nome?.trim() || email || "Fotógrafo Fotura",
    dashboard: "full",
    identity: { country: "br" },
    configuration: {
      merchant: {
        capabilities: {
          card_payments: { requested: true },
        },
      },
    },
    defaults: {
      currency: "brl",
      responsibilities: {
        fees_collector: "stripe",
        losses_collector: "stripe",
      },
      locales: ["pt-BR"],
    },
    include: ["configuration.merchant", "identity", "requirements"],
  };

  return resposta<StripeConnectAccount>(await fetch(`${STRIPE_V2}/core/accounts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/json",
      "Stripe-Version": STRIPE_V2_VERSION,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  }));
}

export async function criarLinkOnboardingFotografo(accountId: string, origin: string) {
  return resposta<{ id: string; url: string }>(await fetch(`${STRIPE_V2}/core/account_links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/json",
      "Stripe-Version": STRIPE_V2_VERSION,
    },
    body: JSON.stringify({
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["merchant"],
          refresh_url: `${origin}/dashboard/galerias?recebimentos=renovar`,
          return_url: `${origin}/dashboard/galerias?recebimentos=retorno`,
        },
      },
    }),
    cache: "no-store",
  }));
}

export async function obterContaFotografo(accountId: string) {
  const params = new URLSearchParams();
  params.append("include", "configuration.merchant");
  params.append("include", "requirements");
  return resposta<StripeConnectAccount>(await fetch(
    `${STRIPE_V2}/core/accounts/${encodeURIComponent(accountId)}?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${secret()}`,
        "Stripe-Version": STRIPE_V2_VERSION,
      },
      cache: "no-store",
    }
  ));
}

export function recebimentosAtivos(account: StripeConnectAccount) {
  return account.configuration?.merchant?.capabilities?.card_payments?.status === "active";
}

function form(campos: Record<string, string | number | boolean | null | undefined>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(campos)) {
    if (value !== null && value !== undefined) body.append(key, String(value));
  }
  return body;
}

export async function stripeConnectedPost<T>(
  accountId: string,
  path: string,
  campos: Record<string, string | number | boolean | null | undefined>,
  idempotencyKey?: string,
) {
  return resposta<T>(await fetch(`${STRIPE_V1}${path}`, {
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
  return resposta<T>(await fetch(`${STRIPE_V1}${path}`, {
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
