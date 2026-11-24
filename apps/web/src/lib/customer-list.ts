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
  const digits = (customer.taxId ?? "").replace(/\D/g, "");
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
