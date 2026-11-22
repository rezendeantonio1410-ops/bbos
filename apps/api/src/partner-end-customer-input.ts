// Commercial end-customer updates never change the fiscal Customer registry.
export type PartnerEndCustomerPatch = Partial<{
  name: string;
  city: string | null;
  state: string | null;
}>;

const editableFields = ["name", "city", "state"] as const;

export function parsePartnerEndCustomerPatch(input: unknown): PartnerEndCustomerPatch {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Informe os campos do cliente comercial.");
  }
  const source = input as Record<string, unknown>;
  const keys = Object.keys(source);
  if (!keys.length || keys.some((key) => !editableFields.includes(key as typeof editableFields[number]))) {
    throw new Error("Só é possível alterar nome, cidade e UF do cliente comercial.");
  }

  const values: PartnerEndCustomerPatch = {};
  for (const key of keys as Array<typeof editableFields[number]>) {
    const raw = source[key];
    if (typeof raw !== "string") {
      throw new Error("Os campos do cliente devem ser textos.");
    }
    const value = raw.trim();
    if (key === "name") {
      if (value.length < 2 || value.length > 180) {
        throw new Error("Informe o nome do cliente (2 a 180 caracteres).");
      }
      values.name = value;
    } else if (key === "city") {
      if (value.length > 120) {
        throw new Error("A cidade deve ter até 120 caracteres.");
      }
      values.city = value || null;
    } else {
      const state = value.toUpperCase();
      if (state && !/^[A-Z]{2}$/.test(state)) {
        throw new Error("Informe a UF com duas letras.");
      }
      values.state = state || null;
    }
  }
  return values;
}
