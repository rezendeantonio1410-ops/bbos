import { getApiBaseUrl } from "./api-url";

/** Labels and helpers shared by the export screens (clients abroad, samples, contracts). */

export const SAMPLE_STEPS = ["PREPARED", "SENT", "IN_TRANSIT", "CUSTOMS", "DELIVERED", "EVALUATED"] as const;

export const SAMPLE_STATUS_LABEL: Record<string, string> = {
  PREPARED: "Preparada",
  SENT: "Enviada",
  IN_TRANSIT: "Em trânsito",
  CUSTOMS: "Na alfândega",
  DELIVERED: "Entregue",
  EVALUATED: "Avaliada",
  LOST: "Extraviada",
  RETURNED: "Devolvida",
};

export const RESULT_LABEL: Record<string, string> = {
  APPROVED: "Aprovada",
  REJECTED: "Recusada",
  NEEDS_ANOTHER: "Pediu outra amostra",
};

export const CARRIER_LABEL: Record<string, string> = {
  DHL: "DHL",
  FEDEX: "FedEx",
  UPS: "UPS",
  CORREIOS: "Correios",
  TNT: "TNT",
  OTHER: "Outra",
};

export const CONTRACT_STATUS_LABEL: Record<string, string> = {
  NEGOTIATING: "Em negociação",
  SIGNED: "Assinado",
  SHIPPED: "Embarcado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

export const BUYER_STATUS_LABEL: Record<string, string> = {
  PROSPECT: "Prospect",
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
};

export const PRICE_UNIT_LABEL: Record<string, string> = {
  PER_LB: "por libra (lb)",
  PER_KG: "por kg",
  PER_BAG_60KG: "por saca de 60 kg",
  TOTAL: "valor total",
};

export const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DDP"];
export const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "BRL"];

/** Most frequent destinations first; any ISO code can be typed. */
export const COUNTRIES: Array<[string, string]> = [
  ["US", "Estados Unidos"], ["DE", "Alemanha"], ["JP", "Japão"], ["IT", "Itália"], ["BE", "Bélgica"],
  ["KR", "Coreia do Sul"], ["NL", "Países Baixos"], ["GB", "Reino Unido"], ["FR", "França"], ["CA", "Canadá"],
  ["AU", "Austrália"], ["CN", "China"], ["TW", "Taiwan"], ["SA", "Arábia Saudita"], ["AE", "Emirados Árabes"],
  ["CH", "Suíça"], ["SE", "Suécia"], ["NO", "Noruega"], ["DK", "Dinamarca"], ["ES", "Espanha"], ["PT", "Portugal"],
  ["RU", "Rússia"], ["CL", "Chile"], ["AR", "Argentina"], ["MX", "México"],
];

export function countryName(code?: string | null) {
  return COUNTRIES.find(([c]) => c === code)?.[1] ?? code ?? "";
}

/** "JP" → 🇯🇵 (regional indicator symbols). */
export function flag(code?: string | null) {
  if (!code || !/^[A-Z]{2}$/.test(code)) return "🌐";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

export function shortDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function dateTime(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Index of a status on the five-dot journey line (customs shares the transit dot). */
export function journeyIndex(status: string) {
  const order: Record<string, number> = { PREPARED: 0, SENT: 1, IN_TRANSIT: 2, CUSTOMS: 2, DELIVERED: 3, EVALUATED: 4 };
  return order[status] ?? 0;
}

export function alertText(alert?: { kind: string; days: number } | null) {
  if (!alert) return null;
  if (alert.kind === "CUSTOMS_STUCK") return `Na alfândega há ${alert.days} dias`;
  if (alert.kind === "FOLLOW_UP") return alert.days > 0 ? `Resposta atrasada ${alert.days} dia(s)` : "Cobrar resposta hoje";
  if (alert.kind === "NO_MOVEMENT") return `Sem movimento há ${alert.days} dias`;
  return null;
}

export async function exportsApi<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}/exports${path}`, {
    method: init?.method ?? "GET",
    credentials: "include",
    cache: "no-store",
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.message === "string" ? data.message : "Não foi possível concluir. Tente de novo.");
  return data as T;
}

/**
 * Form values from a link (?novo=1&name=…): lets a ready-made link open the
 * "new" form already filled, so the user only checks and saves. Only the
 * listed fields are read; values are trimmed and capped.
 */
export function prefillFromQuery(search: string, allowed: readonly string[]) {
  const params = new URLSearchParams(search);
  if (params.get("novo") !== "1") return null;
  const values: Record<string, string> = {};
  for (const key of allowed) {
    const value = params.get(key)?.trim();
    if (value) values[key] = value.slice(0, 500);
  }
  return values;
}

export const BUYER_PREFILL_FIELDS = ["name", "country", "city", "contactName", "email", "phone", "messenger", "legalRepresentative", "language", "currency", "incoterm", "taxId", "status", "address", "notes"] as const;
export const SAMPLE_PREFILL_FIELDS = ["cliente", "lotReference", "coffeeType", "weightKg", "reference", "proformaNumber", "declaredValue", "declaredCurrency", "shippedByName", "scaScore", "responseDays", "carrier", "trackingCode", "shippingCost", "notes"] as const;

/** Contract value in its own currency (price per lb, kg, 60 kg bag or total). */
export function contractValue(contract: { quantityKg: number | string; unitPrice: number | string; priceUnit: string }) {
  const q = Number(contract.quantityKg) || 0;
  const p = Number(contract.unitPrice) || 0;
  if (contract.priceUnit === "PER_LB") return q * 2.20462 * p;
  if (contract.priceUnit === "PER_BAG_60KG") return (q / 60) * p;
  if (contract.priceUnit === "TOTAL") return p;
  return q * p;
}
