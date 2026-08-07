import {
  AllocationMethod,
  CostCenterCategory,
  PrismaClient,
} from "@prisma/client";

const centers = [
  ["IND-TOR", "Torrefação", CostCenterCategory.INDUSTRIAL, AllocationMethod.MACHINE_HOURS],
  ["IND-EMP", "Empacotamento", CostCenterCategory.INDUSTRIAL, AllocationMethod.UNITS_PRODUCED],
  ["IND-CQ", "Controle de Qualidade", CostCenterCategory.INDUSTRIAL, AllocationMethod.KG_PRODUCED],
  ["IND-MAN", "Manutenção", CostCenterCategory.INDUSTRIAL, AllocationMethod.MACHINE_HOURS],
  ["LOG-ARM", "Armazém", CostCenterCategory.LOGISTICS_INVENTORY, AllocationMethod.AREA],
  ["LOG-EXP", "Expedição", CostCenterCategory.LOGISTICS_INVENTORY, AllocationMethod.UNITS_PRODUCED],
  ["LOG-LOG", "Logística", CostCenterCategory.LOGISTICS_INVENTORY, AllocationMethod.KG_PRODUCED],
  ["COR-ADM", "Administrativo", CostCenterCategory.CORPORATE, AllocationMethod.REVENUE],
  ["COR-COM", "Comercial", CostCenterCategory.CORPORATE, AllocationMethod.REVENUE],
  ["COR-FIN", "Financeiro", CostCenterCategory.CORPORATE, AllocationMethod.REVENUE],
  ["COR-TEC", "Tecnologia", CostCenterCategory.CORPORATE, AllocationMethod.REVENUE],
  ["COR-GER", "Estrutura Geral", CostCenterCategory.CORPORATE, AllocationMethod.FIXED_PERCENTAGE],
] as const;

const resources = [
  ["TOR-01", "Torrador", "IND-TOR"],
  ["EMP-01", "Empacotadora", "IND-EMP"],
  ["SEL-01", "Seladora", "IND-EMP"],
  ["DOS-01", "Dosadora", "IND-EMP"],
  ["MOI-01", "Moinho", "IND-TOR"],
  ["OUT-01", "Outros equipamentos", "IND-MAN"],
] as const;

export async function seedCostEngine(prisma: PrismaClient) {
  const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
  if (!company) throw new Error("Cadastre uma empresa antes dos centros de custo.");
  const persisted = new Map<string, string>();
  for (const [code, name, category, allocationMethod] of centers) {
    const center = await prisma.costCenter.upsert({
      where: { companyId_code: { companyId: company.id, code } },
      update: { name, category, allocationMethod, active: true },
      create: {
        companyId: company.id,
        code,
        name,
        category,
        allocationMethod,
        description: `Centro de custo ${name}`,
        monthlyBudget: 0,
      },
    });
    persisted.set(code, center.id);
  }
  for (const [code, name, centerCode] of resources) {
    await prisma.productiveResource.upsert({
      where: { companyId_code: { companyId: company.id, code } },
      update: { name, costCenterId: persisted.get(centerCode)!, active: true },
      create: {
        companyId: company.id,
        costCenterId: persisted.get(centerCode)!,
        code,
        name,
        purchaseValue: 0,
        residualValue: 0,
        usefulLifeMonths: 120,
        expectedProductiveHours: 176,
        maintenanceCostEstimate: 0,
        energyConsumption: 0,
        energyRatePerKwh: 0,
        gasConsumption: 0,
        gasRatePerUnit: 0,
      },
    });
  }
  return { companyId: company.id, centers: centers.length, resources: resources.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const prisma = new PrismaClient();
  seedCostEngine(prisma)
    .then((result) => console.log(JSON.stringify(result)))
    .finally(() => prisma.$disconnect());
}
