import { expect, test } from "@playwright/test";
import {
  APPROVED_MONTHLY_PRICES,
  BASE_PRICING_CURRENCY,
  PRICING_CURRENCY_STATUS,
  approvedMonthlyPrice,
  defaultPricingCurrencyForCountry,
  normalizePricingCurrency,
  pricingCurrencyIsActive,
} from "../../lib/pricing-markets";

test.describe("international pricing architecture", () => {
  test("keeps the current BRL prices as the only approved live table", () => {
    expect(BASE_PRICING_CURRENCY).toBe("BRL");
    expect(APPROVED_MONTHLY_PRICES.BRL).toEqual({
      essencial: 1490,
      profissional: 2990,
      studio: 5990,
    });
    expect(approvedMonthlyPrice("essencial", "USD")).toBeNull();
    expect(approvedMonthlyPrice("studio", "EUR")).toBeNull();
    expect(pricingCurrencyIsActive("BRL")).toBe(true);
    expect(pricingCurrencyIsActive("USD")).toBe(false);
    expect(pricingCurrencyIsActive("EUR")).toBe(false);
    expect(PRICING_CURRENCY_STATUS.USD).toBe("pending_approval");
    expect(normalizePricingCurrency("usd")).toBe("USD");
    expect(normalizePricingCurrency(" eur ")).toBe("EUR");
    expect(normalizePricingCurrency("gbp")).toBeNull();
  });

  test("separates country from interface language when choosing the default currency", () => {
    expect(defaultPricingCurrencyForCountry("BR")).toBe("BRL");
    expect(defaultPricingCurrencyForCountry("US")).toBe("USD");
    expect(defaultPricingCurrencyForCountry("CA")).toBe("USD");
    expect(defaultPricingCurrencyForCountry("PT")).toBe("EUR");
    expect(defaultPricingCurrencyForCountry("ES")).toBe("EUR");
    expect(defaultPricingCurrencyForCountry("DE")).toBe("EUR");
    expect(defaultPricingCurrencyForCountry(undefined)).toBe("USD");
  });
});

test("checkout keeps BRL as default and never silently falls back across currencies", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const checkout = fs.readFileSync(path.join(process.cwd(), "app", "api", "billing", "checkout", "route.ts"), "utf8");
  const stripe = fs.readFileSync(path.join(process.cwd(), "lib", "stripe-billing.ts"), "utf8");

  expect(checkout).toContain("body.currency === undefined ? BASE_PRICING_CURRENCY : normalizePricingCurrency(body.currency)");
  expect(checkout).toContain("stripePricePorPlano(planoCodigo, currency)");
  expect(checkout).toContain('"metadata[billing_currency]": currency');
  expect(stripe).toContain('const nome = currency === "BRL" ? base : `${base}_${currency}`');
  expect(stripe).toContain("STRIPE_PRICE_LIVE_POR_MOEDA[currency]?.[plano] ?? priceEnv(plano, currency)");
});
