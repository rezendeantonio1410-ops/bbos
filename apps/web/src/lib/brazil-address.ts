export type CepLookupResult = {
  postalCode: string;
  state: string;
  city: string;
  district: string;
  address: string;
  ibgeCityCode?: string;
};

export async function lookupBrazilianCep(
  value: string,
): Promise<CepLookupResult | null> {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("CEP indisponível");
  const data = (await response.json()) as {
    erro?: boolean;
    cep?: string;
    uf?: string;
    localidade?: string;
    bairro?: string;
    logradouro?: string;
    ibge?: string;
  };
  if (data.erro || !data.uf || !data.localidade) return null;
  return {
    postalCode: (data.cep ?? digits).replace(/\D/g, ""),
    state: data.uf,
    city: data.localidade,
    district: data.bairro ?? "",
    address: data.logradouro ?? "",
    ibgeCityCode: data.ibge,
  };
}
