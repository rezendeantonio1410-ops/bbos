import { PrismaClient } from "@prisma/client";
import { seedCoffeeReferences } from "./seed-coffee-references";

const prisma = new PrismaClient();
seedCoffeeReferences(prisma)
  .then(() => console.log("Cadastros mestres de café verde sincronizados."))
  .finally(() => prisma.$disconnect());
