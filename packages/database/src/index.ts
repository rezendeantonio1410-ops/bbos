import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export * from '@prisma/client';
export { seedCoffeeReferences } from "../prisma/seed-coffee-references.js";
export type { CoffeeReferenceSeedResult } from "../prisma/seed-coffee-references.js";
