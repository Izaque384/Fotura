import { expect, test } from "@playwright/test";
import {
  APPROVED_MONTHLY_PRICES,
  BASE_PRICING_CURRENCY,
  PRICING_CURRENCY_STATUS,
  approvedMonthlyPrice,
  defaultPricingCurrencyForCountry,
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
