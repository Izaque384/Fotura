import type { Metadata } from "next";
import { headers } from "next/headers";
import { defaultPricingCurrencyForCountry } from "../../lib/pricing-markets";
import VideoBackgroundPreview from "./VideoBackgroundPreview";

export const metadata: Metadata = {
  title: "Fotura — prévia com vídeo de fundo",
  description: "Demonstração isolada da landing atual do Fotura com vídeo persistente ao fundo.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default async function LandingVideoPreviewPage() {
  const requestHeaders = await headers();
  const initialCurrency = defaultPricingCurrencyForCountry(requestHeaders.get("x-vercel-ip-country"));
  return <VideoBackgroundPreview initialCurrency={initialCurrency} />;
}
