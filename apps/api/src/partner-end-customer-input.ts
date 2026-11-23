import { isValidCnpj } from "./supplier-verification";

// Commercial end-customer data stays isolated from fiscal Customer and billing recipients.
export type PartnerEndCustomerPatch = Partial<{
  name: string;
  taxId: string | null;
  postalCode: string | null;
  street: string | null;
  number: string | null;
  district: string | null;
  complement: string | null;
  city: string | null;
  state: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
}>;

export type PartnerEndCustomerInputMode = "create" | "update";

export const partnerEndCustomerFields = [
  "name", "taxId", "postalCode", "street", "number", "district", "complement", "city", "state",
  "email", "phone", "notes",
] as const;
type Field = typeof partnerEndCustomerFields[number];

/**
 * Fields that a complete commercial registration must carry. Only the
 * complement is optional. On update, a required field may be omitted (partial
 * change) but can never be cleared.
 */
export const partnerEndCustomerRequiredFields: readonly Field[] = [
  "name", "taxId", "postalCode", "street", "number", "district", "city", "state",
];

const labels: Record<Field, string> = {
  name: "Nome / Razão social", taxId: "CNPJ", postalCode: "CEP", street: "Rua",
  number: "Número", district: "Bairro", complement: "Complemento", city: "Cidade", state: "UF",
  email: "E-mail", phone: "Telefone", notes: "Observações",
};
const maxLength: Partial<Record<Field, number>> = {
  street: 180, number: 30, district: 120, complement: 120, city: 120,
  email: 254, phone: 40, notes: 1000,
};
const brazilianStates = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

export function parsePartnerEndCustomerPatch(
  input: unknown,
  mode: PartnerEndCustomerInputMode = "update",
): PartnerEndCustomerPatch {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Informe os campos do cliente comercial.");
  }
  const source = input as Record<string, unknown>;
  const keys = Object.keys(source);
  if (!keys.length || keys.some(key => !partnerEndCustomerFields.includes(key as Field))) {
    throw new Error("Campos não permitidos no cliente comercial.");
  }
  const values: Record<string, string | null> = {};
  for (const key of keys as Field[]) {
    const raw = source[key];
    if (typeof raw !== "string") throw new Error("Os campos do cliente devem ser textos.");
    const value = raw.trim();
    if (key === "name") {
      if (value.length < 2 || value.length > 180) throw new Error("Informe o nome do cliente (2 a 180 caracteres).");
      values.name = value;
    } else if (key === "taxId") {
      const digits = value.replace(/\D/g, "");
      if (value && (digits.length !== 14 || !isValidCnpj(digits))) {
        throw new Error("CNPJ inválido. Confira os 14 dígitos.");
      }
      values.taxId = digits || null;
    } else if (key === "postalCode") {
      const digits = value.replace(/\D/g, "");
      if (value && digits.length !== 8) throw new Error("Informe um CEP com 8 dígitos.");
      values.postalCode = digits || null;
    } else if (key === "state") {
      const state = value.toUpperCase();
      if (state && !brazilianStates.has(state)) throw new Error("Informe uma UF válida.");
      values.state = state || null;
    } else if (key === "email") {
      if (value && (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
        throw new Error("Informe um e-mail válido.");
      }
      values.email = value.toLowerCase() || null;
    } else {
      if (value.length > (maxLength[key] ?? 120)) {
        throw new Error(`${labels[key]}: texto muito longo.`);
      }
      values[key] = value || null;
    }
  }
  for (const field of partnerEndCustomerRequiredFields) {
    const present = Object.prototype.hasOwnProperty.call(values, field);
    if ((mode === "create" && !present) || (present && values[field] == null)) {
      throw new Error(`Informe ${labels[field]} do cliente comercial.`);
    }
  }
  return values as PartnerEndCustomerPatch;
}
