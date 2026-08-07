import { Body, Controller, Post } from '@nestjs/common';
import { CostType, EventType, prisma } from '@bbos/database';
import type { LabAnalysis, LotCostBreakdown } from '@bbos/shared';

type CreateReceiptBody = {
  companyId: string;
  supplierId: string;
  warehouseId: string;
  origin: string;
  harvest?: string;
  variety?: string;
  weightKg: number;
  costs: LotCostBreakdown;
  lab?: LabAnalysis;
};

@Controller('receipts')
export class ReceiptsController {
  @Post()
  create(@Body() body: CreateReceiptBody) {
    const totalCost = Object.values(body.costs).reduce((total, value) => total + value, 0);
    const code = `CV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const status = body.lab?.approval === 'approved' ? 'APPROVED' : body.lab?.approval === 'rejected' ? 'BLOCKED' : 'QUALITY_REVIEW';
    const costRows = [
      { type: CostType.RAW_MATERIAL, amount: body.costs.coffeeValue, description: 'Valor do café' },
      { type: CostType.FREIGHT, amount: body.costs.freight, description: 'Frete' },
      { type: CostType.TAX, amount: body.costs.nonRecoverableTaxes, description: 'Impostos não recuperáveis' },
      { type: CostType.OTHER, amount: body.costs.unloading, description: 'Descarga' },
      { type: CostType.OTHER, amount: body.costs.initialProcessing, description: 'Beneficiamento inicial' },
      { type: CostType.OTHER, amount: body.costs.otherDirectCosts, description: 'Outros custos diretos' },
    ].filter(row => row.amount > 0);

    return prisma.$transaction(async transaction => {
      const lot = await transaction.coffeeLot.create({ data: {
        companyId: body.companyId, supplierId: body.supplierId, warehouseId: body.warehouseId, code, origin: body.origin,
        harvest: body.harvest, variety: body.variety, initialWeightKg: body.weightKg, currentWeightKg: body.weightKg,
        purchaseCost: body.costs.coffeeValue, landedCost: totalCost, qualityScore: body.lab?.scaScore, status,
      } });
      await transaction.industrialEvent.create({ data: { companyId: body.companyId, coffeeLotId: lot.id, warehouseId: body.warehouseId, type: EventType.RECEIPT, quantityKg: body.weightKg, metadata: { lab: body.lab ?? null, realCostPerKg: totalCost / body.weightKg } } });
      await transaction.costEvent.createMany({ data: costRows.map(row => ({ companyId: body.companyId, coffeeLotId: lot.id, type: row.type, amount: row.amount, quantityBasis: body.weightKg, description: row.description })) });
      return { lotId: lot.id, code: lot.code, totalCost, realCostPerKg: totalCost / body.weightKg, status: lot.status, eventsCreated: { industrial: 1, costs: costRows.length } };
    });
  }
}
