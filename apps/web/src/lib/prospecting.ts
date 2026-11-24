import { formatCnpj as formatSharedCnpj } from "@bbos/shared";
/** Labels and formatting shared by "Prospecção" and "Por perto". */

export const SEGMENT_LABEL: Record<string, string> = {
  CAFETERIA: "Cafeteria",
  PADARIA_CONFEITARIA: "Padaria / confeitaria",
  POSTO_CONVENIENCIA: "Posto / conveniência",
  RESTAURANTE: "Restaurante",
  HOTEL: "Hotel / pousada",
  EMPRESA: "Empresa / escritório",
  EMPORIO: "Empório / mercado",
  OUTRO: "Outro",
};

export const STAGE_LABEL: Record<string, string> = {
  NAO_CONTATADO: "Não visitado",
  CONTATADO: "Contatado",
  VISITADO: "Visitado",
  DEGUSTACAO: "Degustação",
  PROPOSTA: "Proposta",
  CLIENTE: "Cliente",
  SEM_INTERESSE: "Sem interesse",
};

/** Stage colors: grey = to do, blue = in progress, green = won, red = lost. */
export const STAGE_TONE: Record<string, string> = {
  NAO_CONTATADO: "bg-stone-100 text-stone-700",
  CONTATADO: "bg-sky-50 text-sky-800",
  VISITADO: "bg-blue-50 text-blue-800",
  DEGUSTACAO: "bg-violet-50 text-violet-800",
  PROPOSTA: "bg-amber-50 text-amber-800",
  CLIENTE: "bg-emerald-50 text-emerald-800",
  SEM_INTERESSE: "bg-rose-50 text-rose-800",
};

export const POTENTIAL_LABEL: Record<string, string> = {
  MUITO_ALTA: "Muito alta",
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
  A_VERIFICAR: "A verificar",
};

export const MACHINE_LABEL: Record<string, string> = {
  SIM: "Tem máquina",
  NAO: "Sem máquina",
  NAO_VERIFICADO: "Não verificado",
};

export const CONFIDENCE_LABEL: Record<string, string> = {
  ALTA: "confiança alta",
  MEDIA: "confiança média",
  BAIXA: "confiança baixa — confira com atenção",
};

export function formatCnpj(value?: string | null) {
  return formatSharedCnpj(value);
}

export function formatPhone(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value ?? "";
}

export function formatDistance(km: number) {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km.toLocaleString("pt-BR", { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;
}

export function addressLine(row: { address?: string | null; addressNumber?: string | null; district?: string | null; city?: string | null }) {
  const street = [row.address, row.addressNumber].filter(Boolean).join(", ");
  return [street, row.district, row.city].filter(Boolean).join(" · ");
}

/** Opens turn-by-turn directions in the phone's maps app (Google Maps link works on iOS and Android). */
export function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function rhythmText(rhythm?: { usualIntervalDays: number | null; daysSinceLastOrder: number | null; overdueDays: number; orders: number } | null) {
  if (!rhythm || !rhythm.orders) return "Sem pedidos nos últimos 2 anos";
  if (rhythm.usualIntervalDays === null) return `Último pedido há ${rhythm.daysSinceLastOrder} dias`;
  const base = `Compra a cada ~${rhythm.usualIntervalDays} dias · último há ${rhythm.daysSinceLastOrder}`;
  return rhythm.overdueDays > 0 ? `${base} (${rhythm.overdueDays} de atraso)` : base;
}

/** Text search that ignores accents and case. */
export function matchesSearch(text: string, query: string) {
  const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const target = normalize(text);
  return normalize(query).split(/\s+/).filter(Boolean).every((word) => target.includes(word));
}
