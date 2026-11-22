/**
 * Signa's pricing account never changes when a different fiscal recipient is
 * selected. The allowlist must come from the authenticated partner/company DB
 * lookup, not from request payloads.
 */
export type SignaBillingRecipient = {
  id: string;
  documentType: "CNPJ" | "CPF";
};

export function selectSignaFiscalRecipient(
  pricingCustomerId: string,
  requestedRecipientId: string,
  permittedRecipients: readonly SignaBillingRecipient[],
): string | null {
  if (
    !pricingCustomerId ||
    !permittedRecipients.some(
      (entry) =>
        entry.id === pricingCustomerId && entry.documentType === "CNPJ",
    )
  ) {
    return null;
  }
  const recipient = permittedRecipients.find(
    (entry) => entry.id === requestedRecipientId,
  );
  return recipient?.id ?? null;
}
