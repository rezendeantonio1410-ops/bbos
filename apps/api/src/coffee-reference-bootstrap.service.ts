import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient, GreenCoffeeSupplierType } from "@bbos/database";

type CultivarDefinition = [code: string, name: string, breeder: string];

const SPECIES = [
  ["ARABICA", "Arábica — Coffea arabica"],
  ["CANEPHORA", "Robusta/Conilon — Coffea canephora"],
] as const;

const ARABICA: CultivarDefinition[] = [
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
];

const CANEPHORA: CultivarDefinition[] = [
  ["CONILON_GENERICO", "Conilon genérico", "Referência comercial"], ["VITORIA_INCAPER_8142", "Vitória Incaper 8142", "Incaper"],
  ["DIAMANTE_ES8112", "Diamante ES8112", "Incaper"], ["JEQUITIBA_ES8122", "Jequitibá ES8122", "Incaper"],
  ["CENTENARIA_ES8132", "Centenária ES8132", "Incaper"], ["MARILANDIA_ES8143", "Marilândia ES8143", "Incaper"],
  ["EMCAPA_8111", "Emcapa 8111", "Incaper"], ["EMCAPA_8121", "Emcapa 8121", "Incaper"],
  ["EMCAPA_8131", "Emcapa 8131", "Incaper"], ["ROBUSTAO_CAPIXABA", "Robustão Capixaba / Emcapa 8141", "Incaper"],
];

const REGIONS: Array<[string, string[]]> = [
  ["PR", ["Norte Pioneiro do Paraná", "Norte Novo", "Centro-Norte", "Noroeste", "Mandaguari", "Serra de Apucarana"]],
  ["SP", ["Alta Mogiana", "Mogiana", "Média Mogiana", "Circuito das Águas Paulista", "Região de Pinhal", "Região de Piraju", "Alta Paulista"]],
  ["MG", ["Cerrado Mineiro", "Sul de Minas", "Mantiqueira de Minas", "Matas de Minas", "Campo das Vertentes", "Chapada de Minas", "Norte de Minas"]],
  ["ES", ["Noroeste", "Nordeste", "Centro Serrana", "Sul/Caparaó"]],
];

const SCREENS = [["17_18", "17/18"], ["16_18", "16/18"], ["14_16", "14/16"], ["MOKA_10", "Moka 10"], ["GRINDERS", "Grinders"], ["BICA_CORRIDA", "Bica Corrida"]] as const;

@Injectable()
export class CoffeeReferenceBootstrapService implements OnModuleInit {
  private readonly database = new PrismaClient();

  async onModuleInit() {
    const companies = await this.database.company.findMany({ select: { id: true } });
    for (const company of companies) await this.bootstrapCompany(company.id);
    const [species, cultivars, regions, screens, suppliers] = await Promise.all([
      this.database.coffeeSpecies.count({ where: { active: true } }),
      this.database.coffeeVariety.count({ where: { active: true } }),
      this.database.coffeeRegion.count({ where: { active: true } }),
      this.database.screenClassification.count({ where: { active: true } }),
      this.database.supplier.count({ where: { active: true } }),
    ]);
    console.log(`Coffee master data ready: species=${species} cultivars=${cultivars} regions=${regions} screens=${screens} suppliers=${suppliers}`);
  }

  private async bootstrapCompany(companyId: string) {
    await this.database.$transaction(async (transaction) => {
      const speciesByCode = new Map<string, string>();
      for (const [code, name] of SPECIES) {
        const species = await transaction.coffeeSpecies.upsert({
          where: { companyId_code: { companyId, code } },
          update: { name, active: true },
          create: { companyId, code, name },
        });
        speciesByCode.set(code, species.id);
      }
      for (const [speciesCode, definitions] of [["ARABICA", ARABICA], ["CANEPHORA", CANEPHORA]] as const) {
        const speciesId = speciesByCode.get(speciesCode);
        if (!speciesId) throw new Error(`Coffee reference bootstrap: species ${speciesCode} was not created.`);
        for (const [index, [code, name, breeder]] of definitions.entries()) {
          await transaction.coffeeVariety.upsert({
            where: { speciesId_code: { speciesId, code } },
            update: { name, breeder, sortOrder: index + 1, active: true },
            create: { speciesId, code, name, breeder, sortOrder: index + 1 },
          });
        }
      }
      for (const [state, names] of REGIONS) {
        for (const [index, name] of names.entries()) {
          await transaction.coffeeRegion.upsert({
            where: { companyId_state_name: { companyId, state, name } },
            update: { active: true, sortOrder: index + 1 },
            create: { companyId, state, name, sortOrder: index + 1 },
          });
        }
      }
      for (const [index, [code, name]] of SCREENS.entries()) {
        await transaction.screenClassification.upsert({
          where: { companyId_code: { companyId, code } },
          update: { name, active: true, sortOrder: index + 1 },
          create: { companyId, code, name, sortOrder: index + 1 },
        });
      }
      const activeSupplier = await transaction.supplier.findFirst({ where: { companyId, active: true }, select: { id: true } });
      if (!activeSupplier) {
        await transaction.supplier.create({
          data: {
            companyId,
            name: "Produtor Teste BBOS",
            city: "Londrina",
            state: "PR",
            country: "Brasil",
            supplierType: GreenCoffeeSupplierType.RURAL_PERSON,
            active: true,
          },
        });
      }
    });
  }
}
