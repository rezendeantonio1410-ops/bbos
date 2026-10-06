import {
  onlyDigits,
  validateStateRegistration,
  validateTaxId,
} from "./supplier-verification";

export const CUSTOMER_STATE_REGISTRATION_TYPES = [
  "NUMBER",
  "EXEMPT",
  "NON_TAXPAYER",
] as const;

export type CustomerStateRegistrationType =
  (typeof CUSTOMER_STATE_REGISTRATION_TYPES)[number];

export type CustomerFiscalInput = {
  name?: unknown;
  legalName?: unknown;
  taxId?: unknown;
  postalCode?: unknown;
  address?: unknown;
  addressNumber?: unknown;
  addressComplement?: unknown;
  district?: unknown;
  city?: unknown;
  state?: unknown;
  stateRegistration?: unknown;
  stateRegistrationType?: unknown;
};

const text = (value: unknown) => String(value ?? "").trim();

export function normalizeCustomerFiscalData(input: CustomerFiscalInput) {
  const taxId = onlyDigits(text(input.taxId));
  const documentType = validateTaxId(taxId);
  const requestedRegistrationType = text(
    input.stateRegistrationType,
  ).toUpperCase();
  const stateRegistrationType =
    documentType === "CPF"
      ? "NON_TAXPAYER"
      : CUSTOMER_STATE_REGISTRATION_TYPES.includes(
            requestedRegistrationType as CustomerStateRegistrationType,
          )
        ? (requestedRegistrationType as CustomerStateRegistrationType)
        : "";

  return {
    name: text(input.name),
    legalName: text(input.legalName),
    taxId,
    documentType,
    postalCode: onlyDigits(text(input.postalCode)),
    address: text(input.address),
    addressNumber: text(input.addressNumber),
    addressComplement: text(input.addressComplement),
    district: text(input.district),
    city: text(input.city),
    state: text(input.state).toUpperCase(),
    stateRegistration:
      stateRegistrationType === "NUMBER"
        ? onlyDigits(text(input.stateRegistration))
        : "",
    stateRegistrationType,
  };
}

export function assessCustomerFiscalReadiness(input: CustomerFiscalInput) {
  const normalized = normalizeCustomerFiscalData(input);
  const issues: string[] = [];

  if (!normalized.name) issues.push("nome do cliente");
  if (!normalized.documentType) issues.push("CPF/CNPJ válido");
  if (normalized.documentType === "CNPJ" && !normalized.legalName) {
    issues.push("razão social");
  }
  if (normalized.postalCode.length !== 8) issues.push("CEP com 8 dígitos");
  if (!normalized.address) issues.push("logradouro");
  if (!normalized.addressNumber) issues.push("número do endereço ou S/N");
  if (!normalized.district) issues.push("bairro");
  if (!normalized.city) issues.push("cidade");
  if (!/^[A-Z]{2}$/.test(normalized.state)) issues.push("UF");

  if (normalized.documentType === "CNPJ") {
    if (!normalized.stateRegistrationType) {
      issues.push("situação da inscrição estadual");
    } else if (normalized.stateRegistrationType === "NUMBER") {
      if (!normalized.stateRegistration) {
        issues.push("inscrição estadual");
      } else if (
        !validateStateRegistration(
          normalized.stateRegistration,
          normalized.state,
        )
      ) {
        issues.push("inscrição estadual válida para a UF");
      }
    }
  }

  return {
    ready: issues.length === 0,
    issues,
    documentType: normalized.documentType,
    normalized,
  };
}

export function customerFiscalReadinessMessage(input: CustomerFiscalInput) {
  const readiness = assessCustomerFiscalReadiness(input);
  if (readiness.ready) return null;
  return `Complete o cadastro fiscal do cliente antes de faturar: ${readiness.issues.join(", ")}.`;
}
