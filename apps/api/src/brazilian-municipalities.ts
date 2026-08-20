/**
 * Official IBGE municipality identifiers used by the address selectors.
 * The catalog is intentionally data-only so it can be expanded from the
 * IBGE reference file without changing the API contract.
 */
export type BrazilianMunicipality = {
  ibgeCode: string;
  name: string;
  state: string;
  stateIbgeCode?: string;
};

const STATE_IBGE_CODES: Record<string, string> = {
  AC: "12",
  AL: "27",
  AP: "16",
  AM: "13",
  BA: "29",
  CE: "23",
  DF: "53",
  ES: "32",
  GO: "52",
  MA: "21",
  MT: "51",
  MS: "50",
  MG: "31",
  PA: "15",
  PB: "25",
  PR: "41",
  PE: "26",
  PI: "22",
  RJ: "33",
  RN: "24",
  RS: "43",
  RO: "11",
  RR: "14",
  SC: "42",
  SP: "35",
  SE: "28",
  TO: "17",
};
const cache = new Map<string, BrazilianMunicipality[]>();

export async function getBrazilianMunicipalities(
  state?: string,
): Promise<BrazilianMunicipality[]> {
  if (!state) return BRAZILIAN_MUNICIPALITIES;
  const cached = cache.get(state);
  if (cached) return cached;
  try {
    const response = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state}/municipios`,
      { headers: { Accept: "application/json" } },
    );
    if (response.ok) {
      const rows = (await response.json()) as Array<{
        id: number;
        nome: string;
      }>;
      const municipalities = rows.map((row) => ({
        ibgeCode: String(row.id),
        name: row.nome,
        state,
        stateIbgeCode: STATE_IBGE_CODES[state],
      }));
      cache.set(state, municipalities);
      return municipalities;
    }
  } catch {
    // Fall back to the versioned subset when IBGE is temporarily unavailable.
  }
  return BRAZILIAN_MUNICIPALITIES.filter(
    (municipality) => municipality.state === state,
  );
}

export const BRAZILIAN_MUNICIPALITIES: BrazilianMunicipality[] = [
  { ibgeCode: "4113700", name: "Londrina", state: "PR" },
  { ibgeCode: "4106902", name: "Curitiba", state: "PR" },
  { ibgeCode: "4104808", name: "Cascavel", state: "PR" },
  { ibgeCode: "4115200", name: "Maringá", state: "PR" },
  { ibgeCode: "4125506", name: "São José dos Pinhais", state: "PR" },
  { ibgeCode: "3550308", name: "São Paulo", state: "SP" },
  { ibgeCode: "3509502", name: "Campinas", state: "SP" },
  { ibgeCode: "3543402", name: "Ribeirão Preto", state: "SP" },
  { ibgeCode: "3505708", name: "Barretos", state: "SP" },
  { ibgeCode: "3106200", name: "Belo Horizonte", state: "MG" },
  { ibgeCode: "3170206", name: "Uberlândia", state: "MG" },
  { ibgeCode: "3118601", name: "Contagem", state: "MG" },
  { ibgeCode: "3169307", name: "Três Corações", state: "MG" },
  { ibgeCode: "3205309", name: "Vitória", state: "ES" },
  { ibgeCode: "3201209", name: "Cachoeiro de Itapemirim", state: "ES" },
  { ibgeCode: "3203205", name: "Linhares", state: "ES" },
  { ibgeCode: "3205001", name: "Serra", state: "ES" },
  { ibgeCode: "2927408", name: "Salvador", state: "BA" },
  { ibgeCode: "2903201", name: "Barreiras", state: "BA" },
  { ibgeCode: "3304557", name: "Rio de Janeiro", state: "RJ" },
  { ibgeCode: "3301702", name: "Duque de Caxias", state: "RJ" },
  { ibgeCode: "1100205", name: "Porto Velho", state: "RO" },
  { ibgeCode: "5208707", name: "Goiânia", state: "GO" },
  { ibgeCode: "5201108", name: "Anápolis", state: "GO" },
];
