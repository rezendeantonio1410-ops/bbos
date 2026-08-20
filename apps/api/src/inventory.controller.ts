import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Req, type OnModuleDestroy } from '@nestjs/common';
import type { Request } from 'express';
import { EventType, FinishedGoodsMovementType, Prisma, PrismaClient } from '@bbos/database';
import { calculateFinishedGoodsBalance, type InventoryMovementType } from '@bbos/shared';
import { AuthService } from './auth.service';
import { requireSession } from './auth-context';

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

type GreenCoffeeSummaryLot = {
  currentWeightKg: Prisma.Decimal;
  reservedWeightKg: Prisma.Decimal;
  landedCost: Prisma.Decimal;
  initialWeightKg: Prisma.Decimal;
  status: string;
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
  constructor(private readonly auth: AuthService) {}

  onModuleDestroy() {
    return this.database.$disconnect();
  }

  @Get('finished-goods')
  async listFinishedGoods(@Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const balances = await this.database.finishedProduct.findMany({
      where: { companyId: actor.companyId },
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
  async listFinishedGoodsMovements(@Param('productVariantId') productVariantId: string, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    return this.database.finishedGoodsMovement.findMany({
      where: { productVariantId, companyId: actor.companyId },
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
    @Req() req: Request,
  ) {
    const actor = await requireSession(req, this.auth);
    const variant = await this.database.productVariant.findUnique({
      where: { id: productVariantId },
      include: { product: { include: { productLine: true } } },
    });
    if (!variant) throw new NotFoundException('ProductVariant não encontrado.');
    if (variant.product.productLine.companyId !== actor.companyId) throw new NotFoundException('Produto não encontrado.');
    const balances = await this.database.finishedProduct.findMany({
      where: { productVariantId, companyId: actor.companyId },
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
  async listLots(@Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    return this.database.coffeeLot.findMany({ where: { companyId: actor.companyId }, include: { supplier: true, warehouse: true }, orderBy: { receivedAt: 'desc' } });
  }

  @Get('lots/:id')
  async getLot(@Param('id') id: string, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const lot = await this.database.coffeeLot.findFirst({ where: { id, companyId: actor.companyId }, include: { supplier: true, warehouse: true, industrialEvents: { orderBy: { occurredAt: 'desc' } }, costEvents: { orderBy: { occurredAt: 'asc' } } } });
    if (!lot) throw new NotFoundException('Lote não encontrado.');
    return lot;
  }

  @Get('movements')
  async listMovements(@Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    return this.database.industrialEvent.findMany({ where: { companyId: actor.companyId, type: { in: [EventType.RECEIPT, EventType.TRANSFER, EventType.ADJUSTMENT] } }, include: { coffeeLot: true, warehouse: true }, orderBy: { occurredAt: 'desc' }, take: 200 });
  }

  @Get('summary')
  async getSummary(@Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const lots: GreenCoffeeSummaryLot[] = await this.database.coffeeLot.findMany({ where: { companyId: actor.companyId }, select: { currentWeightKg: true, reservedWeightKg: true, landedCost: true, initialWeightKg: true, status: true } });
    const totalGreenCoffeeKg = lots.reduce((sum, lot) => sum + Number(lot.currentWeightKg) + Number(lot.reservedWeightKg), 0);
    const availableGreenCoffeeKg = lots.filter((lot) => lot.status === 'APPROVED').reduce((sum, lot) => sum + Number(lot.currentWeightKg), 0);
    const reservedGreenCoffeeKg = lots.filter((lot) => lot.status === 'APPROVED').reduce((sum, lot) => sum + Number(lot.reservedWeightKg), 0);
    const blockedGreenCoffeeKg = lots.filter((lot) => lot.status === 'BLOCKED').reduce((sum, lot) => sum + Number(lot.currentWeightKg), 0);
    const underAnalysisGreenCoffeeKg = lots.filter((lot) => lot.status === 'QUALITY_REVIEW').reduce((sum, lot) => sum + Number(lot.currentWeightKg), 0);
    const consumedGreenCoffeeKg = lots.reduce((sum, lot) => sum + Math.max(0, Number(lot.initialWeightKg) - Number(lot.currentWeightKg) - Number(lot.reservedWeightKg)), 0);
    const financialStockValue = lots.reduce((sum, lot) => { const unitCost = Number(lot.initialWeightKg) > 0 ? Number(lot.landedCost) / Number(lot.initialWeightKg) : 0; return sum + (Number(lot.currentWeightKg) + Number(lot.reservedWeightKg)) * unitCost; }, 0);
    return { totalGreenCoffeeKg, availableGreenCoffeeKg, reservedGreenCoffeeKg, blockedGreenCoffeeKg, underAnalysisGreenCoffeeKg, consumedGreenCoffeeKg, financialStockValue, averageCostPerKg: totalGreenCoffeeKg > 0 ? financialStockValue / totalGreenCoffeeKg : 0, activeLots: lots.filter((lot) => lot.status === 'APPROVED' && Number(lot.currentWeightKg) > 0).length, blockedLots: lots.filter((lot) => lot.status === 'BLOCKED').length, attentionLots: lots.filter((lot) => lot.status === 'QUALITY_REVIEW').length, estimatedCoverageDays: null };
  }

  @Post('lots/:id/movements')
  async registerMovement(@Param('id') id: string, @Body() body: RegisterMovementBody, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    body.userId = actor.id;
    body.userName = actor.name;
    if (!Number.isFinite(body.quantityKg) || body.quantityKg <= 0) throw new BadRequestException('Quantidade deve ser maior que zero.');
    return this.database.$transaction(async transaction => {
      const lot = await transaction.coffeeLot.findFirst({ where: { id, companyId: actor.companyId } });
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
