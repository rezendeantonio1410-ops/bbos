import { isValidCnpj as isValidSharedCnpj, normalizeCnpj } from "@bbos/shared";
/**
 * Commercial end-customer form rules for the Signa portal. Mirrors the API
 * validation (apps/api/src/partner-end-customer-input.ts); the API remains the
 * authority. Never used for fiscal recipients.
 */
export type SignaEndCustomerForm = {
  name: string;
  taxId: string;
  postalCode: string;
  street: string;
  number: string;
  district: string;
  complement: string;
  city: string;
  state: string;
  /** Optional, manual: public CNPJ data has no IE. Digits or ISENTO. */
  stateRegistration?: string;
};

export const emptySignaEndCustomerForm: SignaEndCustomerForm = {
  name: "", taxId: "", postalCode: "", street: "", number: "",
  district: "", complement: "", city: "", state: "", stateRegistration: "",
};

const digits = (value: string) => value.replace(/\D/g, "");

export function isValidCnpj(value: string): boolean {
  return isValidSharedCnpj(value);
}

/** Progressive mask while typing; accepts letters of the new CNPJ format. */
export function formatCnpj(value: string): string {
  const c = normalizeCnpj(value).slice(0, 14);
  const parts = [c.slice(0, 2), c.slice(2, 5), c.slice(5, 8), c.slice(8, 12), c.slice(12, 14)];
  let out = parts[0] ?? "";
  if (parts[1]) out += `.${parts[1]}`;
  if (parts[2]) out += `.${parts[2]}`;
  if (parts[3]) out += `/${parts[3]}`;
  if (parts[4]) out += `-${parts[4]}`;
  return out;
}

const brazilianStates = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

export function normalizeStateRegistration(value: string): string {
  const upper = value.trim().toUpperCase();
  if (upper === "ISENTO" || upper === "ISENTA") return "ISENTO";
  return upper.replace(/[.\-\/\s]/g, "");
}

/** Returns the normalized payload or the first message to show the user. */
export function validateSignaEndCustomerForm(
  form: SignaEndCustomerForm,
): { ok: true; payload: SignaEndCustomerForm } | { ok: false; error: string } {
  const payload: SignaEndCustomerForm = {
    name: form.name.trim(),
    taxId: normalizeCnpj(form.taxId),
    postalCode: digits(form.postalCode),
    street: form.street.trim(),
    number: form.number.trim(),
    district: form.district.trim(),
    complement: form.complement.trim(),
    city: form.city.trim(),
    state: form.state.trim().toUpperCase(),
    stateRegistration: normalizeStateRegistration(form.stateRegistration ?? ""),
  };
  if (payload.name.length < 2) return { ok: false, error: "Informe o nome ou a razão social." };
  if (!isValidCnpj(payload.taxId)) return { ok: false, error: "CNPJ inválido. Confira os 14 caracteres (números e, no formato novo, letras)." };
  if (payload.postalCode.length !== 8) return { ok: false, error: "Informe um CEP com 8 dígitos." };
  if (!payload.street) return { ok: false, error: "Informe a rua." };
  if (!payload.number) return { ok: false, error: "Informe o número (use S/N se não houver)." };
  if (!payload.district) return { ok: false, error: "Informe o bairro." };
  if (!payload.city) return { ok: false, error: "Informe a cidade." };
  if (!brazilianStates.has(payload.state)) return { ok: false, error: "Informe uma UF válida." };
  if (payload.stateRegistration && payload.stateRegistration !== "ISENTO" && !/^[0-9A-Z]{2,14}$/.test(payload.stateRegistration))
    return { ok: false, error: "Inscrição estadual: informe só números (até 14) ou ISENTO." };
  return { ok: true, payload };
}
