import { PrismaClient } from "@prisma/client";
import { seedCoffeeReferences } from "./seed-coffee-references";

const prisma = new PrismaClient();
seedCoffeeReferences(prisma, true)
  .then((result) => console.log(`Coffee reference seed: species=${result.species} cultivars=${result.cultivars} regions=${result.regions} screens=${result.screens}`))
  .then(async () => {
    const count = await prisma.supplier.count({ where: { name: "Produtor Teste BBOS", active: true } });
    console.log(`Staging supplier bootstrap: suppliers=${count}`);
  })
  .finally(() => prisma.$disconnect());
