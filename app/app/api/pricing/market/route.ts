import { NextRequest, NextResponse } from "next/server";
import {
  APPROVED_MONTHLY_PRICES,
  defaultPricingCurrencyForCountry,
} from "../../../../lib/pricing-markets";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const country = req.headers.get("x-vercel-ip-country")?.trim().toUpperCase() || null;
  const currency = defaultPricingCurrencyForCountry(country);

  return NextResponse.json(
    {
      country,
      currency,
      prices: APPROVED_MONTHLY_PRICES[currency],
    },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}
