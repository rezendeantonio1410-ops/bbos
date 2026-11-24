import { normalizeCnpj } from "@bbos/shared";
/** Search is confined to the partner-scoped customer list returned by the API. */
export type SignaEndCustomerSearchItem = {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  taxId?: string | null;
};

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

export function searchSignaEndCustomers<T extends SignaEndCustomerSearchItem>(
  customers: readonly T[],
  query: string,
): T[] {
  const needle = normalize(query);
  if (!needle) return [...customers];
  const needleDigits = normalizeCnpj(query);
  return customers.filter((customer) =>
    [customer.name, customer.city, customer.state].some(
      (value) => value != null && normalize(value).includes(needle),
    ) ||
    // CNPJ search accepts masked or unmasked input (at least 4 characters),
    // including the letters of the new alphanumeric format.
    (needleDigits.length >= 4 && /\d/.test(needleDigits) &&
      needleDigits === query.toUpperCase().replace(/[.\/\-\s]/g, "") &&
      normalizeCnpj(customer.taxId).includes(needleDigits)),
  );
}
