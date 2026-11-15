const validDDDs = new Set(
  "11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99".split(
    " ",
  ),
);
export const MOBILE_ERROR = "Informe um celular válido com DDD.";
export function brazilMobileDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  return value.trim().startsWith("+55") ||
    (digits.length >= 13 && digits.startsWith("55"))
    ? digits.slice(2)
    : digits;
}
export function normalizeCustomerPhone(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.startsWith("+") && !text.startsWith("+55")) {
    const international = text.replace(/[\s().-]/g, "");
    if (!/^\+[1-9]\d{7,14}$/.test(international)) throw new Error(MOBILE_ERROR);
    return international;
  }
  if (!/^[+\d\s().-]+$/.test(text)) throw new Error(MOBILE_ERROR);
  const digits = brazilMobileDigits(text);
  if (!/^\d{2}9\d{8}$/.test(digits) || !validDDDs.has(digits.slice(0, 2)))
    throw new Error(MOBILE_ERROR);
  return `+55${digits}`;
}
export function formatBrazilMobile(value: string): string {
  const digits = brazilMobileDigits(value);
  if (digits.length > 11) return digits; // Preserve malformed existing data for correction.
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}${digits.length > 7 ? "-" + digits.slice(7) : ""}`;
}
