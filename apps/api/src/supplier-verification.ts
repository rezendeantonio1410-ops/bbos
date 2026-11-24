import { isValidCnpj as isValidSharedCnpj, normalizeTaxId } from "@bbos/shared";
export const onlyDigits = (value: string) => value.replace(/\D/g, "");

export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || /^([0-9])\1+$/.test(digits)) return false;
  const check = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1)
      sum += Number(digits[index]) * (length + 1 - index);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

export function isValidCnpj(value: string): boolean {
  // Numeric and alphanumeric (new Receita format) CNPJs.
  return isValidSharedCnpj(value);
}

export function validateTaxId(value?: string | null): "CPF" | "CNPJ" | null {
  if (!value?.trim()) return null;
  const taxId = normalizeTaxId(value);
  if (taxId.length === 11 && isValidCpf(taxId)) return "CPF";
  if (taxId.length === 14 && isValidCnpj(taxId)) return "CNPJ";
  return null;
}

export function validateStateRegistration(
  value: string | null | undefined,
  state: string | null | undefined,
): boolean {
  if (!value?.trim()) return true;
  const digits = onlyDigits(value);
  const expectedLength: Record<string, number> = {
    PR: 10,
    SP: 12,
    MG: 13,
    ES: 9,
  };
  const length = expectedLength[state ?? ""];
  return length
    ? digits.length === length
    : digits.length >= 5 && digits.length <= 14;
}
