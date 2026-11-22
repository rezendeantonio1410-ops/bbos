/** Search is confined to the partner-scoped customer list returned by the API. */
export type SignaEndCustomerSearchItem = {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
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
  return customers.filter((customer) =>
    [customer.name, customer.city, customer.state].some(
      (value) => value != null && normalize(value).includes(needle),
    ),
  );
}
