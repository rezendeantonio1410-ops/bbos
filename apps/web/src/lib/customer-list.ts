import { normalizeCnpj } from "@bbos/shared";

/** Quick filters of the customer list (Fiori "filter bar" chips). */
export type CustomerQuickFilter = "ALL" | "ATTENTION" | "CREDIT_REVIEW" | "FISCAL_PENDING" | "TAX_ID_CHECK";

type ListCustomer = {
  active?: boolean;
  financialHealth?: { health?: string } | null;
  creditReviewPending?: boolean;
  creditStatus?: string;
  fiscalReadiness?: { ready?: boolean } | null;
  taxId?: string | null;
  countryCode?: string | null;
  taxIdVerificationStatus?: string | null;
};

export function taxIdNeedsCheck(customer: ListCustomer) {
  const digits = normalizeCnpj(customer.taxId);
  const brazilian = (customer.countryCode ?? "BR") === "BR";
  const relevant = brazilian && (digits.length === 0 || digits.length === 14);
  const confirmed = ["VERIFIED_ACTIVE", "CONFIRMED_INTERNAL"].includes(customer.taxIdVerificationStatus ?? "");
  return relevant && !confirmed;
}

export function matchesQuickFilter(customer: ListCustomer, filter: CustomerQuickFilter) {
  switch (filter) {
    case "ATTENTION":
      return ["ATTENTION", "BLOCKED"].includes(customer.financialHealth?.health ?? "");
    case "CREDIT_REVIEW":
      return Boolean(customer.creditReviewPending) || customer.creditStatus === "UNDER_REVIEW";
    case "FISCAL_PENDING":
      return !customer.fiscalReadiness?.ready;
    case "TAX_ID_CHECK":
      return taxIdNeedsCheck(customer);
    default:
      return true;
  }
}

export const QUICK_FILTERS: Array<{ key: CustomerQuickFilter; label: string; tone: "neutral" | "warn" | "info" }> = [
  { key: "ALL", label: "Todos", tone: "neutral" },
  { key: "ATTENTION", label: "Pedem atenção", tone: "warn" },
  { key: "CREDIT_REVIEW", label: "Crédito em análise", tone: "info" },
  { key: "FISCAL_PENDING", label: "Cadastro fiscal pendente", tone: "warn" },
  { key: "TAX_ID_CHECK", label: "CNPJ a conferir", tone: "warn" },
];

/** Short status for the list; the full guidance stays in the tooltip. */
export function healthChip(health?: string) {
  switch (health) {
    case "HEALTHY":
      return { label: "Em ordem", className: "bg-emerald-50 text-emerald-800" };
    case "ATTENTION":
      return { label: "Vale conferir", className: "bg-amber-50 text-amber-900" };
    case "BLOCKED":
      return { label: "Prazo bloqueado", className: "bg-red-50 text-red-800" };
    default:
      return { label: "Só à vista", className: "bg-sky-50 text-sky-800" };
  }
}

// ---- Place filters (city and district), the base for mapping customers.

type PlaceCustomer = { city?: string | null; state?: string | null; district?: string | null };

const placeKey = (value?: string | null) =>
  (value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

/** "londrina|pr" — same city regardless of accents, case or spaces. */
export function cityKey(customer: PlaceCustomer) {
  const city = placeKey(customer.city);
  return city ? `${city}|${placeKey(customer.state)}` : "";
}

const accents = (value: string) => value.normalize("NFD").length - value.length;

export type PlaceOption = { value: string; label: string; count: number };

function options(entries: Array<{ key: string; label: string }>): PlaceOption[] {
  const byKey = new Map<string, { labels: Map<string, number>; count: number }>();
  for (const { key, label } of entries) {
    if (!key) continue;
    const entry = byKey.get(key) ?? { labels: new Map(), count: 0 };
    entry.count += 1;
    entry.labels.set(label, (entry.labels.get(label) ?? 0) + 1);
    byKey.set(key, entry);
  }
  return [...byKey.entries()]
    .map(([value, { labels, count }]) => ({
      value,
      // The spelling used most often becomes the label.
      // On a tie, prefer the accented spelling ("Cambé" over "Cambe").
      label: [...labels.entries()].sort((a, b) => b[1] - a[1] || accents(b[0]) - accents(a[0]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))[0]![0], // "Centro" before "centro"
      count,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

export function cityOptions(customers: PlaceCustomer[]) {
  return options(
    customers.map((c) => ({
      key: cityKey(c),
      label: `${(c.city ?? "").trim()}${c.state ? `/${c.state.trim().toUpperCase()}` : ""}`,
    })),
  );
}

export function districtOptions(customers: PlaceCustomer[], city: string) {
  return options(
    customers
      .filter((c) => city && cityKey(c) === city)
      .map((c) => ({ key: placeKey(c.district), label: (c.district ?? "").trim() })),
  );
}

export function matchesPlace(customer: PlaceCustomer, city: string, district: string) {
  if (city && cityKey(customer) !== city) return false;
  if (district && placeKey(customer.district) !== district) return false;
  return true;
}
