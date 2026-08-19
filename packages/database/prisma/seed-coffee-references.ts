import { PrismaClient } from "@prisma/client";

type Reference = { code: string; name: string; breeder?: string; sortOrder: number };

const SPECIES = [
  { code: "ARABICA", name: "Arábica — Coffea arabica" },
  { code: "CANEPHORA", name: "Robusta/Conilon — Coffea canephora" },
] as const;

const ARABICA: Reference[] = [
  ["IAPAR_59", "IAPAR 59", "IDR-Paraná / IAPAR"], ["IPR_98", "IPR 98", "IDR-Paraná"],
  ["IPR_99", "IPR 99", "IDR-Paraná"], ["IPR_100", "IPR 100", "IDR-Paraná"],
  ["IPR_102", "IPR 102", "IDR-Paraná"], ["IPR_103", "IPR 103", "IDR-Paraná"],
  ["IPR_106", "IPR 106", "IDR-Paraná"], ["IPR_107", "IPR 107", "IDR-Paraná"],
  ["CATUAI_VERMELHO", "Catuaí Vermelho", "IAC"], ["CATUAI_AMARELO", "Catuaí Amarelo", "IAC"],
  ["MUNDO_NOVO", "Mundo Novo", "IAC"], ["ACAIA", "Acaiá", "IAC"],
  ["BOURBON_AMARELO", "Bourbon Amarelo", "IAC"], ["BOURBON_VERMELHO", "Bourbon Vermelho", "IAC"],
  ["ICATU_VERMELHO", "Icatu Vermelho", "IAC"], ["ICATU_AMARELO", "Icatu Amarelo", "IAC"],
  ["ICATU_PRECOCE", "Icatu Precoce", "IAC"], ["OBATA_IAC_1669_20", "Obatã IAC 1669-20", "IAC"],
  ["TUPI_IAC_1669_33", "Tupi IAC 1669-33", "IAC"], ["OURO_VERDE_IAC", "Ouro Verde IAC", "IAC"],
  ["IAC_125_RN", "IAC 125 RN", "IAC"], ["CATUAI_SH3", "Catuaí SH3", "IAC"],
  ["ARARA", "Arara", "Pesquisa brasileira"], ["ACAUA", "Acauã", "Pesquisa brasileira"],
  ["CATUCAI_AMARELO", "Catucaí Amarelo", "Pesquisa brasileira"], ["CATUCAI_VERMELHO", "Catucaí Vermelho", "Pesquisa brasileira"],
  ["CATUCAI_785_15", "Catucaí 785/15", "Pesquisa brasileira"], ["JAPY", "Japy", "Pesquisa brasileira"],
].map((row, index): Reference => ({ code: row[0]!, name: row[1]!, breeder: row[2]!, sortOrder: index + 1 }));

const CANEPHORA: Reference[] = [
  ["CONILON_GENERICO", "Conilon genérico", "Referência comercial"], ["VITORIA_INCAPER_8142", "Vitória Incaper 8142", "Incaper"],
  ["DIAMANTE_ES8112", "Diamante ES8112", "Incaper"], ["JEQUITIBA_ES8122", "Jequitibá ES8122", "Incaper"],
  ["CENTENARIA_ES8132", "Centenária ES8132", "Incaper"], ["MARILANDIA_ES8143", "Marilândia ES8143", "Incaper"],
  ["EMCAPA_8111", "Emcapa 8111", "Incaper"], ["EMCAPA_8121", "Emcapa 8121", "Incaper"],
  ["EMCAPA_8131", "Emcapa 8131", "Incaper"], ["ROBUSTAO_CAPIXABA", "Robustão Capixaba / Emcapa 8141", "Incaper"],
].map((row, index): Reference => ({ code: row[0]!, name: row[1]!, breeder: row[2]!, sortOrder: index + 1 }));

const REGIONS: Array<[string, string[]]> = [
  ["PR", ["Norte Pioneiro do Paraná", "Norte Novo", "Centro-Norte", "Noroeste", "Mandaguari", "Serra de Apucarana"]],
  ["SP", ["Alta Mogiana", "Mogiana", "Média Mogiana", "Circuito das Águas Paulista", "Região de Pinhal", "Região de Piraju", "Alta Paulista"]],
  ["MG", ["Cerrado Mineiro", "Sul de Minas", "Mantiqueira de Minas", "Matas de Minas", "Campo das Vertentes", "Chapada de Minas", "Norte de Minas"]],
  ["ES", ["Noroeste", "Nordeste", "Centro Serrana", "Sul/Caparaó"]],
];

const SCREENS = [
  ["17_18", "17/18"], ["16_18", "16/18"], ["14_16", "14/16"],
  ["MOKA_10", "Moka 10"], ["GRINDERS", "Grinders"], ["BICA_CORRIDA", "Bica Corrida"],
] as const;

export type CoffeeReferenceSeedResult = { species: number; cultivars: number; regions: number; screens: number; suppliers: number };

export async function seedCoffeeReferences(client: PrismaClient, includeStagingSupplier = process.env.BBOS_STAGING_REFERENCE_SEED === "true"): Promise<CoffeeReferenceSeedResult> {
  const companies = await client.company.findMany({ select: { id: true } });
  const result: CoffeeReferenceSeedResult = { species: 0, cultivars: 0, regions: 0, screens: 0, suppliers: 0 };
  for (const company of companies) {
    const speciesByCode = new Map<string, string>();
    for (const species of SPECIES) {
      const row = await client.coffeeSpecies.upsert({
        where: { companyId_code: { companyId: company.id, code: species.code } },
        update: { name: species.name, active: true },
        create: { companyId: company.id, code: species.code, name: species.name },
      });
      speciesByCode.set(species.code, row.id);
      result.species += 1;
    }
    for (const [speciesCode, rows] of [["ARABICA", ARABICA], ["CANEPHORA", CANEPHORA]] as const) {
      const speciesId = speciesByCode.get(speciesCode);
      if (!speciesId) continue;
      for (const row of rows) {
        await client.coffeeVariety.upsert({
          where: { speciesId_code: { speciesId, code: row.code } },
          update: { name: row.name, breeder: row.breeder, sortOrder: row.sortOrder, active: true },
          create: { speciesId, code: row.code, name: row.name, breeder: row.breeder, sortOrder: row.sortOrder },
        });
        result.cultivars += 1;
      }
    }
    for (const [state, names] of REGIONS) {
      for (const [index, name] of names.entries()) {
        await client.coffeeRegion.upsert({
          where: { companyId_state_name: { companyId: company.id, state, name } },
          update: { active: true, sortOrder: index + 1 },
          create: { companyId: company.id, state, name, sortOrder: index + 1 },
        });
        result.regions += 1;
      }
    }
    for (const [index, [code, name]] of SCREENS.entries()) {
      await client.screenClassification.upsert({
        where: { companyId_code: { companyId: company.id, code } },
        update: { name, active: true, sortOrder: index + 1 },
        create: { companyId: company.id, code, name, sortOrder: index + 1 },
      });
      result.screens += 1;
    }
    if (includeStagingSupplier) {
      const existingSupplier = await client.supplier.findFirst({ where: { companyId: company.id, name: "Produtor Teste BBOS", active: true }, select: { id: true } });
      if (existingSupplier) {
        result.suppliers += 1;
      } else {
        await client.supplier.create({ data: { companyId: company.id, name: "Produtor Teste BBOS", city: "Londrina", state: "PR", country: "Brasil", supplierType: "RURAL_PERSON", active: true } });
        result.suppliers += 1;
      }
    }
  }
  return result;
}
