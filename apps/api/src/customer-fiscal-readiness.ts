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
  countryCode?: unknown;
  countryName?: unknown;
  foreignTaxId?: unknown;
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
  const countryCode = text(input.countryCode).toUpperCase() || "BR";
  const isForeign = countryCode !== "BR";
  const taxId = isForeign ? "" : onlyDigits(text(input.taxId));
  const documentType = isForeign ? "FOREIGN" : validateTaxId(taxId);
  const requestedRegistrationType = text(
    input.stateRegistrationType,
  ).toUpperCase();
  const stateRegistrationType =
    isForeign || documentType === "CPF"
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
    isForeign,
    countryCode,
    countryName:
      text(input.countryName) || (countryCode === "BR" ? "Brasil" : ""),
    foreignTaxId: isForeign ? text(input.foreignTaxId) : "",
    postalCode: isForeign
      ? text(input.postalCode)
      : onlyDigits(text(input.postalCode)),
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
  if (normalized.isForeign) {
    if (!/^[A-Z]{2}$/.test(normalized.countryCode)) {
      issues.push("código do país");
    }
    if (!normalized.countryName) issues.push("país");
    if (!normalized.foreignTaxId) {
      issues.push("identificação fiscal estrangeira");
    }
  } else if (!normalized.documentType) {
    issues.push("CPF/CNPJ válido");
  }
  if (normalized.documentType === "CNPJ" && !normalized.legalName) {
    issues.push("razão social");
  }
  if (!normalized.isForeign && normalized.postalCode.length !== 8) {
    issues.push("CEP com 8 dígitos");
  }
  if (!normalized.address) issues.push("logradouro");
  if (!normalized.isForeign && !normalized.addressNumber) {
    issues.push("número do endereço ou S/N");
  }
  if (!normalized.district) issues.push("bairro");
  if (!normalized.city) issues.push("cidade");
  if (!normalized.isForeign && !/^[A-Z]{2}$/.test(normalized.state)) {
    issues.push("UF");
  }

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
    isForeign: normalized.isForeign,
    normalized,
  };
}

export function customerFiscalReadinessMessage(input: CustomerFiscalInput) {
  const readiness = assessCustomerFiscalReadiness(input);
  if (readiness.ready) return null;
  return `Complete o cadastro fiscal do cliente antes de faturar: ${readiness.issues.join(", ")}.`;
}
