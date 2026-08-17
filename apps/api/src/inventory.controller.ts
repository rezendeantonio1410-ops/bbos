import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, type OnModuleDestroy } from '@nestjs/common';
import { EventType, FinishedGoodsMovementType, Prisma, PrismaClient } from '@bbos/database';
import { calculateFinishedGoodsBalance, type InventoryMovementType } from '@bbos/shared';

type RegisterMovementBody = {
  type: InventoryMovementType;
  userId: string;
  userName: string;
  quantityKg: number;
  origin: string;
  destination: string;
  reason: string;
  adjustmentDirection?: 'increase' | 'decrease';
  destinationWarehouseId?: string;
};

const movementEventType: Record<InventoryMovementType, EventType> = {
  entry: EventType.RECEIPT,
  exit: EventType.TRANSFER,
  'internal-transfer': EventType.TRANSFER,
  'production-reservation': EventType.ADJUSTMENT,
  'reservation-release': EventType.ADJUSTMENT,
  'inventory-adjustment': EventType.ADJUSTMENT,
};

@Controller('inventory')
export class InventoryController implements OnModuleDestroy {
  private readonly database = new PrismaClient();

  onModuleDestroy() {
    return this.database.$disconnect();
  }

  @Get('finished-goods')
  async listFinishedGoods() {
    const balances = await this.database.finishedProduct.findMany({
      include: {
        productVariant: {
          include: { product: { include: { productLine: true } } },
        },
        warehouse: true,
        finishedGoodsMovements: true,
      },
      orderBy: [{ line: 'asc' }, { name: 'asc' }, { packageWeightG: 'asc' }],
    });
    return balances.map((balance) => this.finishedGoodsView(balance));
  }

