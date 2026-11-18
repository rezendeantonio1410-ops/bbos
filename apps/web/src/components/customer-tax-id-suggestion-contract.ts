export type ConfirmedTaxIdStatus = "VERIFIED_ACTIVE" | "CONFIRMED_INTERNAL";

export type TaxIdSuggestionRejectionReason = "NONE_MATCH" | "MANUAL_ENTRY";

export type TaxIdConfirmationSnapshot = {
  customer: {
    taxId: string;
    verificationStatus: string;
  };
  suggestions: Array<{
    taxId: string;
    status?: unknown;
  }>;
};

export function canonicalCnpj(value: unknown) {
  if (typeof value !== "string") return "";
  const digits = value.replace(/\D/g, "");
  return digits.length === 14 ? digits : "";
}

export function normalizeTaxIdStatus(status: unknown) {
  return typeof status === "string" ? status.trim().toUpperCase() : "";
}

export function isConfirmedTaxIdStatus(status: unknown): boolean {
  const normalized = normalizeTaxIdStatus(status);
  return (
    normalized === "VERIFIED_ACTIVE" || normalized === "CONFIRMED_INTERNAL"
  );
}

export function isConfirmedTaxIdSuggestionStatus(status: unknown) {
  return normalizeTaxIdStatus(status) === "CONFIRMED";
}

export function filterTaxIdSuggestionsForSnapshot<
  Suggestion extends { taxId: string; status?: unknown },
>(
  suggestions: Suggestion[],
  customerTaxId: unknown,
  verificationStatus: unknown,
) {
  const confirmedTaxId = canonicalCnpj(customerTaxId);
  const customerIsConfirmed =
    Boolean(confirmedTaxId) && isConfirmedTaxIdStatus(verificationStatus);

  return suggestions.filter((suggestion) => {
    const suggestionTaxId = canonicalCnpj(suggestion.taxId);
    if (!suggestionTaxId) return false;
    if (!isConfirmedTaxIdSuggestionStatus(suggestion.status)) return true;
    return customerIsConfirmed && suggestionTaxId === confirmedTaxId;
  });
}

export function confirmedTaxIdFromSnapshot(
  snapshot: TaxIdConfirmationSnapshot,
  selectedTaxId: string,
) {
  const selected = canonicalCnpj(selectedTaxId);
  const returned = canonicalCnpj(snapshot.customer.taxId);

  if (!selected || !returned || selected !== returned) {
    throw new Error(
      "A confirmação retornou um CNPJ diferente ou incompleto. Nenhuma alteração foi aplicada.",
    );
  }

  if (!isConfirmedTaxIdStatus(snapshot.customer.verificationStatus)) {
    throw new Error(
      "A confirmação não retornou um status válido. Nenhuma alteração foi aplicada.",
    );
  }

  const suggestionWasConfirmed = snapshot.suggestions.some(
    (suggestion) =>
      canonicalCnpj(suggestion.taxId) === returned &&
      isConfirmedTaxIdSuggestionStatus(suggestion.status),
  );
  if (!suggestionWasConfirmed) {
    throw new Error(
      "A sugestão ainda não foi confirmada pelo BBOS. Nenhuma alteração foi aplicada.",
    );
  }

  return returned;
}

export function taxIdSuggestionRejectionRequest(
  customerId: string,
  reason: TaxIdSuggestionRejectionReason,
) {
  return {
    path: `/customers/${encodeURIComponent(customerId)}/tax-id-suggestions/reject`,
    init: {
      method: "POST" as const,
      body: JSON.stringify({ reason, acknowledged: true }),
    },
  };
}
