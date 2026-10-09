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
  test("activates the approved BRL, USD and EUR tables", () => {
    expect(BASE_PRICING_CURRENCY).toBe("BRL");
    expect(APPROVED_MONTHLY_PRICES).toEqual({
      BRL: { essencial: 1490, profissional: 2990, studio: 5990 },
      USD: { essencial: 299, profissional: 599, studio: 1199 },
      EUR: { essencial: 299, profissional: 599, studio: 1199 },
    });
    expect(approvedMonthlyPrice("essencial", "USD")).toBe(299);
    expect(approvedMonthlyPrice("studio", "EUR")).toBe(1199);
    expect(pricingCurrencyIsActive("BRL")).toBe(true);
    expect(pricingCurrencyIsActive("USD")).toBe(true);
    expect(pricingCurrencyIsActive("EUR")).toBe(true);
    expect(PRICING_CURRENCY_STATUS.USD).toBe("active");
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
    expect(defaultPricingCurrencyForCountry("GB")).toBe("EUR");
    expect(defaultPricingCurrencyForCountry("CH")).toBe("EUR");
    expect(defaultPricingCurrencyForCountry("PL")).toBe("EUR");
    expect(defaultPricingCurrencyForCountry(undefined)).toBe("USD");
  });
});

test("checkout uses the request market and never silently falls back across configured currencies", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const checkout = fs.readFileSync(path.join(process.cwd(), "app", "api", "billing", "checkout", "route.ts"), "utf8");
  const stripe = fs.readFileSync(path.join(process.cwd(), "lib", "stripe-billing.ts"), "utf8");

  expect(checkout).toContain('req.headers.get("x-vercel-ip-country")');
  expect(checkout).toContain("defaultPricingCurrencyForCountry(countryCode)");
  expect(checkout).toContain("countryCode ? detectedCurrency : requestedCurrency ?? BASE_PRICING_CURRENCY");
  expect(checkout).toContain("stripePricePorPlano(planoCodigo, currency)");
  expect(checkout).toContain("pricingCurrencyIsActive(currency)");
  expect(checkout).toContain('"metadata[billing_currency]": currency');
  expect(stripe).toContain('const nome = currency === "BRL" ? base : `${base}_${currency}`');
  expect(stripe).toContain("STRIPE_PRICE_LIVE_POR_MOEDA[currency]?.[plano] ?? priceEnv(plano, currency)");
  expect(stripe).toContain("price_1UOb0UPNUFf8TwH8uM9cHstr");
  expect(stripe).toContain("price_1UOb0dPNUFf8TwH8KesVyTdS");
  expect(stripe).toContain("price_1UOb0fPNUFf8TwH8ugYyTAVX");
  expect(stripe).toContain("price_1UOb0hPNUFf8TwH8VSvLnWjq");
  expect(stripe).toContain("price_1UOb0jPNUFf8TwH8o3r1BYOi");
  expect(stripe).toContain("price_1UOb0kPNUFf8TwH86za76Etv");
});