  @Get('finished-goods/:productVariantId/movements')
  listFinishedGoodsMovements(@Param('productVariantId') productVariantId: string) {
    return this.database.finishedGoodsMovement.findMany({
      where: { productVariantId },
      include: {
        productionOrder: { select: { id: true, code: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: { occurredAt: 'desc' },
    });
  }

  @Get('finished-goods/:productVariantId')
  async getFinishedGoodsByVariant(
    @Param('productVariantId') productVariantId: string,
  ) {
    const variant = await this.database.productVariant.findUnique({
      where: { id: productVariantId },
      include: { product: { include: { productLine: true } } },
    });
    if (!variant) throw new NotFoundException('ProductVariant não encontrado.');
    const balances = await this.database.finishedProduct.findMany({
      where: { productVariantId },
      include: { warehouse: true, finishedGoodsMovements: true },
    });
    const physicalUnits = balances.reduce(
      (sum, balance) => sum + balance.quantityOnHand,
      0,
    );
    const reservedUnits = balances.reduce(
      (sum, balance) => sum + balance.reservedQuantity,
      0,
    );
    const balance = calculateFinishedGoodsBalance(
      physicalUnits,
      reservedUnits,
    );
    const movements = balances.flatMap(
      (item) => item.finishedGoodsMovements,
    );
    return {
      productVariantId: variant.id,
      line: variant.product.productLine.name,
      lineCode: variant.product.productLine.code,
      product: variant.product.name,
      sku: variant.sku,
      presentationGrams: variant.netWeightGrams,
      salesUnit: variant.salesUnit,
      ...balance,
      entries: movements
        .filter((item) => this.isFinishedGoodsEntry(item.type))
        .reduce((sum, item) => sum + item.packageQuantity, 0),
      exits: movements
        .filter((item) => this.isFinishedGoodsExit(item.type))
        .reduce((sum, item) => sum + item.packageQuantity, 0),
      locations: balances.map((item) => ({
        warehouseId: item.warehouseId,
        warehouse: item.warehouse.name,
        ...calculateFinishedGoodsBalance(
          item.quantityOnHand,
          item.reservedQuantity,
        ),
      })),
    };
  }

  @Get('lots')
  listLots() {
    return this.database.coffeeLot.findMany({ include: { supplier: true, warehouse: true }, orderBy: { receivedAt: 'desc' } });
  }

  @Get('lots/:id')
  async getLot(@Param('id') id: string) {
    const lot = await this.database.coffeeLot.findUnique({ where: { id }, include: { supplier: true, warehouse: true, industrialEvents: { orderBy: { occurredAt: 'desc' } }, costEvents: { orderBy: { occurredAt: 'asc' } } } });
    if (!lot) throw new NotFoundException('Lote não encontrado.');
    return lot;
  }

  @Get('movements')
  listMovements() {
    return this.database.industrialEvent.findMany({ where: { type: { in: [EventType.RECEIPT, EventType.TRANSFER, EventType.ADJUSTMENT] } }, include: { coffeeLot: true, warehouse: true }, orderBy: { occurredAt: 'desc' }, take: 200 });
  }

  @Get('summary')
  async getSummary() {
    const lots = await this.database.coffeeLot.findMany({ select: { currentWeightKg: true, reservedWeightKg: true, landedCost: true, initialWeightKg: true, status: true } });
    const totalGreenCoffeeKg = lots.reduce((sum, lot) => sum + Number(lot.currentWeightKg) + Number(lot.reservedWeightKg), 0);
    const financialStockValue = lots.reduce((sum, lot) => { const unitCost = Number(lot.initialWeightKg) > 0 ? Number(lot.landedCost) / Number(lot.initialWeightKg) : 0; return sum + (Number(lot.currentWeightKg) + Number(lot.reservedWeightKg)) * unitCost; }, 0);
    return { totalGreenCoffeeKg, financialStockValue, averageCostPerKg: totalGreenCoffeeKg > 0 ? financialStockValue / totalGreenCoffeeKg : 0, activeLots: lots.filter(lot => lot.status !== 'BLOCKED' && Number(lot.currentWeightKg) > 0).length, blockedLots: lots.filter(lot => lot.status === 'BLOCKED').length, attentionLots: lots.filter(lot => lot.status === 'QUALITY_REVIEW').length, estimatedCoverageDays: Math.round(totalGreenCoffeeKg / 811) };
  }

  @Post('lots/:id/movements')
  registerMovement(@Param('id') id: string, @Body() body: RegisterMovementBody) {
    if (!Number.isFinite(body.quantityKg) || body.quantityKg <= 0) throw new BadRequestException('Quantidade deve ser maior que zero.');
    return this.database.$transaction(async transaction => {
      const lot = await transaction.coffeeLot.findUnique({ where: { id } });
      if (!lot) throw new NotFoundException('Lote não encontrado.');
      const available = Number(lot.currentWeightKg);
      const reserved = Number(lot.reservedWeightKg);
      if (lot.status !== 'APPROVED' && body.type === 'production-reservation') throw new BadRequestException('Somente lote liberado pela Qualidade pode ser reservado para produção.');
      if (lot.status === 'BLOCKED' && body.type === 'exit') throw new BadRequestException('Lote bloqueado não pode sair.');
      let nextAvailable = available;
      let nextReserved = reserved;
      if (body.type === 'entry') nextAvailable += body.quantityKg;
      if (body.type === 'exit') nextAvailable -= body.quantityKg;
      if (body.type === 'production-reservation') { nextAvailable -= body.quantityKg; nextReserved += body.quantityKg; }
      if (body.type === 'reservation-release') { nextReserved -= body.quantityKg; nextAvailable += body.quantityKg; }
      if (body.type === 'inventory-adjustment') nextAvailable += body.adjustmentDirection === 'increase' ? body.quantityKg : -body.quantityKg;
      if (nextAvailable < 0 || nextReserved < 0) throw new BadRequestException('Movimentação recusada: saldo negativo.');
      const updated = await transaction.coffeeLot.update({ where: { id }, data: { currentWeightKg: new Prisma.Decimal(nextAvailable), reservedWeightKg: new Prisma.Decimal(nextReserved), warehouseId: body.type === 'internal-transfer' && body.destinationWarehouseId ? body.destinationWarehouseId : lot.warehouseId } });
      const event = await transaction.industrialEvent.create({ data: { companyId: lot.companyId, coffeeLotId: lot.id, warehouseId: updated.warehouseId, type: movementEventType[body.type], quantityKg: body.quantityKg, metadata: { movementType: body.type, userId: body.userId, userName: body.userName, origin: body.origin, destination: body.destination, reason: body.reason, adjustmentDirection: body.adjustmentDirection ?? null, availableAfterKg: nextAvailable, reservedAfterKg: nextReserved } } });
      return { eventId: event.id, lotId: lot.id, availableQuantityKg: nextAvailable, reservedQuantityKg: nextReserved };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private finishedGoodsView(balance: Prisma.FinishedProductGetPayload<{
    include: {
      productVariant: {
        include: { product: { include: { productLine: true } } };
      };
      warehouse: true;
      finishedGoodsMovements: true;
    };
  }>) {
    const stock = calculateFinishedGoodsBalance(
      balance.quantityOnHand,
      balance.reservedQuantity,
    );
    return {
      finishedProductId: balance.id,
      productVariantId: balance.productVariantId,
      source: balance.productVariant ? 'catalog' : 'legacy',
      line: balance.productVariant?.product.productLine.name ?? balance.line,
      lineCode:
        balance.productVariant?.product.productLine.code ?? balance.line,
      product: balance.productVariant?.product.name ?? balance.name,
      sku: balance.productVariant?.sku ?? balance.sku,
      presentationGrams:
        balance.productVariant?.netWeightGrams ?? balance.packageWeightG,
      salesUnit: balance.productVariant?.salesUnit ?? 'UN',
      warehouseId: balance.warehouseId,
      location: balance.warehouse.name,
      ...stock,
      entries: balance.finishedGoodsMovements
        .filter((item) => this.isFinishedGoodsEntry(item.type))
        .reduce((sum, item) => sum + item.packageQuantity, 0),
      exits: balance.finishedGoodsMovements
        .filter((item) => this.isFinishedGoodsExit(item.type))
        .reduce((sum, item) => sum + item.packageQuantity, 0),
      updatedAt: balance.updatedAt,
    };
  }

  private isFinishedGoodsEntry(type: FinishedGoodsMovementType) {
    return ([
      FinishedGoodsMovementType.ENTRY,
      FinishedGoodsMovementType.PRODUCTION_IN,
      FinishedGoodsMovementType.ADJUSTMENT_IN,
      FinishedGoodsMovementType.RETURN_IN,
    ] as FinishedGoodsMovementType[]).includes(type);
  }

  private isFinishedGoodsExit(type: FinishedGoodsMovementType) {
    return ([
      FinishedGoodsMovementType.EXIT,
      FinishedGoodsMovementType.SALE_OUT,
      FinishedGoodsMovementType.ADJUSTMENT_OUT,
      FinishedGoodsMovementType.LOSS_OUT,
    ] as FinishedGoodsMovementType[]).includes(type);
  }
}
