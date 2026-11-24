/**
 * CNPJ with letters (Receita Federal, Instrução Normativa RFB nº 2.229/2024):
 * from July 2026 new CNPJs have 12 alphanumeric characters (0-9, A-Z) plus 2
 * numeric check digits. Existing numeric CNPJs stay valid. The check digits
 * use the same modulo-11 weights; each character is worth its ASCII code
 * minus 48 ("0"→0 … "9"→9, "A"→17, "B"→18 … "Z"→42).
 */

const CNPJ_RE = /^[0-9A-Z]{12}[0-9]{2}$/;
const WEIGHTS_12 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const WEIGHTS_13 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Keeps only 0-9 and A-Z, uppercased ("12.abc.345/01de-35" → "12ABC34501DE35"). */
export function normalizeCnpj(value: string | null | undefined) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
}

function checkDigit(chars: string, weights: number[]) {
  const sum = weights.reduce((total, weight, index) => total + (chars.charCodeAt(index) - 48) * weight, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** The two check digits for a 12-character CNPJ base. */
export function cnpjCheckDigits(base: string) {
  const first = checkDigit(base, WEIGHTS_12);
  const second = checkDigit(`${base}${first}`, WEIGHTS_13);
  return `${first}${second}`;
}

export function isValidCnpj(value: string | null | undefined) {
  const cnpj = normalizeCnpj(value);
  if (!CNPJ_RE.test(cnpj)) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  return cnpj.slice(12) === cnpjCheckDigits(cnpj.slice(0, 12));
}

/** True when the CNPJ uses the new format (has at least one letter). */
export function isAlphanumericCnpj(value: string | null | undefined) {
  return /[A-Z]/.test(normalizeCnpj(value));
}

/** "12ABC34501DE35" → "12.ABC.345/01DE-35"; anything else is returned as typed. */
export function formatCnpj(value: string | null | undefined) {
  const cnpj = normalizeCnpj(value);
  if (cnpj.length !== 14) return String(value ?? "");
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

/**
 * Normalizes a CPF or CNPJ typed in one field: letters mean a CNPJ in the new
 * format (kept uppercase); otherwise only the digits are kept.
 */
export function normalizeTaxId(value: string | null | undefined) {
  const text = String(value ?? "");
  return /[a-z]/i.test(text) ? normalizeCnpj(text) : text.replace(/\D/g, "");
}
