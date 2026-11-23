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
}>;

const editableFields = ["name", "taxId", "postalCode", "street", "number", "district", "complement", "city", "state"] as const;
const maxLength: Partial<Record<typeof editableFields[number], number>> = {
  street: 180, number: 30, district: 120, complement: 120, city: 120,
};

export function parsePartnerEndCustomerPatch(input: unknown): PartnerEndCustomerPatch {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Informe os campos do cliente comercial.");
  }
  const source = input as Record<string, unknown>;
  const keys = Object.keys(source);
  if (!keys.length || keys.some(key => !editableFields.includes(key as typeof editableFields[number]))) {
    throw new Error("Campos não permitidos no cliente comercial.");
  }
  const values: Record<string, string | null> = {};
  for (const key of keys) {
    const raw = source[key];
    if (typeof raw !== "string") throw new Error("Os campos do cliente devem ser textos.");
    const value = raw.trim();
    if (key === "name") {
      if (value.length < 2 || value.length > 180) throw new Error("Informe o nome do cliente (2 a 180 caracteres).");
      values.name = value;
    } else if (key === "taxId") {
      const digits = value.replace(/\D/g, "");
      if (value && digits.length !== 14) throw new Error("Informe um CNPJ com 14 dígitos.");
      values.taxId = digits || null;
    } else if (key === "postalCode") {
      const digits = value.replace(/\D/g, "");
      if (value && digits.length !== 8) throw new Error("Informe um CEP com 8 dígitos.");
      values.postalCode = digits || null;
    } else if (key === "state") {
      const state = value.toUpperCase();
      if (state && !/^[A-Z]{2}$/.test(state)) throw new Error("Informe a UF com duas letras.");
      values.state = state || null;
    } else {
      if (value.length > (maxLength[key as typeof editableFields[number]] ?? 120)) {
        throw new Error("Campo de endereço demasiado longo.");
      }
      values[key] = value || null;
    }
  }
  return values as PartnerEndCustomerPatch;
}
