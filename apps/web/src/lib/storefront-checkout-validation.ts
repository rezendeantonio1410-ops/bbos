/**
 * Checkout data rules for the online store. Stricter than the server minimum
 * because incomplete addresses (no number, no phone) already caused failed
 * deliveries. Pure functions so they can be tested without a browser.
 */
const digits = (value: string) => value.replace(/\D/g, "");

/** Valid Brazilian area codes (ANATEL). */
const DDD = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export type CheckoutFields = {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

export type CheckoutErrors = Partial<Record<keyof CheckoutFields, string>>;

export const NO_NUMBER = "S/N";

const UF = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

export function validFullName(name: string) {
  const words = name.trim().split(/\s+/).filter((word) => /\p{L}{2,}/u.test(word));
  return words.length >= 2;
}

/** Mobile with valid DDD: 11 digits, third digit 9, not all repeated. */
export function validMobile(phone: string) {
  const value = digits(phone);
  if (value.length !== 11) return false;
  if (!DDD.has(Number(value.slice(0, 2)))) return false;
  if (value[2] !== "9") return false;
  return !/^(\d)\1+$/.test(value.slice(2));
}

export function validCpf(value: string) {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const check = (size: number) => {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(cpf[i]) * (size + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(cpf[9]) && check(10) === Number(cpf[10]);
}

/** House number: digits with optional letter/complement ("12", "12A", "1200-B") or S/N. */
export function validHouseNumber(number: string) {
  const value = number.trim().toUpperCase();
  if (value === NO_NUMBER) return true;
  return /^\d{1,6}[A-Z]?(?:[-\s]?[A-Z0-9]{1,4})?$/.test(value);
}

export function checkoutErrors(fields: CheckoutFields): CheckoutErrors {
  const errors: CheckoutErrors = {};
  if (!validFullName(fields.name)) errors.name = "Escreva nome e sobrenome de quem recebe.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fields.email.trim())) errors.email = "Confira o e-mail.";
  if (!validMobile(fields.phone)) errors.phone = "Informe um celular com DDD, por exemplo (43) 99999-9999.";
  if (!validCpf(fields.cpf)) errors.cpf = "Confira o CPF.";
  if (digits(fields.postalCode).length !== 8) errors.postalCode = "CEP inválido.";
  if (fields.street.trim().length < 3) errors.street = "Informe a rua.";
  if (!fields.number.trim()) errors.number = "Informe o número ou marque “Sem número”.";
  else if (!validHouseNumber(fields.number)) errors.number = "Use só o número da casa (ex.: 120 ou 120A). Apartamento vai no complemento.";
  if (fields.district.trim().length < 2) errors.district = "Informe o bairro.";
  if (fields.city.trim().length < 2) errors.city = "Informe a cidade.";
  if (!UF.has(fields.state.trim().toUpperCase())) errors.state = "UF inválida.";
  return errors;
}

/** One line the customer can check before paying. */
export function deliverySummary(fields: CheckoutFields) {
  const cep = digits(fields.postalCode);
  const street = [fields.street.trim(), fields.number.trim()].filter(Boolean).join(", ");
  const line1 = [street, fields.complement.trim()].filter(Boolean).join(" – ");
  const line2 = [fields.district.trim(), `${fields.city.trim()}/${fields.state.trim().toUpperCase()}`].filter(Boolean).join(" · ");
  return { line1, line2, cep: cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep };
}

/** Free shipping applies only to the South and Southeast (CEP ranges). */
export function freeShippingRegion(postalCode: string) {
  const cep = digits(postalCode);
  if (cep.length < 5) return null;
  const prefix = Number(cep.slice(0, 5));
  const southeast = prefix >= 1000 && prefix <= 39999; // SP, RJ, ES, MG
  const south = prefix >= 80000 && prefix <= 99999; // PR, SC, RS
  return southeast || south;
}
