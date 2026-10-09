import type { PlanoCodigo } from "./billing-plans";

export const PRICING_CURRENCIES = ["BRL", "USD", "EUR"] as const;
export type PricingCurrency = (typeof PRICING_CURRENCIES)[number];
export type PaidPlanCode = Extract<PlanoCodigo, "essencial" | "profissional" | "studio">;

export const BASE_PRICING_CURRENCY: PricingCurrency = "BRL";

export const PRICING_CURRENCY_STATUS: Record<PricingCurrency, "active" | "pending_approval"> = {
  BRL: "active",
  USD: "active",
  EUR: "active",
};

export const APPROVED_MONTHLY_PRICES: Record<PricingCurrency, Record<PaidPlanCode, number>> = {
  BRL: {
    essencial: 1490,
    profissional: 2990,
    studio: 5990,
  },
  USD: {
    essencial: 299,
    profissional: 599,
    studio: 1199,
  },
  EUR: {
    essencial: 299,
    profissional: 599,
    studio: 1199,
  },
};

const EUROPE_COUNTRIES = new Set([
  "AL", "AD", "AT", "BY", "BE", "BA", "BG", "HR", "CY", "CZ", "DK", "EE",
  "FI", "FR", "DE", "GR", "HU", "IS", "IE", "IT", "XK", "LV", "LI", "LT",
  "LU", "MT", "MD", "MC", "ME", "NL", "MK", "NO", "PL", "PT", "RO", "SM",
  "RS", "SK", "SI", "ES", "SE", "CH", "UA", "GB", "VA",
]);

export function defaultPricingCurrencyForCountry(countryCode: string | null | undefined): PricingCurrency {
  const country = countryCode?.trim().toUpperCase();
  if (country === "BR") return "BRL";
  if (country && EUROPE_COUNTRIES.has(country)) return "EUR";
  return "USD";
}

export function normalizePricingCurrency(value: unknown): PricingCurrency | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return (PRICING_CURRENCIES as readonly string[]).includes(normalized)
    ? normalized as PricingCurrency
    : null;
}

export function pricingCurrencyIsActive(currency: PricingCurrency): boolean {
  return PRICING_CURRENCY_STATUS[currency] === "active";
}

export function approvedMonthlyPrice(
  plan: PaidPlanCode,
  currency: PricingCurrency,
): number | null {
  return APPROVED_MONTHLY_PRICES[currency][plan];
}

export function formatPricingAmount(
  amountInMinorUnits: number,
  currency: PricingCurrency,
  locale: "pt" | "en" | "es" = "pt",
) {
  const localeTag = locale === "pt" ? "pt-BR" : locale === "es" ? "es-ES" : "en-US";
  return new Intl.NumberFormat(localeTag, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountInMinorUnits / 100);
}
