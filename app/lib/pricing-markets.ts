import type { PlanoCodigo } from "./billing-plans";

export const PRICING_CURRENCIES = ["BRL", "USD", "EUR"] as const;
export type PricingCurrency = (typeof PRICING_CURRENCIES)[number];
export type PaidPlanCode = Extract<PlanoCodigo, "essencial" | "profissional" | "studio">;

export const BASE_PRICING_CURRENCY: PricingCurrency = "BRL";

export const PRICING_CURRENCY_STATUS: Record<PricingCurrency, "active" | "pending_approval"> = {
  BRL: "active",
  USD: "pending_approval",
  EUR: "pending_approval",
};

export const APPROVED_MONTHLY_PRICES: Record<"BRL", Record<PaidPlanCode, number>> = {
  BRL: {
    essencial: 1490,
    profissional: 2990,
    studio: 5990,
  },
};

const EURO_COUNTRIES = new Set([
  "AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES",
]);

export function defaultPricingCurrencyForCountry(countryCode: string | null | undefined): PricingCurrency {
  const country = countryCode?.trim().toUpperCase();
  if (country === "BR") return "BRL";
  if (country && EURO_COUNTRIES.has(country)) return "EUR";
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
  if (currency !== "BRL") return null;
  return APPROVED_MONTHLY_PRICES.BRL[plan];
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
