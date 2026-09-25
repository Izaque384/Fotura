export const FOTURA_TIME_ZONE = "America/Sao_Paulo";

function hojeNoFuso(agora = new Date(), timeZone = FOTURA_TIME_ZONE) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

export function dataCalendarioExpirada(data: string | null | undefined, agora = new Date(), timeZone = FOTURA_TIME_ZONE) {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  return hojeNoFuso(agora, timeZone) > data;
}

export function diasAteDataCalendario(data: string | null | undefined, agora = new Date(), timeZone = FOTURA_TIME_ZONE) {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const hoje = hojeNoFuso(agora, timeZone);
  const [ay, am, ad] = hoje.split("-").map(Number);
  const [dy, dm, dd] = data.split("-").map(Number);
  return Math.round((Date.UTC(dy, dm - 1, dd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}
