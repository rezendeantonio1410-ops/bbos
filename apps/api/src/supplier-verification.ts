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
  const digits = onlyDigits(value);
  if (digits.length !== 14 || /^([0-9])\1+$/.test(digits)) return false;
  const calculate = (length: number) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce(
      (total, weight, index) => total + Number(digits[index]) * weight,
      0,
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return (
    calculate(12) === Number(digits[12]) && calculate(13) === Number(digits[13])
  );
}

export function validateTaxId(value?: string | null): "CPF" | "CNPJ" | null {
  if (!value?.trim()) return null;
  const digits = onlyDigits(value);
  if (digits.length === 11 && isValidCpf(digits)) return "CPF";
  if (digits.length === 14 && isValidCnpj(digits)) return "CNPJ";
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
