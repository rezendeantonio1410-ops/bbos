import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import {
  CostType,
  EventType,
  Prisma,
  ProductionPriority,
  ProductionStatus,
} from "@bbos/database";
import {
  calculateProductionCost,
  calculateRealProductionCost,
  calculateRoastLoss,
  type RealProductionCostInput,
} from "@bbos/shared";
import { ProductionService } from "./production.service";

type CreateOrderBody = {
  code: string;
  productVariantId: string;
  productName?: string;
  sku?: string;
  plannedWeightKg: number;
  plannedAt: string;
  responsible: string;
  priority?: ProductionPriority;
  blendId?: string;
  allocations: Array<{
    coffeeLotId: string;
    reservedKg: number;
    percentage: number;
  }>;
};
type CreateBatchBody = {
  code: string;
  machine: string;
  operator: string;
  greenInputKg: number;
  roastedOutputKg: number;
  startedAt: string;
  completedAt: string;
  coffeeLotIds: string[];
  curveData?: Record<string, unknown>;
  notes?: string;
};
type CompleteOrderBody = {
  warehouseId: string;
  finishedProductId?: string;
  finishedOutputKg: number;
  producedPackages: number;
  packaging: Array<{
    materialType: string;
    materialName: string;
    sku?: string;
    quantity: number;
    unit: string;
    unitCost: number;
  }>;
  laborCost: number;
  energyCost: number;
  suppliesCost: number;
  otherIndustrialCosts: number;
  standardCostPerKg: number;
};
type CalculateV2Body = RealProductionCostInput & {
  periodCode: string;
  productVariantId?: string;
};

