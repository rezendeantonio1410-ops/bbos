import { Injectable, OnModuleInit } from "@nestjs/common";
import { prisma, seedCoffeeReferences } from "@bbos/database";

@Injectable()
export class CoffeeReferenceBootstrapService implements OnModuleInit {
  async onModuleInit() {
    await seedCoffeeReferences(prisma, true);
    const [species, cultivars, regions, screens, suppliers] = await Promise.all([
      prisma.coffeeSpecies.count({ where: { active: true } }),
      prisma.coffeeVariety.count({ where: { active: true } }),
      prisma.coffeeRegion.count({ where: { active: true } }),
      prisma.screenClassification.count({ where: { active: true } }),
      prisma.supplier.count({ where: { active: true } }),
    ]);
    console.log(`Coffee master data ready: species=${species} cultivars=${cultivars} regions=${regions} screens=${screens} suppliers=${suppliers}`);
  }
}
