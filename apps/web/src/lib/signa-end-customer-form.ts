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
  const cnpj = digits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const check = (length: number) => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(cnpj[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return check(12) === Number(cnpj[12]) && check(13) === Number(cnpj[13]);
}

export function formatCnpj(value: string): string {
  const d = digits(value).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
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
    taxId: digits(form.taxId),
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
  if (!isValidCnpj(payload.taxId)) return { ok: false, error: "CNPJ inválido. Confira os 14 dígitos." };
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
