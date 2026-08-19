import { PrismaClient } from "@prisma/client";
import { seedCoffeeReferences } from "./seed-coffee-references";

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("Coffee reference seed requires DATABASE_URL.");
  }
  const result = await seedCoffeeReferences(prisma, true);
  console.log(`Coffee reference seed: species=${result.species} cultivars=${result.cultivars} regions=${result.regions} screens=${result.screens}`);
  const count = await prisma.supplier.count({ where: { name: "Produtor Teste BBOS", active: true } });
  console.log(`Staging supplier bootstrap: suppliers=${count}`);
}

main()
  .catch((error: unknown) => {
    console.error("Coffee reference seed failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
