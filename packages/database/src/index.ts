import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export * from '@prisma/client';
import * as seedModule from "../prisma/seed-coffee-references.js";

export const seedCoffeeReferences = seedModule.seedCoffeeReferences;
export type CoffeeReferenceSeedResult = { species: number; cultivars: number; regions: number; screens: number; suppliers: number };
