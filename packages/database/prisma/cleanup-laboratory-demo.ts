import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const LAB_DEMO_TAX_ID = "DEMO-BBOS-LAB-2026";

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.BBOS_ALLOW_DEMO_SEED !== "1")
    throw new Error("Limpeza DEMO bloqueada. Use exclusivamente seed:lab-demo:cleanup em ambiente DEV.");
  const company = await prisma.company.findUnique({ where: { taxId: LAB_DEMO_TAX_ID }, select: { id: true, name: true } });
  if (!company) return console.log("Nenhum dado DEMO do Laboratório encontrado.");
  if (!company.name.startsWith("DEMO -")) throw new Error("Proteção acionada: a empresa alvo não está identificada como DEMO.");
  await prisma.company.delete({ where: { id: company.id } });
  console.log("Dados DEMO do Laboratório removidos com segurança.");
}

main().finally(() => prisma.$disconnect());
