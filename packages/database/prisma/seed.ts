import { CostType, EventType, PrismaClient, ProductionStatus, SalesOrderStatus, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.costEvent.deleteMany();
  await prisma.industrialEvent.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.finishedProduct.deleteMany();
  await prisma.productionOrder.deleteMany();
  await prisma.blendComponent.deleteMany();
  await prisma.blend.deleteMany();
  await prisma.coffeeLot.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  const company = await prisma.company.create({ data: { name: 'Bispo Cafés Especiais Ltda.', tradeName: 'Bispo Coffees', taxId: '12.345.678/0001-90' } });
  await prisma.user.create({ data: { companyId: company.id, name: 'Administrador BBOS', email: 'admin@bispocoffees.com.br', passwordHash: '$demo-not-for-production$', role: UserRole.ADMIN } });
  const supplier = await prisma.supplier.create({ data: { companyId: company.id, name: 'Fazenda Boa Esperança', city: 'Carmo de Minas', state: 'MG' } });
  const customer = await prisma.customer.create({ data: { companyId: company.id, name: 'Empório Central', segment: 'Varejo premium' } });
  const greenWarehouse = await prisma.warehouse.create({ data: { companyId: company.id, name: 'Armazém Café Verde', code: 'ACV', type: 'GREEN_COFFEE' } });
  const finishedWarehouse = await prisma.warehouse.create({ data: { companyId: company.id, name: 'Estoque Produto Acabado', code: 'EPA', type: 'FINISHED_GOODS' } });
  const lot = await prisma.coffeeLot.create({ data: { companyId: company.id, supplierId: supplier.id, warehouseId: greenWarehouse.id, code: 'CV-2026-014', origin: 'Mantiqueira de Minas', harvest: '2026/27', variety: 'Catuaí Amarelo', qualityScore: 86.5, initialWeightKg: 4800, currentWeightKg: 3260, purchaseCost: 128640, landedCost: 134880, status: 'APPROVED' } });
  const lot2 = await prisma.coffeeLot.create({ data: { companyId: company.id, supplierId: supplier.id, warehouseId: greenWarehouse.id, code: 'CV-2026-018', origin: 'Sul de Minas', harvest: '2026/27', variety: 'Bourbon Amarelo', qualityScore: 84.75, initialWeightKg: 3600, currentWeightKg: 2940, purchaseCost: 88920, landedCost: 93600, status: 'APPROVED' } });
  const blend = await prisma.blend.create({ data: { companyId: company.id, name: 'Bispo Essencial', code: 'BLE-ESS', components: { create: [{ coffeeLotId: lot.id, percentage: 65 }, { coffeeLotId: lot2.id, percentage: 35 }] } } });
  const order = await prisma.productionOrder.create({ data: { companyId: company.id, blendId: blend.id, code: 'OP-2026-0087', status: ProductionStatus.COMPLETED, plannedWeightKg: 1200, actualInputKg: 1200, actualOutputKg: 1014, plannedAt: new Date('2026-08-03T09:00:00Z'), startedAt: new Date('2026-08-03T10:00:00Z'), completedAt: new Date('2026-08-03T17:30:00Z') } });
  const product = await prisma.finishedProduct.create({ data: { companyId: company.id, blendId: blend.id, productionOrderId: order.id, warehouseId: finishedWarehouse.id, sku: 'BC-ESS-500', name: 'Bispo Essencial 500g', packageWeightG: 500, quantityOnHand: 1728, standardPrice: 49.9 } });
  const sale = await prisma.salesOrder.create({ data: { companyId: company.id, customerId: customer.id, finishedProductId: product.id, code: 'PV-2026-0321', status: SalesOrderStatus.CONFIRMED, quantity: 240, unitPrice: 39.9, totalAmount: 9576 } });
  await prisma.industrialEvent.createMany({ data: [
    { companyId: company.id, productionOrderId: order.id, coffeeLotId: lot.id, type: EventType.ROAST, quantityKg: 780, occurredAt: new Date('2026-08-03T12:00:00Z') },
    { companyId: company.id, productionOrderId: order.id, type: EventType.PACK, quantityKg: 864, occurredAt: new Date('2026-08-03T16:00:00Z') },
  ] });
  await prisma.costEvent.createMany({ data: [
    { companyId: company.id, coffeeLotId: lot.id, type: CostType.RAW_MATERIAL, amount: 134880, quantityBasis: 4800, description: 'Custo posto na indústria — lote CV-2026-014' },
    { companyId: company.id, productionOrderId: order.id, type: CostType.ENERGY, amount: 1480, quantityBasis: 1014, description: 'Energia da torra OP-2026-0087' },
    { companyId: company.id, productionOrderId: order.id, finishedProductId: product.id, type: CostType.PACKAGING, amount: 4233.6, quantityBasis: 1728, description: 'Embalagens e válvulas' },
    { companyId: company.id, salesOrderId: sale.id, finishedProductId: product.id, type: CostType.TAX, amount: 862, description: 'Impostos estimados PV-2026-0321' },
  ] });
  console.log('Seed industrial criado para Bispo Coffees.');
}

main().finally(() => prisma.$disconnect());
