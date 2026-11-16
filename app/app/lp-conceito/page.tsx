import type { Metadata } from "next";
import { headers } from "next/headers";
import { defaultPricingCurrencyForCountry } from "../../lib/pricing-markets";
import ConceptClient from "./ConceptClient";

export const metadata: Metadata = {
  title: "Fotura — demonstração de landing page",
  description: "Prévia privada de um conceito visual para a landing page do Fotura.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default async function LandingConceptPage() {
  const incoming = await headers();
  const currency = defaultPricingCurrencyForCountry(incoming.get("x-vercel-ip-country"));
  return <ConceptClient currency={currency} />;
}
