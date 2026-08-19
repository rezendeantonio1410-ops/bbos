/**
 * Official IBGE municipality identifiers used by the address selectors.
 * The catalog is intentionally data-only so it can be expanded from the
 * IBGE reference file without changing the API contract.
 */
export type BrazilianMunicipality = { ibgeCode: string; name: string; state: string };

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
