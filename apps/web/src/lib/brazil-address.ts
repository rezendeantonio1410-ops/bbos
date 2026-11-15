export type CepLookupResult = {
  postalCode: string;
  state: string;
  city: string;
  district: string;
  address: string;
  ibgeCityCode?: string;
};

export const brazilianCepDigits = (value: string) =>
  value.replace(/\D/g, "").slice(0, 8);

export const formatBrazilianCep = (value: string) =>
  brazilianCepDigits(value).replace(/(\d{5})(\d)/, "$1-$2");

export const isCompleteBrazilianCep = (value: string) =>
  brazilianCepDigits(value).length === 8;

export async function lookupBrazilianCep(
  value: string,
  signal?: AbortSignal,
): Promise<CepLookupResult | null> {
  const digits = brazilianCepDigits(value);
  if (digits.length !== 8) return null;
  const response = await fetch(`/api/storefront/address/${digits}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("CEP indisponível");
  const data = (await response.json()) as {
    postalCode?: string;
    state?: string;
    city?: string;
    district?: string;
    street?: string;
    ibgeCityCode?: string;
  };
  if (!data.state || !data.city) return null;
  return {
    postalCode: (data.postalCode ?? digits).replace(/\D/g, ""),
    state: data.state,
    city: data.city,
    district: data.district ?? "",
    address: data.street ?? "",
    ibgeCityCode: data.ibgeCityCode,
  };
}
