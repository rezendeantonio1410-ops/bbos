import { PrismaClient } from "@prisma/client";
import { seedCoffeeReferences } from "./seed-coffee-references";

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("Coffee reference seed requires DATABASE_URL.");
  }
  const result = await seedCoffeeReferences(prisma, true);
  const company = await prisma.company.findFirst({
    where: { OR: [{ tradeName: "Bispo Coffees" }, { name: "Bispo Coffees" }] },
    select: { id: true },
  });
  if (!company) throw new Error("Coffee reference seed requires the Bispo Coffees company.");
  const [species, cultivars, regions, screens, suppliers] = await Promise.all([
    prisma.coffeeSpecies.count({ where: { companyId: company.id, active: true } }),
    prisma.coffeeVariety.count({ where: { species: { companyId: company.id }, active: true } }),
    prisma.coffeeRegion.count({ where: { companyId: company.id, active: true } }),
    prisma.screenClassification.count({ where: { companyId: company.id, active: true } }),
    prisma.supplier.count({ where: { companyId: company.id, active: true } }),
  ]);
  // The seed owns a baseline of 38 cultivars. Later catalog migrations may
  // intentionally add more, so validation must accept a superset.
  if (species !== 2 || cultivars < 38 || regions !== 24 || screens !== 6 || suppliers < 1) {
    throw new Error(`Coffee reference seed validation failed: species=${species} cultivars=${cultivars} regions=${regions} screens=${screens} suppliers=${suppliers}`);
  }
  console.log(`Coffee reference seed: species=${species} cultivars=${cultivars} regions=${regions} screens=${screens}`);
  console.log(`Staging supplier bootstrap: suppliers=${suppliers}`);
  console.log(`Seed operation result: species=${result.species} cultivars=${result.cultivars} regions=${result.regions} screens=${result.screens} suppliers=${result.suppliers}`);
}

main()
  .catch((error: unknown) => {
    console.error("Coffee reference seed failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