@Controller("production")
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @Post("orders/:id/cost-v2")
  calculateAndSnapshotV2(
    @Param("id") id: string,
    @Body() body: CalculateV2Body,
  ) {
    return this.production.database.$transaction(
      async (transaction) => {
        const order = await transaction.productionOrder.findUnique({
          where: { id },
          include: { costEvents: true },
        });
        if (!order)
          throw new NotFoundException("Ordem de produção não encontrada.");
        const period = await transaction.allocationPeriod.findUnique({
          where: {
            companyId_code: {
              companyId: order.companyId,
              code: body.periodCode,
            },
          },
        });
        if (!period)
          throw new BadRequestException("Período de custeio não encontrado.");
        if (period.status === "CLOSED")
          throw new BadRequestException(
            "Período fechado não pode ser recalculado. Registre um ajuste auditável em período aberto.",
          );
        const knownSources = new Set(order.costEvents.map((item) => item.id));
        const foreignEventIds = body.sourceIds.filter(
          (sourceId) =>
            sourceId.startsWith("cost-") && !knownSources.has(sourceId),
        );
        if (foreignEventIds.length)
          throw new BadRequestException(
            "Há eventos de custo que não pertencem à OP.",
          );
        if (
          body.productVariantId &&
          order.productVariantId &&
          body.productVariantId !== order.productVariantId
        )
          throw new BadRequestException(
            "A variante informada não pertence à Ordem de Produção.",
          );
        const productVariantId =
          order.productVariantId ?? body.productVariantId ?? null;
        const result = calculateRealProductionCost(body);
        const snapshot = await transaction.costCalculationSnapshot.create({
          data: {
            companyId: order.companyId,
            productionOrderId: id,
            productVariantId,
            periodCode: body.periodCode,
            directCost: result.directCost,
            industrialCost: result.realIndustrialCost,
            corporateAllocation: body.corporateAllocation,
            absorbedCost: result.absorbedCost,
            costPerUnit: result.costPerUnit,
            costPerKg: result.costPerKg,
            absorbedCostPerUnit: result.absorbedCostPerUnit,
            absorbedCostPerKg: result.absorbedCostPerKg,
            netRevenue: body.netRevenue,
            grossMarginPercent: result.grossMarginPercent,
            industrialMarginPercent: result.industrialMarginPercent,
            contributionMarginPercent: result.contributionMarginPercent,
            afterAllocationMarginPercent: result.afterAllocationMarginPercent,
            profitPerUnit: result.profitPerUnit,
            profitPerKg: result.profitPerKg,
            composition: result.composition as Prisma.InputJsonValue,
            sourceIds: result.sourceIds,
          },
        });
        return {
          snapshotId: snapshot.id,
          calculationVersion: snapshot.calculationVersion,
          result,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  @Get("orders")
  listOrders() {
    return this.production.database.productionOrder.findMany({
      include: {
        blend: true,
        productVariant: { include: { product: { include: { productLine: true } } } },
        consumptions: { include: { coffeeLot: true } },
        batches: true,
        packagingConsumptions: true,
        finishedGoodsMovements: true,
      },
      orderBy: { plannedAt: "desc" },
    });
  }

  @Get("orders/:id")
  async getOrder(@Param("id") id: string) {
    const order = await this.production.database.productionOrder.findUnique({
      where: { id },
      include: {
        blend: true,
        productVariant: { include: { product: { include: { productLine: true } } } },
        consumptions: {
          include: { coffeeLot: { include: { supplier: true } } },
        },
        batches: true,
        packagingConsumptions: true,
        finishedGoodsMovements: true,
        industrialEvents: { orderBy: { occurredAt: "asc" } },
        costEvents: { orderBy: { occurredAt: "asc" } },
      },
    });
    if (!order)
      throw new NotFoundException("Ordem de produção não encontrada.");
    return order;
  }

  @Post("orders")
  createOrder(@Body() body: CreateOrderBody) {
    if (!body.allocations.length || body.plannedWeightKg <= 0)
      throw new BadRequestException("Informe quantidade e lotes da OP.");
    const reservedTotal = body.allocations.reduce(
      (sum, item) => sum + item.reservedKg,
      0,
    );
    const percentageTotal = body.allocations.reduce(
      (sum, item) => sum + item.percentage,
      0,
    );
    if (Math.abs(reservedTotal - body.plannedWeightKg) > 0.001)
      throw new BadRequestException(
        "A reserva deve ser igual à quantidade planejada.",
      );
    if (Math.abs(percentageTotal - 100) > 0.01)
      throw new BadRequestException(
        "A participação dos lotes deve somar 100%.",
      );
    if (
      new Set(body.allocations.map((item) => item.coffeeLotId)).size !==
      body.allocations.length
    )
      throw new BadRequestException("Um lote não pode ser duplicado na OP.");
    return this.production.database.$transaction(
      async (transaction) => {
        const variant = await this.production.requireActiveVariant(
          transaction,
          body.productVariantId,
        );
        const companyId = variant.product.productLine.companyId;
        const lots = await transaction.coffeeLot.findMany({
          where: {
            id: { in: body.allocations.map((item) => item.coffeeLotId) },
            companyId,
          },
        });
        if (lots.length !== body.allocations.length)
          throw new BadRequestException(
            "Um ou mais lotes não foram encontrados.",
          );
        for (const allocation of body.allocations) {
          const lot = lots.find((item) => item.id === allocation.coffeeLotId)!;
          if (lot.status === "BLOCKED")
            throw new BadRequestException(`Lote ${lot.code} está bloqueado.`);
          if (Number(lot.currentWeightKg) < allocation.reservedKg)
            throw new BadRequestException(
              `Saldo insuficiente no lote ${lot.code}.`,
            );
        }
        const order = await transaction.productionOrder.create({
          data: {
            companyId,
            code: body.code,
            productVariantId: variant.id,
            productName: variant.product.name,
            sku: variant.sku,
            plannedWeightKg: body.plannedWeightKg,
            plannedAt: new Date(body.plannedAt),
            responsible: body.responsible,
            priority: body.priority ?? ProductionPriority.NORMAL,
            blendId: body.blendId,
            status: ProductionStatus.RESERVED,
          },
        });
        for (const allocation of body.allocations) {
          const lot = lots.find((item) => item.id === allocation.coffeeLotId)!;
          const availableAfter =
            Number(lot.currentWeightKg) - allocation.reservedKg;
          const reservedAfter =
            Number(lot.reservedWeightKg) + allocation.reservedKg;
          await transaction.coffeeLot.update({
            where: { id: lot.id },
            data: {
              currentWeightKg: new Prisma.Decimal(availableAfter),
              reservedWeightKg: new Prisma.Decimal(reservedAfter),
            },
          });
          await transaction.productionConsumption.create({
            data: {
              companyId,
              productionOrderId: order.id,
              coffeeLotId: lot.id,
              reservedKg: allocation.reservedKg,
              percentage: allocation.percentage,
              realCostPerKg:
                Number(lot.initialWeightKg) > 0
                  ? Number(lot.landedCost) / Number(lot.initialWeightKg)
                  : 0,
            },
          });
          await transaction.industrialEvent.create({
            data: {
              companyId,
              productionOrderId: order.id,
              coffeeLotId: lot.id,
              warehouseId: lot.warehouseId,
              type: EventType.ADJUSTMENT,
              quantityKg: allocation.reservedKg,
              metadata: {
                movementType: "production-reservation",
                orderCode: body.code,
                availableAfterKg: availableAfter,
                reservedAfterKg: reservedAfter,
              },
            },
          });
        }
        return order;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  @Post("orders/:id/batches")
  async createBatch(@Param("id") id: string, @Body() body: CreateBatchBody) {
    const loss = calculateRoastLoss(body.greenInputKg, body.roastedOutputKg);
    return this.production.database.$transaction(
      async (transaction) => {
        const order = await transaction.productionOrder.findUnique({
          where: { id },
          include: { consumptions: true },
        });
        if (!order)
          throw new NotFoundException("Ordem de produção não encontrada.");
        const consumptionIds = order.consumptions.filter((item) =>
          body.coffeeLotIds.includes(item.coffeeLotId),
        );
        if (!consumptionIds.length)
          throw new BadRequestException(
            "O batch deve utilizar lotes reservados pela OP.",
          );
        const batch = await transaction.productionBatch.create({
          data: {
            companyId: order.companyId,
            productionOrderId: id,
            code: body.code,
            machine: body.machine,
            operator: body.operator,
            greenInputKg: body.greenInputKg,
            roastedOutputKg: body.roastedOutputKg,
            lossKg: loss.lossKg,
            lossPercent: loss.lossPercent,
            startedAt: new Date(body.startedAt),
            completedAt: new Date(body.completedAt),
            curveData: body.curveData as Prisma.InputJsonValue | undefined,
            notes: body.notes,
          },
        });
        await transaction.productionOrder.update({
          where: { id },
          data: {
            status: ProductionStatus.ROASTED,
            actualInputKg: { increment: body.greenInputKg },
            actualOutputKg: { increment: body.roastedOutputKg },
            startedAt: order.startedAt ?? new Date(body.startedAt),
          },
        });
        await transaction.industrialEvent.createMany({
          data: [
            {
              companyId: order.companyId,
              productionOrderId: id,
              type: EventType.ROAST,
              quantityKg: body.roastedOutputKg,
              metadata: {
                batchId: batch.id,
                machine: body.machine,
                operator: body.operator,
              },
            },
            {
              companyId: order.companyId,
              productionOrderId: id,
              type: EventType.LOSS,
              quantityKg: loss.lossKg,
              metadata: { batchId: batch.id, lossPercent: loss.lossPercent },
            },
          ],
        });
        return batch;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  @Post("orders/:id/complete")
  async completeOrder(
    @Param("id") id: string,
    @Body() body: CompleteOrderBody,
  ) {
    if (body.finishedOutputKg <= 0 || body.producedPackages <= 0)
      throw new BadRequestException(
        "Produção acabada deve ser maior que zero.",
      );
    return this.production.database.$transaction(
      async (transaction) => {
        const order = await transaction.productionOrder.findUnique({
          where: { id },
          include: {
            consumptions: { include: { coffeeLot: true } },
            batches: true,
            costEvents: true,
            productVariant: {
              include: { product: { include: { productLine: true } } },
            },
          },
        });
        if (!order)
          throw new NotFoundException("Ordem de produção não encontrada.");
        const idempotencyKey = `PRODUCTION_IN:${order.id}`;
        const existingMovement =
          await transaction.finishedGoodsMovement.findUnique({
            where: { idempotencyKey },
            include: { finishedProduct: true },
          });
        if (existingMovement)
          return {
            orderId: id,
            movementId: existingMovement.id,
            idempotent: true,
            balance: {
              physicalUnits: existingMovement.finishedProduct.quantityOnHand,
              reservedUnits:
                existingMovement.finishedProduct.reservedQuantity,
              availableUnits:
                existingMovement.finishedProduct.quantityOnHand -
                existingMovement.finishedProduct.reservedQuantity,
            },
          };
        if (order.status === ProductionStatus.COMPLETED)
          throw new BadRequestException("A OP já foi concluída.");
        const officialVariant = order.productVariantId
          ? await this.production.requireActiveVariant(
              transaction,
              order.productVariantId,
            )
          : null;
        const consumedCost = order.consumptions.reduce(
          (sum, item) =>
            sum + Number(item.reservedKg) * Number(item.realCostPerKg),
          0,
        );
        const lossKg = order.batches.reduce(
          (sum, item) => sum + Number(item.lossKg),
          0,
        );
        const averageCoffeeCost = order.consumptions.reduce(
          (sum, item) =>
            sum + (Number(item.realCostPerKg) * Number(item.percentage)) / 100,
          0,
        );
        const packagingCost = body.packaging.reduce(
          (sum, item) => sum + item.quantity * item.unitCost,
          0,
        );
        const roastedOutputKg =
          Number(order.actualOutputKg) ||
          order.batches.reduce(
            (sum, batch) => sum + Number(batch.roastedOutputKg),
            0,
          );
        const cost = calculateProductionCost({
          greenCoffeeConsumedCost: consumedCost - lossKg * averageCoffeeCost,
          roastLossCost: lossKg * averageCoffeeCost,
          packagingCost,
          suppliesCost: body.suppliesCost,
          laborCost: body.laborCost,
          energyCost: body.energyCost,
          otherIndustrialCosts: body.otherIndustrialCosts,
          roastedOutputKg,
          finishedOutputKg: body.finishedOutputKg,
          producedPackages: body.producedPackages,
          standardCostPerKg: body.standardCostPerKg,
          sku: order.sku,
          sourceCostEventIds: order.costEvents.map((item) => item.id),
        });
        for (const consumption of order.consumptions) {
          if (
            Number(consumption.coffeeLot.reservedWeightKg) <
            Number(consumption.reservedKg)
          )
            throw new BadRequestException(
              `Reserva inconsistente no lote ${consumption.coffeeLot.code}.`,
            );
          await transaction.coffeeLot.update({
            where: { id: consumption.coffeeLotId },
            data: { reservedWeightKg: { decrement: consumption.reservedKg } },
          });
          await transaction.productionConsumption.update({
            where: { id: consumption.id },
            data: { consumedKg: consumption.reservedKg },
          });
          await transaction.industrialEvent.create({
            data: {
              companyId: order.companyId,
              productionOrderId: id,
              coffeeLotId: consumption.coffeeLotId,
              warehouseId: consumption.coffeeLot.warehouseId,
              type: EventType.TRANSFER,
              quantityKg: consumption.reservedKg,
              metadata: {
                movementType: "production-consumption",
                orderCode: order.code,
              },
            },
          });
        }
        await transaction.packagingConsumption.createMany({
          data: body.packaging.map((item) => ({
            companyId: order.companyId,
            productionOrderId: id,
            materialType: item.materialType,
            materialName: item.materialName,
            sku: item.sku,
            quantity: item.quantity,
            unit: item.unit,
            unitCost: item.unitCost,
            totalCost: item.quantity * item.unitCost,
          })),
        });
        let finishedProduct = officialVariant
          ? await transaction.finishedProduct.findFirst({
              where: {
                productVariantId: officialVariant.id,
                warehouseId: body.warehouseId,
              },
            })
          : null;
        if (!finishedProduct && officialVariant) {
          finishedProduct = await transaction.finishedProduct.create({
            data: {
              companyId: officialVariant.product.productLine.companyId,
              blendId: order.blendId,
              productionOrderId: order.id,
              productVariantId: officialVariant.id,
              warehouseId: body.warehouseId,
              sku: officialVariant.sku,
              name: officialVariant.product.name,
              line: officialVariant.product.productLine.code,
              packageWeightG: officialVariant.netWeightGrams,
              quantityOnHand: 0,
              reservedQuantity: 0,
              standardPrice: 0,
            },
          });
        }
        if (!finishedProduct && body.finishedProductId)
          finishedProduct = await transaction.finishedProduct.findUnique({
            where: { id: body.finishedProductId },
          });
        if (!finishedProduct)
          throw new BadRequestException(
            order.productVariantId
              ? "Não foi possível criar o saldo do SKU no armazém informado."
              : "Produto acabado legado não encontrado.",
          );
        if (
          order.productVariantId &&
          finishedProduct.productVariantId !== order.productVariantId
        )
          throw new BadRequestException(
            "O saldo de produto acabado não corresponde ao SKU da OP.",
          );
        const updatedBalance = await transaction.finishedProduct.update({
          where: { id: finishedProduct.id },
          data: {
            quantityOnHand: { increment: body.producedPackages },
            productVariantId: finishedProduct.productVariantId ?? order.productVariantId,
          },
        });
        const movement = await transaction.finishedGoodsMovement.create({
          data: {
            companyId: order.companyId,
            productionOrderId: id,
            productVariantId: order.productVariantId,
            finishedProductId: finishedProduct.id,
            warehouseId: body.warehouseId,
            type: order.productVariantId ? "PRODUCTION_IN" : "ENTRY",
            packageQuantity: body.producedPackages,
            unit: "UN",
            totalWeightKg: body.finishedOutputKg,
            sourceType: "PRODUCTION_ORDER",
            sourceId: order.id,
            idempotencyKey,
            reason: `Conclusão da ${order.code}`,
          },
        });
        const existingTypes = new Set(
          order.costEvents.map((item) => item.type),
        );
        const costCenters = await transaction.costCenter.findMany({
          where: {
            companyId: order.companyId,
            code: { in: ["IND-TOR", "IND-EMP"] },
            active: true,
          },
        });
        const roastingCenter = costCenters.find((item) => item.code === "IND-TOR");
        const packagingCenter = costCenters.find((item) => item.code === "IND-EMP");
        if (!roastingCenter || !packagingCenter)
          throw new BadRequestException(
            "Configure os centros IND-TOR e IND-EMP antes de concluir a OP.",
          );
        const newCosts = [
          { type: CostType.PACKAGING, amount: packagingCost, costCenterId: packagingCenter.id, nature: "DIRECT" as const },
          { type: CostType.LABOR, amount: body.laborCost, costCenterId: packagingCenter.id, nature: "DIRECT" as const },
          { type: CostType.ENERGY, amount: body.energyCost, costCenterId: roastingCenter.id, nature: "INDIRECT_INDUSTRIAL" as const },
          { type: CostType.SUPPLIES, amount: body.suppliesCost, costCenterId: packagingCenter.id, nature: "DIRECT" as const },
          {
            type: CostType.OTHER,
            amount: body.otherIndustrialCosts,
            costCenterId: packagingCenter.id,
            nature: "INDIRECT_INDUSTRIAL" as const,
          },
        ].filter((item) => item.amount > 0 && !existingTypes.has(item.type));
        if (newCosts.length)
          await transaction.costEvent.createMany({
            data: newCosts.map((item) => ({
              companyId: order.companyId,
              productionOrderId: id,
              productVariantId: order.productVariantId,
              costCenterId: item.costCenterId,
              type: item.type,
              nature: item.nature,
              amount: item.amount,
              description: `${order.code} • custo industrial confirmado`,
            })),
          });
        await transaction.productionOrder.update({
          where: { id },
          data: {
            status: ProductionStatus.COMPLETED,
            actualOutputKg: body.finishedOutputKg,
            completedAt: new Date(),
          },
        });
        return {
          orderId: id,
          movementId: movement.id,
          productVariantId: order.productVariantId,
          idempotent: false,
          balance: {
            physicalUnits: updatedBalance.quantityOnHand,
            reservedUnits: updatedBalance.reservedQuantity,
            availableUnits:
              updatedBalance.quantityOnHand - updatedBalance.reservedQuantity,
          },
          cost,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
