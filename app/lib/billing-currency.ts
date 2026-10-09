export const MOEDAS_COBRANCA = ["brl", "usd", "eur"] as const;

export type MoedaCobranca = (typeof MOEDAS_COBRANCA)[number];

export const MOEDA_COBRANCA_PADRAO: MoedaCobranca = "brl";

export function moedaCobranca(valor: unknown): MoedaCobranca | null {
  if (typeof valor !== "string") return null;
  const normalizada = valor.trim().toLowerCase();
  return (MOEDAS_COBRANCA as readonly string[]).includes(normalizada)
    ? normalizada as MoedaCobranca
    : null;
}

export function formatarMoeda(
  centavos: number,
  moeda: MoedaCobranca,
  locale = "pt-BR",
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: moeda.toUpperCase(),
  }).format(centavos / 100);
}
