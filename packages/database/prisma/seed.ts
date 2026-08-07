import {
  AllocationMethod,
  CostCenterCategory,
  CostNature,
  CostType,
  EventType,
  PrismaClient,
  ProductionStatus,
  SalesOrderStatus,
  UserRole,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.costCalculationSnapshot.deleteMany();
  await prisma.productionResourceUsage.deleteMany();
  await prisma.costEvent.deleteMany();
  await prisma.allocationRule.deleteMany();
  await prisma.allocationPeriod.deleteMany();
  await prisma.productiveResource.deleteMany();
  await prisma.costCenter.deleteMany();
  await prisma.industrialEvent.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.finishedProduct.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productLine.deleteMany();
  await prisma.productionOrder.deleteMany();
  await prisma.blendComponent.deleteMany();
  await prisma.blend.deleteMany();
  await prisma.coffeeLot.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  const company = await prisma.company.create({
    data: {
      name: "Bispo Cafés Especiais Ltda.",
      tradeName: "Bispo Coffees",
      taxId: "12.345.678/0001-90",
    },
  });
  const centers = await Promise.all(
    [
      [
        "IND-TOR",
        "Torrefação",
        CostCenterCategory.INDUSTRIAL,
        AllocationMethod.MACHINE_HOURS,
      ],
      [
        "IND-EMP",
        "Empacotamento",
        CostCenterCategory.INDUSTRIAL,
        AllocationMethod.UNITS_PRODUCED,
      ],
      [
        "IND-CQ",
        "Controle de Qualidade",
        CostCenterCategory.INDUSTRIAL,
        AllocationMethod.KG_PRODUCED,
      ],
      [
        "IND-MAN",
        "Manutenção",
        CostCenterCategory.INDUSTRIAL,
        AllocationMethod.MACHINE_HOURS,
      ],
      [
        "LOG-ARM",
        "Armazém",
        CostCenterCategory.LOGISTICS_INVENTORY,
        AllocationMethod.AREA,
      ],
      [
        "LOG-EXP",
        "Expedição",
        CostCenterCategory.LOGISTICS_INVENTORY,
        AllocationMethod.UNITS_PRODUCED,
      ],
      [
        "LOG-LOG",
        "Logística",
        CostCenterCategory.LOGISTICS_INVENTORY,
        AllocationMethod.KG_PRODUCED,
      ],
      [
        "COR-ADM",
        "Administrativo",
        CostCenterCategory.CORPORATE,
        AllocationMethod.REVENUE,
      ],
      [
        "COR-COM",
        "Comercial",
        CostCenterCategory.CORPORATE,
        AllocationMethod.REVENUE,
      ],
      [
        "COR-FIN",
        "Financeiro",
        CostCenterCategory.CORPORATE,
        AllocationMethod.REVENUE,
      ],
      [
        "COR-TEC",
        "Tecnologia",
        CostCenterCategory.CORPORATE,
        AllocationMethod.REVENUE,
      ],
      [
        "COR-GER",
        "Estrutura Geral",
        CostCenterCategory.CORPORATE,
        AllocationMethod.FIXED_PERCENTAGE,
      ],
    ].map(([code, name, category, allocationMethod]) =>
      prisma.costCenter.create({
        data: {
          companyId: company.id,
          code: code as string,
          name: name as string,
          category: category as CostCenterCategory,
          description: `Centro de custo ${name}`,
          allocationMethod: allocationMethod as AllocationMethod,
        },
      }),
    ),
  );
  const roastingCenter = centers[0]!;
  const roaster = await prisma.productiveResource.create({
    data: {
      companyId: company.id,
      costCenterId: roastingCenter.id,
      code: "TOR-01",
      name: "Torrador principal",
      purchaseValue: 285000,
      residualValue: 28500,
      usefulLifeMonths: 120,
      expectedProductiveHours: 176,
      maintenanceCostEstimate: 2200,
      energyConsumption: 4.8,
      gasConsumption: 3.2,
      otherHourlyCost: 1.85,
    },
  });
  const period = await prisma.allocationPeriod.create({
    data: {
      companyId: company.id,
      code: "2026-08",
      startsAt: new Date("2026-08-01T00:00:00Z"),
      endsAt: new Date("2026-08-31T23:59:59Z"),
    },
  });
  const energyRule = await prisma.allocationRule.create({
    data: {
      companyId: company.id,
      costCenterId: roastingCenter.id,
      periodId: period.id,
      origin: "Conta geral de energia • agosto/2026",
      method: AllocationMethod.MACHINE_HOURS,
      baseAmount: 1480,
      destinations: [{ destination: "OP-2026-0087", base: 7.5 }],
      status: "ACTIVE",
    },
  });
  await prisma.user.create({
    data: {
      companyId: company.id,
      name: "Administrador BBOS",
      email: "admin@bispocoffees.com.br",
      passwordHash: "$demo-not-for-production$",
      role: UserRole.ADMIN,
    },
  });
  const supplier = await prisma.supplier.create({
    data: {
      companyId: company.id,
      name: "Fazenda Boa Esperança",
      city: "Carmo de Minas",
      state: "MG",
    },
  });
  const customer = await prisma.customer.create({
    data: {
      companyId: company.id,
      name: "Empório Central",
      segment: "Varejo premium",
    },
  });
  const greenWarehouse = await prisma.warehouse.create({
    data: {
      companyId: company.id,
      name: "Armazém Café Verde",
      code: "ACV",
      type: "GREEN_COFFEE",
    },
  });
  const finishedWarehouse = await prisma.warehouse.create({
    data: {
      companyId: company.id,
      name: "Estoque Produto Acabado",
      code: "EPA",
      type: "FINISHED_GOODS",
    },
  });
  const lot = await prisma.coffeeLot.create({
    data: {
      companyId: company.id,
      supplierId: supplier.id,
      warehouseId: greenWarehouse.id,
      code: "CV-2026-014",
      origin: "Mantiqueira de Minas",
      harvest: "2026/27",
      variety: "Catuaí Amarelo",
      qualityScore: 86.5,
      initialWeightKg: 4800,
      currentWeightKg: 3260,
      purchaseCost: 128640,
      landedCost: 134880,
      status: "APPROVED",
    },
  });
  const lot2 = await prisma.coffeeLot.create({
    data: {
      companyId: company.id,
      supplierId: supplier.id,
      warehouseId: greenWarehouse.id,
      code: "CV-2026-018",
      origin: "Sul de Minas",
      harvest: "2026/27",
      variety: "Bourbon Amarelo",
      qualityScore: 84.75,
      initialWeightKg: 3600,
      currentWeightKg: 2940,
      purchaseCost: 88920,
      landedCost: 93600,
      status: "APPROVED",
    },
  });
  const blend = await prisma.blend.create({
    data: {
      companyId: company.id,
      name: "Bispo Essencial",
      code: "BLE-ESS",
      components: {
        create: [
          { coffeeLotId: lot.id, percentage: 65 },
          { coffeeLotId: lot2.id, percentage: 35 },
        ],
      },
    },
  });
  const order = await prisma.productionOrder.create({
    data: {
      companyId: company.id,
      blendId: blend.id,
      code: "OP-2026-0087",
      status: ProductionStatus.COMPLETED,
      plannedWeightKg: 1200,
      actualInputKg: 1200,
      actualOutputKg: 1014,
      plannedAt: new Date("2026-08-03T09:00:00Z"),
      startedAt: new Date("2026-08-03T10:00:00Z"),
      completedAt: new Date("2026-08-03T17:30:00Z"),
    },
  });
  await prisma.productionResourceUsage.create({
    data: {
      productionOrderId: order.id,
      resourceId: roaster.id,
      machineHours: 7.5,
      laborHours: 8,
      measuredGas: 24.3,
    },
  });
  const product = await prisma.finishedProduct.create({
    data: {
      companyId: company.id,
      blendId: blend.id,
      productionOrderId: order.id,
      warehouseId: finishedWarehouse.id,
      sku: "BC-ESS-500",
      name: "Bispo Essencial 500g",
      packageWeightG: 500,
      quantityOnHand: 1728,
      standardPrice: 49.9,
    },
  });
  const sale = await prisma.salesOrder.create({
    data: {
      companyId: company.id,
      customerId: customer.id,
      finishedProductId: product.id,
      code: "PV-2026-0321",
      status: SalesOrderStatus.CONFIRMED,
      quantity: 240,
      unitPrice: 39.9,
      totalAmount: 9576,
    },
  });
  await prisma.industrialEvent.createMany({
    data: [
      {
        companyId: company.id,
        productionOrderId: order.id,
        coffeeLotId: lot.id,
        type: EventType.ROAST,
        quantityKg: 780,
        occurredAt: new Date("2026-08-03T12:00:00Z"),
      },
      {
        companyId: company.id,
        productionOrderId: order.id,
        type: EventType.PACK,
        quantityKg: 864,
        occurredAt: new Date("2026-08-03T16:00:00Z"),
      },
    ],
  });
  await prisma.costEvent.createMany({
    data: [
      {
        companyId: company.id,
        coffeeLotId: lot.id,
        type: CostType.RAW_MATERIAL,
        amount: 134880,
        quantityBasis: 4800,
        description: "Custo posto na indústria — lote CV-2026-014",
      },
      {
        companyId: company.id,
        productionOrderId: order.id,
        costCenterId: roastingCenter.id,
        allocationRuleId: energyRule.id,
        nature: CostNature.INDIRECT_INDUSTRIAL,
        type: CostType.ENERGY,
        amount: 1480,
        quantityBasis: 1014,
        description: "Energia da torra OP-2026-0087",
      },
      {
        companyId: company.id,
        productionOrderId: order.id,
        finishedProductId: product.id,
        type: CostType.PACKAGING,
        amount: 4233.6,
        quantityBasis: 1728,
        description: "Embalagens e válvulas",
      },
      {
        companyId: company.id,
        salesOrderId: sale.id,
        finishedProductId: product.id,
        type: CostType.TAX,
        amount: 862,
        description: "Impostos estimados PV-2026-0321",
      },
    ],
  });
  await prisma.costCalculationSnapshot.create({
    data: {
      companyId: company.id,
      productionOrderId: order.id,
      periodCode: "2026-08",
      directCost: 24220,
      industrialCost: 28140,
      corporateAllocation: 1850,
      absorbedCost: 29990,
      costPerUnit: 17.3553,
      costPerKg: 27.7515,
      composition: {
        rawMaterial: 21840,
        packaging: 1430,
        directLabor: 950,
        energy: 1480,
        gas: 620,
        depreciation: 490,
        maintenance: 380,
        otherIndustrial: 280,
        corporate: 1850,
      },
      sourceIds: ["CV-2026-014", "OP-2026-0087", "IND-TOR", "2026-08"],
    },
  });
  console.log("Seed industrial criado para Bispo Coffees.");
}

main().finally(() => prisma.$disconnect());
